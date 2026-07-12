import { corsHeaders } from './cors.js';

/**
 * @param {number} status
 * @param {object|string} body
 * @param {Request} request
 * @param {object} env
 * @returns {Response}
 */
export function jsonResponse(status, body, request, env) {
    const headers = corsHeaders(request, env);
    headers['Content-Type'] = 'application/json';
    headers['Cache-Control'] = 'no-store';
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(payload, { status, headers });
}

/**
 * @param {Request} request
 * @returns {Promise<object|null>}
 */
export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}
