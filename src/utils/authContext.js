import { verifyJwt } from './jwt.js';

/**
 * @description 从 Authorization Bearer 或 query token 解析会话用户。
 * @param {Request} request
 * @param {object} env
 * @returns {Promise<{ userId: string, email: string }|null>}
 */
export async function getAuthUser(request, env) {
    const secret = env.JWT_SECRET;
    if (!secret) return null;

    let token = null;
    const auth = request.headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(\S+)/i);
    if (match) token = match[1].trim();

    if (!token) {
        try {
            const url = new URL(request.url);
            token = url.searchParams.get('token') || url.searchParams.get('access_token');
        } catch {
            /* ignore */
        }
    }

    if (!token) return null;

    const payload = await verifyJwt(token, secret);
    if (!payload?.sub || !payload?.email) return null;
    return { userId: payload.sub, email: payload.email };
}
