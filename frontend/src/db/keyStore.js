import { openDB } from 'idb';

const DB_NAME = 'api-key-manager';
const DB_VERSION = 2;

let dbPromise = null;

/**
 * @description 获取或创建 IndexedDB 数据库连接。
 * 使用 idb 库封装，返回 Promise<IDBDatabase>。
 */
function getDB() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, _oldVersion, _newVersion, transaction) {
                // keys store: 存储 API Key 信息
                if (!db.objectStoreNames.contains('keys')) {
                    const keyStore = db.createObjectStore('keys', { keyPath: 'id' });
                    keyStore.createIndex('provider', 'provider', { unique: false });
                    keyStore.createIndex('status', 'status', { unique: false });
                    keyStore.createIndex('createdAt', 'createdAt', { unique: false });
                    keyStore.createIndex('token', 'token', { unique: false });
                } else {
                    const keyStore = transaction.objectStore('keys');
                    if (!keyStore.indexNames.contains('token')) {
                        keyStore.createIndex('token', 'token', { unique: false });
                    }
                }

                // balanceSnapshots store: 余额历史快照
                if (!db.objectStoreNames.contains('balanceSnapshots')) {
                    const snapshotStore = db.createObjectStore('balanceSnapshots', { keyPath: 'id' });
                    snapshotStore.createIndex('keyId', 'keyId', { unique: false });
                    snapshotStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            },
        });
    }
    return dbPromise;
}

function normalizeToken(token) {
    return String(token || '').trim();
}

function buildKeyRecord(record, now, id = crypto.randomUUID()) {
    return {
        id,
        token: normalizeToken(record.token),
        alias: record.alias || '',
        provider: record.provider || 'openai',
        baseUrl: record.baseUrl || '',
        model: record.model || '',
        status: record.status || 'unknown',
        balance: record.balance ?? null,
        currency: record.currency ?? null,
        lastChecked: record.lastChecked || null,
        models: Array.isArray(record.models) ? record.models : [],
        modelsUpdatedAt: record.modelsUpdatedAt || null,
        tags: Array.isArray(record.tags) ? record.tags : [],
        createdAt: record.createdAt || now,
        updatedAt: record.updatedAt || now,
    };
}

async function getExistingTokenSet(db) {
    const keys = await db.getAll('keys');
    return new Set(keys.map(k => normalizeToken(k.token)).filter(Boolean));
}

// --- Key CRUD 操作 ---

/**
 * @description 添加一个新的 Key 记录。
 * @param {object} record - KeyRecord 对象（不含 id，由函数生成）。
 * @returns {Promise<object>} - 添加后的完整 KeyRecord（含 id）。
 */
export async function addKey(record) {
    const db = await getDB();
    const token = normalizeToken(record.token);
    if (!token) return null;
    const existing = await getKeyByToken(token);
    if (existing) return null;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const fullRecord = buildKeyRecord({ ...record, token }, now, id);
    await db.add('keys', fullRecord);
    return fullRecord;
}

/**
 * @description 批量添加多个 Key 记录。
 * @param {Array<object>} records - KeyRecord 对象数组。
 * @returns {Promise<Array<object>>} - 添加后的完整 KeyRecord 数组。
 */
export async function addKeys(records) {
    const db = await getDB();
    const now = new Date().toISOString();
    const existingTokens = await getExistingTokenSet(db);
    const seenTokens = new Set();
    const fullRecords = records
        .map(record => buildKeyRecord(record, now, record.id || crypto.randomUUID()))
        .filter(record => {
            if (!record.token || existingTokens.has(record.token) || seenTokens.has(record.token)) {
                return false;
            }
            seenTokens.add(record.token);
            return true;
        });

    const tx = db.transaction('keys', 'readwrite');
    for (const record of fullRecords) {
        tx.store.add(record);
    }
    await tx.done;
    return fullRecords;
}

/**
 * @description 更新一个 Key 记录。
 * @param {string} id - Key 的唯一 ID。
 * @param {object} updates - 要更新的字段。
 * @returns {Promise<object|null>} - 更新后的 KeyRecord，如果不存在则返回 null。
 */
export async function updateKey(id, updates) {
    const db = await getDB();
    const existing = await db.get('keys', id);
    if (!existing) return null;

    const updated = {
        ...existing,
        ...updates,
        id, // 确保 ID 不被覆盖
        updatedAt: new Date().toISOString(),
    };
    await db.put('keys', updated);
    return updated;
}

/**
 * @description 删除一个 Key 记录及其关联的余额快照。
 * @param {string} id - Key 的唯一 ID。
 */
