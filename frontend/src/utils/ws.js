/**
 * @description WebSocket 连接工具。
 *
 * 页面经 Vercel 等反向代理访问时，HTTP 可转发，但 WebSocket 升级经常失败。
 * 此时应直连 Cloudflare Worker 域名（workers.dev）。
 */

/**
 * 实际 Worker 的 host（与 wrangler name + 账户 subdomain 对应）。
 * 仅用于「页面域名 ≠ Worker 域名」时的 WS 回退。
 */
export const WORKER_WS_HOST = 'api-check.1486973169tan.workers.dev';

/**
 * @description 是否应优先直连 Worker（跳过当前页 host 的 WS）。
 * Vercel / 已知反代域名下，same-origin WS 通常不可用。
 * @returns {boolean}
 */
export function shouldPreferDirectWorkerWs() {
    const host = window.location.hostname.toLowerCase();
    if (host === WORKER_WS_HOST || host.endsWith('.workers.dev')) return false;
    // Vercel 默认域、以及当前自定义反代域
    if (host.endsWith('.vercel.app')) return true;
    if (host === 'keynest.tanxy.club' || host.endsWith('.tanxy.club')) return true;
    return false;
}

/**
 * @description 构造 /check WebSocket URL（带 JWT）。
 * @param {string} token - JWT
 * @param {string} [host] - 覆盖 host
 * @returns {string}
 */
export function buildCheckWebSocketUrl(token, host = window.location.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${protocol}//${host}/check${q}`;
}

/**
 * @description 返回按优先级排序的候选 WS URL（去重）。
 * @param {string} token
 * @returns {string[]}
 */
export function getCheckWebSocketCandidates(token) {
    const same = buildCheckWebSocketUrl(token, window.location.host);
    const direct = buildCheckWebSocketUrl(token, WORKER_WS_HOST);
    if (shouldPreferDirectWorkerWs()) {
        return same === direct ? [direct] : [direct, same];
    }
    return same === direct ? [same] : [same, direct];
}

/**
 * @description 依次尝试候选地址，建立可用的 WebSocket。
 * @param {string} token - JWT
 * @param {number} [timeoutMs=8000] - 单次连接超时
 * @returns {Promise<WebSocket>}
 */
export function openCheckWebSocket(token, timeoutMs = 8000) {
    const candidates = getCheckWebSocketCandidates(token);

    return new Promise((resolve, reject) => {
        let index = 0;
        let settled = false;
        /** @type {WebSocket|null} */
        let current = null;

        const failAll = (err) => {
            if (settled) return;
            settled = true;
            reject(err || new Error('WebSocket connection failed'));
        };

        const tryNext = () => {
            if (settled) return;
            if (index >= candidates.length) {
                failAll(new Error('WebSocket connection failed'));
                return;
            }

            const url = candidates[index++];
            let opened = false;
            let timer = null;

            try {
                current = new WebSocket(url);
            } catch (e) {
                tryNext();
                return;
            }

            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            timer = setTimeout(() => {
                cleanup();
                try {
                    current?.close();
                } catch {
                    /* ignore */
                }
                if (!opened) tryNext();
            }, timeoutMs);

            current.onopen = () => {
                opened = true;
                cleanup();
                if (settled) {
                    try {
                        current.close();
                    } catch {
                        /* ignore */
                    }
                    return;
                }
                settled = true;
                // 清除临时 handler，交给调用方
                current.onopen = null;
                current.onerror = null;
                current.onclose = null;
                resolve(current);
            };

            current.onerror = () => {
                cleanup();
                if (opened || settled) return;
                try {
                    current?.close();
                } catch {
                    /* ignore */
                }
                tryNext();
            };

            current.onclose = () => {
                cleanup();
                if (opened || settled) return;
                tryNext();
            };
        };

        tryNext();
    });
}
