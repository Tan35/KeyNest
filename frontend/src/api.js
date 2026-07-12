import regionsData from '../../config/regions.json';
import providersData from '../../config/providers.json';

/**
 * @description 区域数据，从配置文件加载。
 */
export const REGIONS = regionsData;
/**
 * @description 提供商数据，从配置文件加载。
 */
export const PROVIDERS = providersData;

/**
 * @description 调用后端 /models 接口，获取指定提供商的可用模型列表。
 * @param {string} token - 用于认证的 API Key。
 * @param {object} providerConfig - 提供商的配置信息，包含当前提供商、基础URL和区域。
 * @returns {Promise<string[]>} - 可用模型ID的数组。
 * @throws {Error} - 如果请求失败或返回无效数据。
 */
export async function fetchModels(token, providerConfig) {
    const body = {
        token,
        providerConfig: {
            provider: providerConfig.currentProvider,
            baseUrl: providerConfig.baseUrl,
            region: providerConfig.currentRegion,
        },
    };
    const response = await fetch('/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
        throw new Error(err.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}


/**
 * @description 旧数据兼容用的最小兜底文案归一化。
 * @param {object} res - API Key 检测的原始结果对象。
 * @returns {{category: string, simpleMessage: string}|null}
 */
function normalizeLegacyError(res) {
    const status = res.rawError?.status || 0;
    const lowerCaseMessage = (res.message || JSON.stringify(res.rawError) || '').toLowerCase();

    if (status === 429 || lowerCaseMessage.includes('rate limit') || lowerCaseMessage.includes('too many requests')) {
        return { category: 'rateLimit', simpleMessage: '请求频繁' };
    }
    if (lowerCaseMessage.includes("doesn't have a free quota tier")) {
        return { category: 'invalid', simpleMessage: '无免费额度' };
    }
    if (
        lowerCaseMessage.includes('insufficient') ||
        lowerCaseMessage.includes('quota') ||
        lowerCaseMessage.includes('balance') ||
        lowerCaseMessage.includes('billing') ||
        lowerCaseMessage.includes('paid') ||
        lowerCaseMessage.includes('top up') ||
        lowerCaseMessage.includes('recharge') ||
        lowerCaseMessage.includes('credit')
    ) {
        return { category: 'invalid', simpleMessage: '额度不足' };
    }
    if (lowerCaseMessage.includes('invalid_api_key') || lowerCaseMessage.includes('api key 无效') || status === 401) {
        return { category: 'invalid', simpleMessage: 'Key 无效' };
    }
    if (lowerCaseMessage.includes('terminated') || lowerCaseMessage.includes('banned')) {
        return { category: 'invalid', simpleMessage: '账号停用' };
    }
    if (lowerCaseMessage.includes('location') || lowerCaseMessage.includes('region') || lowerCaseMessage.includes('country')) {
        return { category: 'invalid', simpleMessage: '区域受限' };
    }
    if (lowerCaseMessage.includes('permission') || lowerCaseMessage.includes('forbidden')) {
        return { category: 'invalid', simpleMessage: '权限不足' };
    }
    if (lowerCaseMessage.includes('model') && (lowerCaseMessage.includes('not found') || lowerCaseMessage.includes('not supported') || lowerCaseMessage.includes('不可用'))) {
        return { category: 'invalid', simpleMessage: '模型不可用' };
    }

    return null;
}

/**
 * @description 根据 API Key 检测结果归类结果桶，并生成结果区短文案。
 * 优先使用后端返回的 errorCategory 和 message，前端仅保留最小兜底逻辑。
 * @param {object} res - API Key 检测的原始结果对象。
 * @returns {{category: string, simpleMessage: string}} - 包含分类和短文案的对象。
 */
export function categorizeTokenError(res) {
    if (!res || res.isValid) return { category: 'valid', simpleMessage: '有效' };

    if (res.errorCategory) {
        return {
            category: res.errorCategory === 'rate_limit' ? 'rateLimit' : 'invalid',
            simpleMessage: res.message || '验证失败'
        };
    }

    const legacyResult = normalizeLegacyError(res);
    if (legacyResult) {
        return legacyResult;
    }

    return { category: 'invalid', simpleMessage: res.message || '验证失败' };
}

/**
 * @description Backup Token 最短长度（与后端一致）。
 */
export const BACKUP_TOKEN_MIN_LENGTH = 16;

/**
 * @description 生成高强度 Backup Token（48 位 hex）。
 * @returns {string}
 */
export function generateBackupToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @description 调用云备份 API 时的统一错误提取。
 * @param {Response} response
 * @returns {Promise<Error>}
 */
async function backupApiError(response) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return new Error(err.error || `HTTP ${response.status}`);
}

/**
 * @description 上传 Key 保险箱备份到 Cloudflare（以 Backup Token 为身份）。
 * @param {string} backupToken
 * @param {object|string} exportData - exportAllKeys 的对象或 JSON 字符串
 * @returns {Promise<{ ok: boolean, updatedAt: string, keyCount: number }>}
 */
export async function uploadCloudBackup(backupToken, exportData) {
    const body = typeof exportData === 'string' ? exportData : JSON.stringify(exportData);
    const response = await fetch('/api/backup', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${backupToken}`,
        },
        body,
    });
    if (!response.ok) throw await backupApiError(response);
    return response.json();
}

/**
 * @description 从云端下载备份。
 * @param {string} backupToken
 * @returns {Promise<{ updatedAt: string|null, keyCount: number, data: object }>}
 */
export async function downloadCloudBackup(backupToken) {
    const response = await fetch('/api/backup', {
        method: 'GET',
        headers: { Authorization: `Bearer ${backupToken}` },
    });
    if (!response.ok) throw await backupApiError(response);
    return response.json();
}

/**
 * @description 查询云端备份元信息（不含密钥内容）。
 * @param {string} backupToken
 * @returns {Promise<{ exists: boolean, updatedAt: string|null, keyCount: number }>}
 */
export async function fetchCloudBackupMeta(backupToken) {
    const response = await fetch('/api/backup?meta=1', {
        method: 'GET',
        headers: { Authorization: `Bearer ${backupToken}` },
    });
    if (!response.ok) throw await backupApiError(response);
    return response.json();
}

/**
 * @description 删除云端备份。
 * @param {string} backupToken
 * @returns {Promise<{ ok: boolean }>}
 */
export async function deleteCloudBackup(backupToken) {
    const response = await fetch('/api/backup', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${backupToken}` },
    });
    if (!response.ok) throw await backupApiError(response);
    return response.json();
}