export async function deleteKey(id) {
    const db = await getDB();
    const tx = db.transaction(['keys', 'balanceSnapshots'], 'readwrite');
    await tx.objectStore('keys').delete(id);

    // 删除关联的余额快照
    const snapshotIndex = tx.objectStore('balanceSnapshots').index('keyId');
    let cursor = await snapshotIndex.openCursor(IDBKeyRange.only(id));
    while (cursor) {
        cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
}

/**
 * @description 获取所有 Key 记录。
 * @returns {Promise<Array<object>>} - 所有 KeyRecord 数组。
 */
export async function getAllKeys() {
    const db = await getDB();
    return db.getAll('keys');
}

/**
 * @description 根据 ID 获取单个 Key 记录。
 * @param {string} id - Key 的唯一 ID。
 * @returns {Promise<object|undefined>} - KeyRecord 或 undefined。
 */
export async function getKeyById(id) {
    const db = await getDB();
    return db.get('keys', id);
}

/**
 * @description 根据 token 值查找 Key 记录。
 * @param {string} token - API Key 的值。
 * @returns {Promise<object|undefined>} - KeyRecord 或 undefined。
 */
export async function getKeyByToken(token) {
    const db = await getDB();
    const normalized = normalizeToken(token);
    if (!normalized) return undefined;
    const matches = await db.getAllFromIndex('keys', 'token', normalized);
    return matches[0];
}

export async function getKeysByToken(token) {
    const db = await getDB();
    const normalized = normalizeToken(token);
    if (!normalized) return [];
    return db.getAllFromIndex('keys', 'token', normalized);
}

// --- 余额快照操作 ---

/**
 * @description 添加一条余额快照记录。
 * @param {string} keyId - 关联的 Key ID。
 * @param {number} balance - 当时的余额。
 * @param {string} [currency='USD'] - 货币单位。
 * @returns {Promise<object>} - 添加后的快照记录。
 */
export async function addBalanceSnapshot(keyId, balance, currency = 'USD') {
    const db = await getDB();
    const snapshot = {
        id: crypto.randomUUID(),
        keyId,
        balance,
        currency,
        timestamp: new Date().toISOString(),
    };
    await db.add('balanceSnapshots', snapshot);
    return snapshot;
}

/**
 * @description 获取指定 Key 的所有余额快照。
 * @param {string} keyId - Key 的唯一 ID。
 * @returns {Promise<Array<object>>} - 余额快照数组（按时间升序）。
 */
export async function getBalanceSnapshots(keyId) {
    const db = await getDB();
    const snapshots = await db.getAllFromIndex('balanceSnapshots', 'keyId', keyId);
    return snapshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * @description 获取指定 Key 的最新一条余额快照。
 * @param {string} keyId - Key 的唯一 ID。
 * @returns {Promise<object|null>} - 最新快照或 null。
 */
export async function getLatestSnapshot(keyId) {
    const snapshots = await getBalanceSnapshots(keyId);
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

// --- 数据导入导出 ---

/**
 * @description 导出所有 Key 记录为 JSON 字符串。
 * @returns {Promise<string>} - JSON 字符串。
 */
export async function exportAllKeys() {
    const db = await getDB();
    const [keys, balanceSnapshots] = await Promise.all([
        db.getAll('keys'),
        db.getAll('balanceSnapshots'),
    ]);
    return JSON.stringify({ version: 2, keys, balanceSnapshots }, null, 2);
}

/**
 * @description 从 JSON 字符串导入 Key 记录。
 * @param {string} jsonStr - JSON 字符串。
 * @returns {Promise<number>} - 成功导入的数量。
 */
export async function importKeys(jsonStr) {
    const data = JSON.parse(jsonStr);
    const payload = Array.isArray(data)
        ? { keys: data, balanceSnapshots: [] }
        : { keys: Array.isArray(data?.keys) ? data.keys : (data ? [data] : []), balanceSnapshots: Array.isArray(data?.balanceSnapshots) ? data.balanceSnapshots : [] };

    const db = await getDB();
    const now = new Date().toISOString();
    const existingTokens = await getExistingTokenSet(db);
    const seenTokens = new Set();
    const idMap = new Map();
    const importedKeys = [];

    for (const rawRecord of payload.keys) {
        const record = buildKeyRecord(rawRecord, now, rawRecord?.id || crypto.randomUUID());
        if (!record.token || existingTokens.has(record.token) || seenTokens.has(record.token)) {
            continue;
        }
        seenTokens.add(record.token);
        idMap.set(rawRecord?.id, record.id);
        importedKeys.push(record);
    }

    const tx = db.transaction(['keys', 'balanceSnapshots'], 'readwrite');
    for (const record of importedKeys) {
        tx.objectStore('keys').add(record);
    }
    for (const snapshot of payload.balanceSnapshots) {
        const mappedKeyId = idMap.get(snapshot?.keyId);
        if (!mappedKeyId) continue;
        tx.objectStore('balanceSnapshots').add({
            id: snapshot?.id || crypto.randomUUID(),
            keyId: mappedKeyId,
            balance: snapshot.balance,
            currency: snapshot.currency || 'USD',
            timestamp: snapshot.timestamp || now,
        });
    }
    await tx.done;
    return importedKeys.length;
}
