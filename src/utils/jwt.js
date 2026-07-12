/**
 * @description 轻量 HS256 JWT（Web Crypto），用于会话。
 */

function base64UrlEncode(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToString(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return atob(padded + pad);
}

async function importHmacKey(secret) {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

/**
 * @param {object} payload
 * @param {string} secret
 * @param {number} [expiresInSec=604800] - 默认 7 天
 * @returns {Promise<string>}
 */
export async function signJwt(payload, secret, expiresInSec = 60 * 60 * 24 * 7) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const body = { ...payload, iat: now, exp: now + expiresInSec };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(body));
    const data = `${encodedHeader}.${encodedPayload}`;
    const key = await importHmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return `${data}.${base64UrlEncode(signature)}`;
}

/**
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<object|null>}
 */
export async function verifyJwt(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSig] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const key = await importHmacKey(secret);

    const sigStr = encodedSig.replace(/-/g, '+').replace(/_/g, '/');
    const pad = sigStr.length % 4 === 0 ? '' : '='.repeat(4 - (sigStr.length % 4));
    const sigBinary = atob(sigStr + pad);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) sigBytes[i] = sigBinary.charCodeAt(i);

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;

    try {
        const payload = JSON.parse(base64UrlDecodeToString(encodedPayload));
        if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}
