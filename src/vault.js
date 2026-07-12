import { jsonResponse, readJson } from './utils/http.js';
import { getAuthUser } from './utils/authContext.js';
import { checkRateLimit } from './utils/rateLimit.js';

const VAULT_RATE = { maxRequests: 120, windowMs: 60_000 };

function getClientIP(request) {
    return (
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown'
    );
}

function normalizeToken(token) {
    return String(token || '').trim();
}

function rowToKey(row) {
    if (!row) return null;
    let models = [];
    let tags = [];
    try {
        models = JSON.parse(row.models_json || '[]');
    } catch {
        models = [];
    }
    try {
        tags = JSON.parse(row.tags_json || '[]');
    } catch {
        tags = [];
    }
    return {
        id: row.id,
        token: row.token,
        alias: row.alias || '',
        provider: row.provider || 'openai',
        baseUrl: row.base_url || '',
        model: row.model || '',
        status: row.status || 'unknown',
        balance: row.balance ?? null,
        currency: row.currency ?? null,
        lastChecked: row.last_checked || null,
        models: Array.isArray(models) ? models : [],
        modelsUpdatedAt: row.models_updated_at || null,
        tags: Array.isArray(tags) ? tags : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function buildKeyFields(record, now, id) {
    return {
        id,
        token: normalizeToken(record.token),
        alias: record.alias || '',
        provider: record.provider || 'openai',
        baseUrl: record.baseUrl || record.base_url || '',
        model: record.model || '',
        status: record.status || 'unknown',
        balance: record.balance ?? null,
        currency: record.currency ?? null,
        lastChecked: record.lastChecked || record.last_checked || null,
        models: Array.isArray(record.models) ? record.models : [],
        modelsUpdatedAt: record.modelsUpdatedAt || record.models_updated_at || null,
        tags: Array.isArray(record.tags) ? record.tags : [],
        createdAt: record.createdAt || record.created_at || now,
        updatedAt: record.updatedAt || record.updated_at || now,
    };
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {string} pathname
 * @returns {Promise<Response>}
 */
export async function handleVaultRequest(request, env, pathname) {
    if (!env.DB) {
        return jsonResponse(503, { error: 'Database not configured' }, request, env);
    }

    const ip = getClientIP(request);
    const limit = checkRateLimit(`vault:${ip}`, VAULT_RATE.maxRequests, VAULT_RATE.windowMs);
    if (!limit.allowed) {
        return jsonResponse(429, { error: 'Too many requests, please try again later.' }, request, env);
    }

    const auth = await getAuthUser(request, env);
    if (!auth) {
        return jsonResponse(401, { error: 'Unauthorized' }, request, env);
    }

    // /api/keys
    if (pathname === '/api/keys') {
        if (request.method === 'GET') return listKeys(request, env, auth);
        if (request.method === 'POST') return createKey(request, env, auth);
        return jsonResponse(405, { error: 'Method Not Allowed' }, request, env);
    }

    // /api/keys/batch
    if (pathname === '/api/keys/batch') {
        if (request.method === 'POST') return createKeysBatch(request, env, auth);
        if (request.method === 'DELETE') return deleteKeysBatch(request, env, auth);
        return jsonResponse(405, { error: 'Method Not Allowed' }, request, env);
    }

    // /api/keys/import
    if (pathname === '/api/keys/import' && request.method === 'POST') {
        return importKeys(request, env, auth);
    }

    // /api/keys/export
    if (pathname === '/api/keys/export' && request.method === 'GET') {
        return exportKeys(request, env, auth);
    }

    // /api/keys/:id/snapshots
    const snapshotsMatch = pathname.match(/^\/api\/keys\/([^/]+)\/snapshots$/);
    if (snapshotsMatch) {
        const keyId = decodeURIComponent(snapshotsMatch[1]);
        if (request.method === 'GET') return listSnapshots(request, env, auth, keyId);
        if (request.method === 'POST') return addSnapshot(request, env, auth, keyId);
        return jsonResponse(405, { error: 'Method Not Allowed' }, request, env);
    }

    // /api/keys/:id
    const keyMatch = pathname.match(/^\/api\/keys\/([^/]+)$/);
    if (keyMatch) {
        const keyId = decodeURIComponent(keyMatch[1]);
        if (request.method === 'GET') return getKey(request, env, auth, keyId);
        if (request.method === 'PATCH' || request.method === 'PUT') return updateKey(request, env, auth, keyId);
        if (request.method === 'DELETE') return deleteKey(request, env, auth, keyId);
        return jsonResponse(405, { error: 'Method Not Allowed' }, request, env);
    }

    return jsonResponse(404, { error: 'Not found' }, request, env);
}

async function listKeys(request, env, auth) {
    const { results } = await env.DB.prepare(
        'SELECT * FROM vault_keys WHERE user_id = ? ORDER BY created_at DESC'
    )
        .bind(auth.userId)
        .all();
    return jsonResponse(200, { keys: (results || []).map(rowToKey) }, request, env);
}

async function getKey(request, env, auth, keyId) {
    const row = await env.DB.prepare('SELECT * FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .first();
    if (!row) return jsonResponse(404, { error: 'Key not found' }, request, env);
    return jsonResponse(200, { key: rowToKey(row) }, request, env);
}

async function insertKeyRow(env, auth, fields) {
    await env.DB.prepare(
        `INSERT INTO vault_keys (
            id, user_id, token, alias, provider, base_url, model, status,
            balance, currency, last_checked, models_json, models_updated_at, tags_json,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            fields.id,
            auth.userId,
            fields.token,
            fields.alias,
            fields.provider,
            fields.baseUrl,
            fields.model,
            fields.status,
            fields.balance,
            fields.currency,
            fields.lastChecked,
            JSON.stringify(fields.models),
            fields.modelsUpdatedAt,
            JSON.stringify(fields.tags),
            fields.createdAt,
            fields.updatedAt
        )
        .run();
}

async function createKey(request, env, auth) {
    const body = await readJson(request);
    if (!body) return jsonResponse(400, { error: 'Invalid JSON' }, request, env);

    const now = new Date().toISOString();
    const fields = buildKeyFields(body, now, body.id || crypto.randomUUID());
    if (!fields.token) return jsonResponse(400, { error: 'token is required' }, request, env);

    const existing = await env.DB.prepare(
        'SELECT id FROM vault_keys WHERE user_id = ? AND token = ?'
    )
        .bind(auth.userId, fields.token)
        .first();
    if (existing) return jsonResponse(409, { error: 'Key already exists' }, request, env);

    try {
        await insertKeyRow(env, auth, fields);
    } catch (e) {
        return jsonResponse(500, { error: 'Failed to create key' }, request, env);
    }

    return jsonResponse(201, { key: fields }, request, env);
}

async function createKeysBatch(request, env, auth) {
    const body = await readJson(request);
    if (!body || !Array.isArray(body.records)) {
        return jsonResponse(400, { error: 'Expected { records: [] }' }, request, env);
    }

    const existingRows = await env.DB.prepare('SELECT token FROM vault_keys WHERE user_id = ?')
        .bind(auth.userId)
        .all();
    const existingTokens = new Set((existingRows.results || []).map((r) => r.token));
    const seen = new Set();
    const now = new Date().toISOString();
    const created = [];

    for (const raw of body.records) {
        const fields = buildKeyFields(raw, now, raw?.id || crypto.randomUUID());
        if (!fields.token || existingTokens.has(fields.token) || seen.has(fields.token)) continue;
        seen.add(fields.token);
        try {
            await insertKeyRow(env, auth, fields);
            existingTokens.add(fields.token);
            created.push(fields);
        } catch {
            /* skip duplicates / errors */
        }
    }

    return jsonResponse(200, { keys: created, count: created.length }, request, env);
}

async function updateKey(request, env, auth, keyId) {
    const existing = await env.DB.prepare('SELECT * FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .first();
    if (!existing) return jsonResponse(404, { error: 'Key not found' }, request, env);

    const body = await readJson(request);
    if (!body) return jsonResponse(400, { error: 'Invalid JSON' }, request, env);

    const current = rowToKey(existing);
    const merged = {
        ...current,
        ...body,
        id: keyId,
        token: body.token !== undefined ? normalizeToken(body.token) : current.token,
        updatedAt: new Date().toISOString(),
    };

    if (!merged.token) return jsonResponse(400, { error: 'token is required' }, request, env);

    if (merged.token !== current.token) {
        const clash = await env.DB.prepare(
            'SELECT id FROM vault_keys WHERE user_id = ? AND token = ? AND id != ?'
        )
            .bind(auth.userId, merged.token, keyId)
            .first();
        if (clash) return jsonResponse(409, { error: 'Key already exists' }, request, env);
    }

    await env.DB.prepare(
        `UPDATE vault_keys SET
            token = ?, alias = ?, provider = ?, base_url = ?, model = ?, status = ?,
            balance = ?, currency = ?, last_checked = ?, models_json = ?, models_updated_at = ?,
            tags_json = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
    )
        .bind(
            merged.token,
            merged.alias || '',
            merged.provider || 'openai',
            merged.baseUrl || '',
            merged.model || '',
            merged.status || 'unknown',
            merged.balance ?? null,
            merged.currency ?? null,
            merged.lastChecked || null,
            JSON.stringify(Array.isArray(merged.models) ? merged.models : []),
            merged.modelsUpdatedAt || null,
            JSON.stringify(Array.isArray(merged.tags) ? merged.tags : []),
            merged.updatedAt,
            keyId,
            auth.userId
        )
        .run();

    return jsonResponse(200, { key: merged }, request, env);
}

async function deleteKey(request, env, auth, keyId) {
    const existing = await env.DB.prepare('SELECT id FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .first();
    if (!existing) return jsonResponse(404, { error: 'Key not found' }, request, env);

    await env.DB.prepare('DELETE FROM balance_snapshots WHERE key_id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .run();
    await env.DB.prepare('DELETE FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .run();

    return jsonResponse(200, { ok: true }, request, env);
}

async function deleteKeysBatch(request, env, auth) {
    const body = await readJson(request);
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) return jsonResponse(400, { error: 'ids required' }, request, env);

    for (const id of ids) {
        await env.DB.prepare('DELETE FROM balance_snapshots WHERE key_id = ? AND user_id = ?')
            .bind(id, auth.userId)
            .run();
        await env.DB.prepare('DELETE FROM vault_keys WHERE id = ? AND user_id = ?')
            .bind(id, auth.userId)
            .run();
    }
    return jsonResponse(200, { ok: true, count: ids.length }, request, env);
}

async function listSnapshots(request, env, auth, keyId) {
    const key = await env.DB.prepare('SELECT id FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .first();
    if (!key) return jsonResponse(404, { error: 'Key not found' }, request, env);

    const { results } = await env.DB.prepare(
        'SELECT * FROM balance_snapshots WHERE user_id = ? AND key_id = ? ORDER BY timestamp ASC'
    )
        .bind(auth.userId, keyId)
        .all();

    const snapshots = (results || []).map((r) => ({
        id: r.id,
        keyId: r.key_id,
        balance: r.balance,
        currency: r.currency || 'USD',
        timestamp: r.timestamp,
    }));

    return jsonResponse(200, { snapshots }, request, env);
}

async function addSnapshot(request, env, auth, keyId) {
    const key = await env.DB.prepare('SELECT id FROM vault_keys WHERE id = ? AND user_id = ?')
        .bind(keyId, auth.userId)
        .first();
    if (!key) return jsonResponse(404, { error: 'Key not found' }, request, env);

    const body = await readJson(request);
    if (!body || body.balance === undefined) {
        return jsonResponse(400, { error: 'balance required' }, request, env);
    }

    const snapshot = {
        id: crypto.randomUUID(),
        keyId,
        balance: body.balance,
        currency: body.currency || 'USD',
        timestamp: body.timestamp || new Date().toISOString(),
    };

    await env.DB.prepare(
        'INSERT INTO balance_snapshots (id, user_id, key_id, balance, currency, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    )
        .bind(snapshot.id, auth.userId, keyId, snapshot.balance, snapshot.currency, snapshot.timestamp)
        .run();

    return jsonResponse(201, { snapshot }, request, env);
}

async function exportKeys(request, env, auth) {
    const keysRes = await env.DB.prepare('SELECT * FROM vault_keys WHERE user_id = ?')
        .bind(auth.userId)
        .all();
    const snapsRes = await env.DB.prepare('SELECT * FROM balance_snapshots WHERE user_id = ?')
        .bind(auth.userId)
        .all();

    const keys = (keysRes.results || []).map(rowToKey);
    const balanceSnapshots = (snapsRes.results || []).map((r) => ({
        id: r.id,
        keyId: r.key_id,
        balance: r.balance,
        currency: r.currency || 'USD',
        timestamp: r.timestamp,
    }));

    return jsonResponse(200, { version: 2, keys, balanceSnapshots }, request, env);
}

async function importKeys(request, env, auth) {
    const body = await readJson(request);
    if (!body) return jsonResponse(400, { error: 'Invalid JSON' }, request, env);

    const replace = Boolean(body.replace);
    const data = body.data !== undefined ? body.data : body;
    const payload = Array.isArray(data)
        ? { keys: data, balanceSnapshots: [] }
        : {
              keys: Array.isArray(data?.keys) ? data.keys : [],
              balanceSnapshots: Array.isArray(data?.balanceSnapshots) ? data.balanceSnapshots : [],
          };

    if (replace) {
        await env.DB.prepare('DELETE FROM balance_snapshots WHERE user_id = ?').bind(auth.userId).run();
        await env.DB.prepare('DELETE FROM vault_keys WHERE user_id = ?').bind(auth.userId).run();
    }

    const existingRows = await env.DB.prepare('SELECT token FROM vault_keys WHERE user_id = ?')
        .bind(auth.userId)
        .all();
    const existingTokens = new Set((existingRows.results || []).map((r) => r.token));
    const seen = new Set();
    const now = new Date().toISOString();
    const idMap = new Map();
    let count = 0;

    for (const raw of payload.keys) {
        const fields = buildKeyFields(raw, now, crypto.randomUUID());
        if (!fields.token || existingTokens.has(fields.token) || seen.has(fields.token)) continue;
        seen.add(fields.token);
        if (raw?.id) idMap.set(raw.id, fields.id);
        try {
            await insertKeyRow(env, auth, fields);
            existingTokens.add(fields.token);
            count++;
        } catch {
            /* skip */
        }
    }

    for (const snapshot of payload.balanceSnapshots) {
        const mappedKeyId = idMap.get(snapshot?.keyId);
        if (!mappedKeyId) continue;
        try {
            await env.DB.prepare(
                'INSERT INTO balance_snapshots (id, user_id, key_id, balance, currency, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
            )
                .bind(
                    snapshot?.id || crypto.randomUUID(),
                    auth.userId,
                    mappedKeyId,
                    snapshot.balance,
                    snapshot.currency || 'USD',
                    snapshot.timestamp || now
                )
                .run();
        } catch {
            /* skip */
        }
    }

    return jsonResponse(200, { count }, request, env);
}
