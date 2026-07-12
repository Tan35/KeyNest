/**
 * @description 密码哈希（PBKDF2-SHA-256，Web Crypto）。
 */

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

/**
 * @param {string} password
 * @param {string} [saltBase64]
 * @returns {Promise<{ hash: string, salt: string }>}
 */
export async function hashPassword(password, saltBase64) {
    const enc = new TextEncoder();
    const salt = saltBase64
        ? new Uint8Array(base64ToBuffer(saltBase64))
        : crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt,
            iterations: 100_000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    );

    return {
        hash: bufferToBase64(bits),
        salt: bufferToBase64(salt),
    };
}

/**
 * @param {string} password
 * @param {string} hashBase64
 * @param {string} saltBase64
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hashBase64, saltBase64) {
    const { hash } = await hashPassword(password, saltBase64);
    if (hash.length !== hashBase64.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) {
        diff |= hash.charCodeAt(i) ^ hashBase64.charCodeAt(i);
    }
    return diff === 0;
}
