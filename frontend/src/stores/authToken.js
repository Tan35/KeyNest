/**
 * @description JWT 会话存储（localStorage），供 API / WebSocket 使用。
 */

const TOKEN_KEY = 'keynest_jwt';
const USER_KEY = 'keynest_user';

export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

export function setSession(token, user) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
    } catch {
        /* ignore */
    }
}

export function clearSession() {
    setSession('', null);
}

export function getStoredUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @description 带鉴权的 fetch；401 时触发全局事件。
 */
export async function authFetch(input, init = {}) {
    const headers = new Headers(init.headers || {});
    const token = getToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('keynest:unauthorized'));
    }
    return response;
}
