import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as db from '@/db/keyStore';

/**
 * @description keyManager Store 用于管理已保存的 API Key 的持久化存储、搜索、筛选和操作。
 */
export const useKeyManagerStore = defineStore('keyManager', () => {
    // --- 状态 ---
    /** @type {Ref<Array<object>>} 所有已保存的 Key 记录。*/
    const keys = ref([]);
    /** @type {Ref<boolean>} 是否正在加载数据。*/
    const isLoading = ref(false);
    /** @type {Ref<string>} 搜索关键词。*/
    const searchTerm = ref('');
    /** @type {Ref<string|null>} 按平台筛选。null 表示全部。*/
    const filterProvider = ref('');
    /** @type {Ref<string|null>} 按状态筛选。null 表示全部。*/
    const filterStatus = ref('');
    /** @type {Ref<string>} 排序字段。*/
    const sortBy = ref('createdAt');
    /** @type {Ref<string>} 排序方向。*/
    const sortDir = ref('desc');
    /** @type {Ref<string|null>} 当前选中的 Key ID（用于详情面板）。*/
    const selectedKeyId = ref(null);
    /** @type {Ref<boolean>} 当前视图是否为管理面板。*/
    const showManager = ref(false);

    // --- 余额历史临时缓存 ---
    /** @type {Ref<Array<object>>} 当前选中 Key 的余额历史。*/
    const balanceHistory = ref([]);

    // --- 计算属性 ---

    /** @type {ComputedRef<Array<object>>} 筛选和排序后的 Key 列表。*/
    const filteredKeys = computed(() => {
        let result = [...keys.value];

        // 搜索过滤
        if (searchTerm.value) {
            const term = searchTerm.value.toLowerCase();
            result = result.filter(k =>
                k.token.toLowerCase().includes(term) ||
                k.alias.toLowerCase().includes(term) ||
                k.provider.toLowerCase().includes(term) ||
                k.tags.some(t => t.toLowerCase().includes(term))
            );
        }

        // 平台过滤
        if (filterProvider.value && filterProvider.value !== '') {
            result = result.filter(k => k.provider === filterProvider.value);
        }

        // 状态过滤
        if (filterStatus.value && filterStatus.value !== '') {
            result = result.filter(k => k.status === filterStatus.value);
        }

        // 排序
        result.sort((a, b) => {
            let aVal = a[sortBy.value];
            let bVal = b[sortBy.value];

            // 日期字段
            if (sortBy.value === 'createdAt' || sortBy.value === 'lastChecked' || sortBy.value === 'updatedAt') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            // 余额字段
            if (sortBy.value === 'balance') {
                aVal = aVal ?? -Infinity;
                bVal = bVal ?? -Infinity;
            }

            // 字符串字段
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return sortDir.value === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDir.value === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    });

    /** @type {ComputedRef<object>} 按平台分组的统计。*/
    const stats = computed(() => {
        const total = keys.value.length;
        const byStatus = { valid: 0, invalid: 0, rateLimit: 0, unknown: 0 };
        const byProvider = {};

        for (const k of keys.value) {
            byStatus[k.status] = (byStatus[k.status] || 0) + 1;
            byProvider[k.provider] = (byProvider[k.provider] || 0) + 1;
        }

        return { total, byStatus, byProvider };
    });

    /** @type {ComputedRef<object|null>} 当前选中的 Key 记录。*/
    const selectedKey = computed(() => {
        if (!selectedKeyId.value) return null;
        return keys.value.find(k => k.id === selectedKeyId.value) || null;
    });

    // --- 动作 ---

    /**
     * @description 从 IndexedDB 加载所有 Key 到内存。
     */
    async function loadKeys() {
        isLoading.value = true;
        try {
            keys.value = await db.getAllKeys();
        } catch (err) {
            console.error('Failed to load keys:', err);
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * @description 添加单个 Key。
     * @param {object} record - KeyRecord 数据。
     * @returns {Promise<object>} - 添加后的完整记录。
     */
    async function addKey(record) {
        const added = await db.addKey(record);
        if (!added) return null;
        keys.value = [...keys.value, added];
        return added;
    }

    /**
     * @description 批量添加 Key（从文本粘贴或文件导入）。
     * @param {Array<object>} records - KeyRecord 数组。
     * @returns {Promise<number>} - 成功添加的数量。
     */
    async function addKeysBatch(records) {
        const added = await db.addKeys(records);
        keys.value = [...keys.value, ...added];
        return added.length;
    }

    /**
     * @description 更新 Key 的部分字段。
     * @param {string} id - Key ID。
     * @param {object} updates - 要更新的字段。
     */
    async function updateKey(id, updates) {
        const updated = await db.updateKey(id, updates);
        if (updated) {
            keys.value = keys.value.map(k => k.id === id ? updated : k);
        }
    }

    /**
     * @description 删除单个 Key。
     * @param {string} id - Key ID。
     */
    async function deleteKey(id) {
        await db.deleteKey(id);
        keys.value = keys.value.filter(k => k.id !== id);
        if (selectedKeyId.value === id) {
            selectedKeyId.value = null;
        }
    }

    /**
     * @description 批量删除选中的 Key。
     * @param {Array<string>} ids - Key ID 数组。
     */
    async function deleteKeysBatch(ids) {
        for (const id of ids) {
            await db.deleteKey(id);
        }
        keys.value = keys.value.filter(k => !ids.includes(k.id));
        if (ids.includes(selectedKeyId.value)) {
            selectedKeyId.value = null;
        }
    }

    /**
     * @description 更新 Key 的检测结果（从检测流程调用）。
     * @param {string} token - API Key 值。
     * @param {object} result - 检测结果。
     */
    async function updateKeyFromCheck(token, result) {
        const keyRecords = keys.value.filter(k => k.token === token);
        if (keyRecords.length === 0) return;

        const updates = {
            status: result.isValid ? 'valid' : (result.errorCategory === 'rate_limit' ? 'rateLimit' : 'invalid'),
            lastChecked: new Date().toISOString(),
        };

        // 如果有余额信息，更新余额
        if (result.isValid && result.balance !== undefined && result.balance !== -1) {
            updates.balance = result.balance;
            updates.currency = result.currency || 'USD';
        }

        for (const keyRecord of keyRecords) {
            if (updates.balance !== undefined) {
                await db.addBalanceSnapshot(keyRecord.id, result.balance, result.currency || 'USD');
            }
            await updateKey(keyRecord.id, updates);
        }
    }

    /**
     * @description 获取 Key 的余额历史。
     * @param {string} keyId - Key ID。
     */
    async function loadBalanceHistory(keyId) {
        balanceHistory.value = await db.getBalanceSnapshots(keyId);
    }

    /**
     * @description 更新 Key 的可用模型列表。
     * @param {string} id - Key ID。
     * @param {Array<string>} models - 模型 ID 数组。
     */
    async function updateKeyModels(id, models) {
        await updateKey(id, {
            models,
            modelsUpdatedAt: new Date().toISOString(),
        });
    }

    /**
     * @description 给 Key 添加标签。
     * @param {string} id - Key ID。
     * @param {string} tag - 标签。
     */
    async function addTag(id, tag) {
        const key = keys.value.find(k => k.id === id);
        if (!key || key.tags.includes(tag)) return;
        await updateKey(id, { tags: [...key.tags, tag] });
    }

    /**
     * @description 移除 Key 的标签。
     * @param {string} id - Key ID。
     * @param {string} tag - 标签。
     */
    async function removeTag(id, tag) {
        const key = keys.value.find(k => k.id === id);
        if (!key) return;
        await updateKey(id, { tags: key.tags.filter(t => t !== tag) });
    }

    /**
     * @description 导出所有 Key 为 JSON。
     * @returns {Promise<string>} - JSON 字符串。
     */
    async function exportKeys() {
        return db.exportAllKeys();
    }

    /**
     * @description 从 JSON 导入 Key。
     * @param {string} jsonStr - JSON 字符串。
     * @returns {Promise<number>} - 导入数量。
     */
    async function importKeys(jsonStr) {
        const count = await db.importKeys(jsonStr);
        await loadKeys(); // 重新加载
        return count;
    }

    /**
     * @description 选中一个 Key。
     * @param {string} id - Key ID。
     */
    function selectKey(id) {
        selectedKeyId.value = id;
    }

    /**
     * @description 切换显示管理面板。
     */
    function toggleManager() {
        showManager.value = !showManager.value;
    }

    /**
     * @description 清除所有筛选条件。
     */
    function clearFilters() {
        searchTerm.value = '';
        filterProvider.value = '';
        filterStatus.value = '';
    }

    return {
        // 状态
        keys,
        isLoading,
        searchTerm,
        filterProvider,
        filterStatus,
        sortBy,
        sortDir,
        selectedKeyId,
        showManager,
        balanceHistory,

        // 计算属性
        filteredKeys,
        stats,
        selectedKey,

        // 动作
        loadKeys,
        addKey,
        addKeysBatch,
        updateKey,
        deleteKey,
        deleteKeysBatch,
        updateKeyFromCheck,
        loadBalanceHistory,
        updateKeyModels,
        addTag,
        removeTag,
        exportKeys,
        importKeys,
        selectKey,
        toggleManager,
        clearFilters,
    };
});
