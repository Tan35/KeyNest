import { hashPassword, verifyPassword } from './utils/password.js';
import { signJwt } from './utils/jwt.js';
import { jsonResponse, readJson } from './utils/http.js';
import { getAuthUser } from './utils/authContext.js';
import { checkRateLimit } from './utils/rateLimit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const AUTH_RATE = { maxRequests: 20, windowMs: 60_000 };

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function getClientIP(request) {
    return (
        request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown'
    );
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {string} pathname
 * @returns {Promise<Response>}
 */
export async function handleAuthRequest(request, env, pathname) {
    if (!env.DB) {
        return jsonResponse(503, { error: 'Database not configured' }, request, env);
    }
    if (!env.JWT_SECRET) {
        return jsonResponse(503, { error: 'JWT_SECRET not configured' }, request, env);
    }

    const ip = getClientIP(request);
    const limit = checkRateLimit(`auth:${ip}`, AUTH_RATE.maxRequests, AUTH_RATE.windowMs);
    if (!limit.allowed) {
        return jsonResponse(429, { error: 'Too many requests, please try again later.' }, request, env);
    }

    if (pathname === '/api/auth/register' && request.method === 'POST') {
        return handleRegister(request, env);
    }
    if (pathname === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(request, env);
    }
    if (pathname === '/api/auth/me' && request.method === 'GET') {
        return handleMe(request, env);
    }
    if (pathname === '/api/auth/logout' && request.method === 'POST') {
        // 无状态 JWT：客户端丢弃 token 即可
        return jsonResponse(200, { ok: true }, request, env);
    }

    return jsonResponse(404, { error: 'Not found' }, request, env);
}

async function handleRegister(request, env) {
    const body = await readJson(request);
    if (!body) return jsonResponse(400, { error: 'Invalid JSON' }, request, env);

    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const inviteCode = String(body.inviteCode || '').trim();

    if (!EMAIL_RE.test(email)) {
        return jsonResponse(400, { error: 'Invalid email' }, request, env);
    }
    if (password.length < MIN_PASSWORD) {
        return jsonResponse(400, { error: `Password must be at least ${MIN_PASSWORD} characters` }, request, env);
    }

    const expectedInvite = env.INVITE_CODE || 'KeyNest2026';
    if (inviteCode !== expectedInvite) {
        return jsonResponse(403, { error: 'Invalid invite code' }, request, env);
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
        return jsonResponse(409, { error: 'Email already registered' }, request, env);
    }

    const { hash, salt } = await hashPassword(password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    try {
        await env.DB.prepare(
            'INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)'
        )
            .bind(id, email, hash, salt, createdAt)
            .run();
    } catch (e) {
        return jsonResponse(500, { error: 'Failed to create user' }, request, env);
    }

    const token = await signJwt({ sub: id, email }, env.JWT_SECRET);
    return jsonResponse(201, { token, user: { id, email } }, request, env);
}

async function handleLogin(request, env) {
    const body = await readJson(request);
    if (!body) return jsonResponse(400, { error: 'Invalid JSON' }, request, env);

    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) {
        return jsonResponse(400, { error: 'Email and password required' }, request, env);
    }

    const user = await env.DB.prepare(
        'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?'
    )
        .bind(email)
        .first();

    if (!user) {
        return jsonResponse(401, { error: 'Invalid email or password' }, request, env);
    }

    const ok = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!ok) {
        return jsonResponse(401, { error: 'Invalid email or password' }, request, env);
    }

    const token = await signJwt({ sub: user.id, email: user.email }, env.JWT_SECRET);
    return jsonResponse(200, { token, user: { id: user.id, email: user.email } }, request, env);
}

async function handleMe(request, env) {
    const auth = await getAuthUser(request, env);
    if (!auth) return jsonResponse(401, { error: 'Unauthorized' }, request, env);

    const user = await env.DB.prepare('SELECT id, email, created_at FROM users WHERE id = ?')
        .bind(auth.userId)
        .first();

    if (!user) return jsonResponse(401, { error: 'Unauthorized' }, request, env);

    return jsonResponse(
        200,
        { user: { id: user.id, email: user.email, createdAt: user.created_at } },
        request,
        env
    );
}
