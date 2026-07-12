import { corsHeaders } from './utils/cors.js';
import { checkRateLimit } from './utils/rateLimit.js';

/**
 * @description 云备份相关限制。
 * MIN_TOKEN_LENGTH: Backup Token 最短长度，降低可猜测性。
 * MAX_BODY_BYTES: 单次上传体大小上限（5MB）。
 * RATE: 每 IP 每分钟最多 20 次备份相关请求。
 */
const MIN_TOKEN_LENGTH = 16;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const RATE = { maxRequests: 20, windowMs: 60_000 };

/**
 * @description 对 Backup Token 做 SHA-256，用作 KV 键。永不把明文 token 写入存储。
 * @param {string} token
 * @returns {Promise<string>}
 */
async function hashBackupToken(token) {
    const data = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description 从 Authorization: Bearer <token> 提取 Backup Token。
 * @param {Request} request
 * @returns {string}
 */
function extractBearerToken(request) {
    const auth = request.headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(\S+)/i);
    return match ? match[1].trim() : '';
}

/**
 * @description 统一 JSON 错误响应。
 * @param {number} status
 * @param {string} message
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
function jsonError(status, message, request, env) {
    const headers = corsHeaders(request, env);
    headers['Content-Type'] = 'application/json';
    return new Response(JSON.stringify({ error: message }), { status, headers });
}

/**
 * @description 统一 JSON 成功响应。
 * @param {object} body
 * @param {Request} request
 * @param {object} env
 * @param {number} [status=200]
 * @returns {Response}
 */
function jsonOk(body, request, env, status = 200) {
    const headers = corsHeaders(request, env);
    headers['Content-Type'] = 'application/json';
    headers['Cache-Control'] = 'no-store';
    return new Response(JSON.stringify(body), { status, headers });
}

/**
 * @description 校验 token 并返回 KV 键；失败时返回 Response。
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ kvKey: string } | { errorResponse: Response }>}
 */
async function resolveBackupIdentity(request, env) {
    if (!env.BACKUP_KV) {
        return { errorResponse: jsonError(503, 'Cloud backup is not configured (BACKUP_KV missing)', request, env) };
    }

    const token = extractBearerToken(request);
    if (!token) {
        return { errorResponse: jsonError(401, 'Missing Authorization Bearer token', request, env) };
    }
    if (token.length < MIN_TOKEN_LENGTH) {
        return {
            errorResponse: jsonError(
                400,
                `Backup token too short (min ${MIN_TOKEN_LENGTH} characters)`,
                request,
                env
            ),
        };
    }

    const hash = await hashBackupToken(token);
    return { kvKey: `vault:${hash}` };
}

/**
 * @description 规范化并校验备份载荷（与前端 exportAllKeys 结构对齐）。
 * @param {unknown} raw
 * @returns {{ version: number, keys: Array, balanceSnapshots: Array, keyCount: number } | null}
 */
function normalizeBackupPayload(raw) {
    if (!raw || typeof raw !== 'object') return null;

    let keys;
    let balanceSnapshots = [];

    if (Array.isArray(raw)) {
        keys = raw;
    } else if (Array.isArray(raw.keys)) {
        keys = raw.keys;
        balanceSnapshots = Array.isArray(raw.balanceSnapshots) ? raw.balanceSnapshots : [];
    } else if (raw.data && typeof raw.data === 'object') {
        return normalizeBackupPayload(raw.data);
    } else {
        return null;
    }

    if (!Array.isArray(keys)) return null;

    // 粗略校验：每条至少应是对象且可含 token 字段
    for (const item of keys) {
        if (!item || typeof item !== 'object') return null;
    }

    return {
        version: typeof raw.version === 'number' ? raw.version : 2,
        keys,
        balanceSnapshots,
        keyCount: keys.length,
    };
}

/**
 * @description 处理 /api/backup：
 * - PUT/POST 上传备份（Bearer token 标识身份）
 * - GET 下载备份；?meta=1 仅返回元信息
 * - DELETE 删除云端备份
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<Response>}
 */
export async function handleBackupRequest(request, env) {
    const method = request.method.toUpperCase();

    if (!['GET', 'PUT', 'POST', 'DELETE'].includes(method)) {
        return jsonError(405, 'Method Not Allowed', request, env);
    }

    const clientIP =
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown';
    const limit = checkRateLimit(`backup:${clientIP}`, RATE.maxRequests, RATE.windowMs);
    if (!limit.allowed) {
        const headers = corsHeaders(request, env);
        headers['Retry-After'] = String(Math.ceil(limit.retryAfterMs / 1000));
        headers['Content-Type'] = 'application/json';
        return new Response(JSON.stringify({ error: 'Too many requests, please try again later.' }), {
            status: 429,
            headers,
        });
    }

    const identity = await resolveBackupIdentity(request, env);
    if (identity.errorResponse) return identity.errorResponse;
    const { kvKey } = identity;

    if (method === 'GET') {
        const stored = await env.BACKUP_KV.get(kvKey, 'json');
        if (!stored) {
            return jsonError(404, 'No backup found for this token', request, env);
        }

        const url = new URL(request.url);
        if (url.searchParams.get('meta') === '1') {
            return jsonOk(
                {
                    exists: true,
                    updatedAt: stored.updatedAt || null,
                    keyCount: stored.keyCount ?? stored.payload?.keys?.length ?? 0,
                    version: stored.version || 1,
                },
                request,
                env
            );
        }

        if (!stored.payload) {
            return jsonError(500, 'Backup payload is corrupted', request, env);
        }

        return jsonOk(
            {
                updatedAt: stored.updatedAt || null,
                keyCount: stored.keyCount ?? stored.payload?.keys?.length ?? 0,
                data: stored.payload,
            },
            request,
            env
        );
    }

    if (method === 'DELETE') {
        await env.BACKUP_KV.delete(kvKey);
        return jsonOk({ ok: true, deleted: true }, request, env);
    }

    // PUT / POST upload
    const contentLength = Number(request.headers.get('Content-Length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
        return jsonError(413, 'Backup payload too large', request, env);
    }

    let bodyText;
    try {
        bodyText = await request.text();
    } catch {
        return jsonError(400, 'Failed to read request body', request, env);
    }

    if (bodyText.length > MAX_BODY_BYTES) {
        return jsonError(413, 'Backup payload too large', request, env);
    }

    let parsed;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        return jsonError(400, 'Invalid JSON body', request, env);
    }

    const payload = normalizeBackupPayload(parsed);
    if (!payload) {
        return jsonError(400, 'Invalid backup format (expected export JSON with keys[])', request, env);
    }

    const record = {
        version: 1,
        updatedAt: new Date().toISOString(),
        keyCount: payload.keyCount,
        payload: {
            version: payload.version,
            keys: payload.keys,
            balanceSnapshots: payload.balanceSnapshots,
        },
    };

    await env.BACKUP_KV.put(kvKey, JSON.stringify(record));

    return jsonOk(
        {
            ok: true,
            updatedAt: record.updatedAt,
            keyCount: record.keyCount,
        },
        request,
        env,
        200
    );
}
