import { corsHeaders, handleOptions } from './utils/cors.js';
import { handleWebSocketSession } from './websocket_handler.js';
import * as modelFetcher from './model_fetchers.js';
import * as providersData from '../config/providers.json';
import { checkRateLimit } from './utils/rateLimit.js';
import { handleAuthRequest } from './auth.js';
import { handleVaultRequest } from './vault.js';
import { getAuthUser } from './utils/authContext.js';
import { jsonResponse } from './utils/http.js';

/**
 * @description 速率限制配置。
 */
const RATE_LIMITS = {
    WS: { maxRequests: 10, windowMs: 60_000 },
    MODELS: { maxRequests: 30, windowMs: 60_000 },
};

/**
 * @description Durable Object：按区域发起上游请求。
 */
export class RegionalFetcher {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request) {
        const { targetUrl, method, headers, body } = await request.json();
        const upstreamRequest = new Request(targetUrl, {
            method,
            headers,
            body: typeof body === 'object' ? JSON.stringify(body) : body,
        });
        return fetch(upstreamRequest);
    }
}

async function handleModelsRequest(request, env) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        return new Response('Invalid JSON in request body', { status: 400 });
    }

    const { token, providerConfig } = requestBody;
    if (!token || !providerConfig) {
        return new Response('Invalid request body', { status: 400 });
    }

    const providerMeta = providersData.default[providerConfig.provider];
    if (!providerMeta) {
        return new Response(`Provider '${providerConfig.provider}' not found`, { status: 400 });
    }

    try {
        const models = await modelFetcher.getModels(providerMeta, token, providerConfig, env);
        const responseHeaders = corsHeaders(request, env);
        responseHeaders['Content-Type'] = 'application/json';
        return new Response(JSON.stringify(models), { headers: responseHeaders });
    } catch (error) {
        const responseHeaders = corsHeaders(request, env);
        responseHeaders['Content-Type'] = 'application/json';
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: responseHeaders,
        });
    }
}

function getClientIP(request) {
    return (
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown'
    );
}

function rateLimitResponse(retryAfterMs, request, env) {
    const headers = corsHeaders(request, env);
    headers['Retry-After'] = String(Math.ceil(retryAfterMs / 1000));
    headers['Content-Type'] = 'application/json';
    return new Response(JSON.stringify({ error: 'Too many requests, please try again later.' }), {
        status: 429,
        headers,
    });
}

/**
 * @description 业务接口鉴权；未登录返回 401 JSON。
 */
async function requireAuth(request, env) {
    const user = await getAuthUser(request, env);
    if (!user) {
        return { user: null, error: jsonResponse(401, { error: 'Unauthorized' }, request, env) };
    }
    return { user, error: null };
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        if (request.method === 'OPTIONS') {
            return handleOptions(request, env);
        }

        // 认证
        if (pathname.startsWith('/api/auth')) {
            return handleAuthRequest(request, env, pathname);
        }

        // 用户 vault（需登录）
        if (pathname.startsWith('/api/keys')) {
            return handleVaultRequest(request, env, pathname);
        }

        // WebSocket 检测（需登录，token 走 query）
        if (pathname === '/check') {
            const upgradeHeader = request.headers.get('Upgrade');
            if (upgradeHeader !== 'websocket') {
                return new Response('Expected a WebSocket upgrade request', { status: 426 });
            }

            const { error } = await requireAuth(request, env);
            if (error) return error;

            const clientIP = getClientIP(request);
            const wsLimit = checkRateLimit(`ws:${clientIP}`, RATE_LIMITS.WS.maxRequests, RATE_LIMITS.WS.windowMs);
            if (!wsLimit.allowed) {
                return rateLimitResponse(wsLimit.retryAfterMs, request, env);
            }

            const [client, server] = Object.values(new WebSocketPair());
            ctx.waitUntil(handleWebSocketSession(server, env));

            const responseHeaders = corsHeaders(request, env);
            return new Response(null, {
                status: 101,
                webSocket: client,
                headers: responseHeaders,
            });
        }

        // 模型列表（需登录）
        if (pathname === '/models') {
            const { error } = await requireAuth(request, env);
            if (error) return error;

            const clientIP = getClientIP(request);
            const modelsLimit = checkRateLimit(
                `models:${clientIP}`,
                RATE_LIMITS.MODELS.maxRequests,
                RATE_LIMITS.MODELS.windowMs
            );
            if (!modelsLimit.allowed) {
                return rateLimitResponse(modelsLimit.retryAfterMs, request, env);
            }
            return handleModelsRequest(request, env);
        }

        // 静态资源（登录页需要未鉴权可访问）
        try {
            return await env.ASSETS.fetch(request);
        } catch (e) {
            return new Response('静态资源服务配置错误，请检查 wrangler.toml。', { status: 500 });
        }
    },
};
