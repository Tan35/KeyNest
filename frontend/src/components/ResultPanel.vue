<template>
    <div class="results-panel t-panel-slide" :class="{ active: resultsStore.activeTab === category }"
        :data-open="resultsStore.activeTab === category ? 'true' : 'false'">
        <div class="panel-header" v-show="results.length > 0">
            <span class="results-title">{{ tabName }} KEY</span>
            <div class="panel-actions">
                <div class="custom-select" v-if="sortable" :class="{ open: uiStore.sortDropdownOpen[category] }"
                    ref="sortSelectWrapper">
                    <div class="custom-select-trigger" @click="toggleSortDropdown"
                        role="combobox"
                        aria-haspopup="listbox"
                        :aria-expanded="uiStore.sortDropdownOpen[category]"
                        :aria-label="t('ariaSort')">
                        <span>{{ currentSortOption.text }}</span>
                        <span class="arrow"></span>
                    </div>
                    <div class="custom-options t-dropdown" data-origin="top-right"
                        :class="{ 'is-open': uiStore.sortDropdownOpen[category], 'is-closing': sortDropdownClosing }"
                        role="listbox" :aria-label="t('ariaSortOptions')">
                        <span v-for="option in sortOptions" :key="option.value" class="custom-option"
                            :class="{ selected: option.value === resultsStore.sortState[category] }"
                            @click="setSort(option.value)"
                            role="option"
                            :aria-selected="option.value === resultsStore.sortState[category]">{{ option.text }}</span>
                    </div>
                </div>
                <button class="copy-btn" @click="copyTokens(category, tabName)">{{ t('btnCopy') }}</button>
            </div>
        </div>
        <input type="search" class="search-input" v-model="searchTerm" :placeholder="t('placeholderSearch')"
            v-show="results.length > 0"
            :aria-label="t('placeholderSearch')">
        <div class="results-content">
            <DynamicScroller
                v-if="sortedResultsForCategory && sortedResultsForCategory.length > 0"
                ref="scrollerRef"
                class="scroller"
                :items="sortedResultsForCategory"
                :min-item-size="34"
                key-field="id"
            >
                <template v-slot="{ item: result, index, active }">
                    <DynamicScrollerItem
                        :item="result"
                        :active="active"
                        :size-dependencies="[
                            result.displayText,
                        ]"
                        :data-index="index"
                    >
                        <div class="result-line" :data-token="result.token">
                            <span class="key-text" v-html="result.displayText"></span>
                            <div class="result-line-actions">
                                <button v-if="result.details" class="view-details-btn"
                                    @click="uiStore.openModal('details', result.details)">{{ t('btnDetails') }}</button>
                                <button v-if="category === 'valid'" class="get-models-btn"
                                    @click="handleFetchModelsForToken(result.token, $event)">{{ t('btnModels') }}</button>
                                <button class="copy-key-btn" @click="copySingleToken(result.token, $event)">{{ t('btnCopy') }}</button>
                            </div>
                        </div>
                    </DynamicScrollerItem>
                </template>
            </DynamicScroller>
            
            <div v-else class="empty-state">
                <svg class="empty-icon" width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <g transform="translate(5 5) scale(1.75)">
                        <path d="M17 17L21 21"></path>
                        <path d="M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z"></path>
                    </g>
                </svg>
                <p>{{ t('emptyState') }}</p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';
import { useResultsStore } from '@/stores/results';
import { useUiStore } from '@/stores/ui';
import { useConfigStore } from '@/stores/config';
import { fetchModels } from '@/api';
import { t, currentLang } from '@/i18n';

const props = defineProps({
    category: { type: String, required: true },
    title: { type: String, required: true },
    sortable: { type: Boolean, default: false },
});

const resultsStore = useResultsStore();
const uiStore = useUiStore();
const configStore = useConfigStore();

/** 标签 ID 到 i18n key 的映射 */
const TAB_I18N_KEYS = {
    valid:       'tabValid',
    lowBalance:  'tabLowBalance',
    zeroBalance: 'tabZeroBalance',
    rateLimit:   'tabRateLimit',
    invalid:     'tabInvalid',
    duplicate:   'tabDuplicate',
};

/** 当前面板的翻译名称（响应式，随语言切换更新） */
const tabName = computed(() => {
    void currentLang.value;
    return t(TAB_I18N_KEYS[props.category] || props.category);
});

const sortSelectWrapper = ref(null);
const scrollerRef = ref(null);
const sortDropdownClosing = ref(false);
let sortDropdownCloseTimer = null;
const results = computed(() => resultsStore.results[props.category]);

const sortedResultsForCategory = computed(() => {
    const data = resultsStore.results[props.category] || [];
    const searchTerm = resultsStore.searchTerms[props.category]?.toLowerCase() || '';
    const sortKey = resultsStore.sortState[props.category];

    let filtered;
    if (!searchTerm) {
        filtered = data;
    } else {
        filtered = data.filter(r =>
            r.token.toLowerCase().includes(searchTerm) ||
            r.displayText.toLowerCase().includes(searchTerm)
        );
    }

    if (!sortKey || sortKey === 'default') {
        return [...filtered].sort((a, b) => a.order - b.order);
    }

    return [...filtered].sort((a, b) => {
        const balanceA = a.balance ?? -Infinity;
        const balanceB = b.balance ?? -Infinity;
        return sortKey === 'balance-desc' ? balanceB - balanceA : balanceA - balanceB;
    });
});

const searchTerm = computed({
    get: () => resultsStore.searchTerms[props.category],
    set: (value) => { resultsStore.searchTerms[props.category] = value; }
});

/** 排序选项（响应式，随语言切换更新） */
const sortOptions = computed(() => {
    void currentLang.value;
    return [
        { value: 'default',      text: t('sortDefault') },
        { value: 'balance-desc', text: t('sortBalanceDesc') },
        { value: 'balance-asc',  text: t('sortBalanceAsc') },
    ];
});

const currentSortOption = computed(() => {
    return sortOptions.value.find(opt => opt.value === resultsStore.sortState[props.category]) || sortOptions.value[0];
});

const getDropdownCloseMs = () => {
    try {
        const raw = getComputedStyle(document.documentElement)
            .getPropertyValue('--dropdown-close-dur')
            .trim();
        if (!raw) return 150;
        if (raw.endsWith('ms')) return parseFloat(raw) || 150;
        if (raw.endsWith('s')) return (parseFloat(raw) || 0.15) * 1000;
        return parseFloat(raw) || 150;
    } catch {
        return 150;
    }
};

const openSortDropdown = () => {
    if (sortDropdownCloseTimer) {
        clearTimeout(sortDropdownCloseTimer);
        sortDropdownCloseTimer = null;
    }
    sortDropdownClosing.value = false;
    uiStore.sortDropdownOpen[props.category] = true;
};

const closeSortDropdown = () => {
    if (!uiStore.sortDropdownOpen[props.category] && !sortDropdownClosing.value) return;
    uiStore.sortDropdownOpen[props.category] = false;
    sortDropdownClosing.value = true;
    if (sortDropdownCloseTimer) {
        clearTimeout(sortDropdownCloseTimer);
    }
    sortDropdownCloseTimer = setTimeout(() => {
        sortDropdownClosing.value = false;
        sortDropdownCloseTimer = null;
    }, getDropdownCloseMs());
};

const toggleSortDropdown = () => {
    if (uiStore.sortDropdownOpen[props.category]) {
        closeSortDropdown();
    } else {
        openSortDropdown();
    }
};

const setSort = (value) => {
    resultsStore.setSort(props.category, value);
    closeSortDropdown();
};

const closeDropdown = (e) => {
    if (sortSelectWrapper.value && !sortSelectWrapper.value.contains(e.target)) {
        closeSortDropdown();
    }
};

const copyTokens = (category, title) => {
    const tokensToCopy = sortedResultsForCategory.value.map(r => r.token);
    if (tokensToCopy.length === 0) {
        uiStore.showToast(t('toastNoCopy', { title }), "warning");
        return;
    }
    navigator.clipboard.writeText(tokensToCopy.join("\n")).then(() => {
        uiStore.showToast(t('toastCopied', { title, count: tokensToCopy.length }), "success");
    }).catch((err) => {
        console.error('Copy failed:', err);
        uiStore.showToast(t('toastCopyFailed'), "error");
    });
};

const copySingleToken = (token, event) => {
    const btn = event.target.closest('button');
    const originalContent = btn.innerHTML;
    navigator.clipboard.writeText(token).then(() => {
        btn.textContent = t('btnCopied');
        setTimeout(() => { btn.innerHTML = originalContent; }, 1500);
    }).catch((err) => {
        console.error('Copy failed:', err);
        btn.textContent = t('btnCopyFailed');
        setTimeout(() => { btn.innerHTML = originalContent; }, 1500);
    });
};

const handleFetchModelsForToken = async (token, event) => {
    const button = event.target.closest('button');
    const originalContent = button.innerHTML;
    button.innerHTML = '<span class="loader"></span>';
    button.disabled = true;
    try {
        const providerConfigForFetch = {
            currentProvider: configStore.currentProvider,
            baseUrl: configStore.getCurrentProviderConfig().baseUrl,
            currentRegion: configStore.currentRegion,
        };
        
        const models = await fetchModels(token, providerConfigForFetch);
        
        if (models && models.length > 0) {
            uiStore.openModal('modelSelector', { models });
        } else {
            uiStore.showToast(t('toastNoModelList'), "warning");
        }
    } catch (error) {
        uiStore.showToast(t('toastFetchModelsFailed', { msg: error.message }), "error");
    } finally {
        button.innerHTML = originalContent;
        button.disabled = false;
    }
};

onMounted(() => {
    document.addEventListener('click', closeDropdown);
});

onBeforeUnmount(() => {
    document.removeEventListener('click', closeDropdown);
    if (sortDropdownCloseTimer) {
        clearTimeout(sortDropdownCloseTimer);
        sortDropdownCloseTimer = null;
    }
});

watch(
    () => resultsStore.activeTab,
    (newTab) => {
        if (newTab === props.category && scrollerRef.value) {
            nextTick(() => {
                scrollerRef.value.forceUpdate && scrollerRef.value.forceUpdate();
            });
        }
    }
);
</script>

<style scoped>
    /* 结果面板基础样式 */
    .results-panel {
        --panel-translate-y: 10px;
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    .results-panel.active {
        z-index: 1;
    }

    /* 面板头部样式 */
    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 8px 12px 10px;
        flex-wrap: wrap;
        box-shadow: inset 0 -1px 0 0 var(--border-color);
    }

    .results-title {
        font-size: 13px;
        font-weight: 500;
        font-family: var(--font-sans);
        color: var(--text-secondary);
        white-space: nowrap;
    }

    .panel-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    /* 搜索输入框样式 */
    .search-input {
        width: calc(100% - 16px);
        margin: 10px 8px;
        height: 36px;
        border-radius: var(--radius-md);
    }

    /* 结果内容区域 */
    .results-content {
        background: var(--bg-surface);
        border-radius: var(--radius-md);
        overflow-y: auto;
        flex: 1;
        margin: 0;
        box-shadow: var(--shadow-light-ring);
    }

    /* 确保 scroller 本身填满其容器 */
    .scroller {
        height: 100%;
        width: 100%;
    }

    /* 单个结果行样式 */
    .result-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 8px;
        min-height: 36px;
        width: 100%;
        box-sizing: border-box;
        border-radius: var(--radius-md);
        transition: background-color var(--transition-fast);
        font-family: var(--font-sans);
        font-size: 12px;
        color: var(--text-primary);
    }

    .result-line:hover {
        background-color: var(--bg-selected);
    }

    .key-text {
        word-break: break-all;
        padding-right: 12px;
        white-space: normal;
        line-height: 1.4;
        font-family: var(--font-mono);
    }

    :deep(.key-text .message) {
        color: var(--text-secondary);
        margin-left: 4px;
        font-family: var(--font-sans);
    }

    :deep(.key-text .balance-high) {
        color: var(--accent-success);
        font-weight: 600;
    }

    :deep(.key-text .balance-medium) {
        color: var(--accent-warning);
        font-weight: 600;
    }

    :deep(.key-text .balance-low) {
        color: var(--accent-error);
        font-weight: 600;
    }

    .result-line-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        align-self: center;
        flex-shrink: 0;
    }

    /* 结果行操作按钮 */
    .copy-key-btn,
    .get-models-btn,
    .view-details-btn {
        min-width: 38px;
        height: 26px;
        background: var(--bg-surface);
        box-shadow: var(--shadow-light-ring);
        cursor: pointer;
        font-size: 12px;
        padding: 0 7px;
        border-radius: var(--radius-sm);
        flex-shrink: 0;
        opacity: 0;
        color: var(--text-secondary);
        transition: all var(--transition-fast);
        line-height: 1;
    }

    .result-line:hover .copy-key-btn,
    .result-line:hover .get-models-btn,
    .result-line:hover .view-details-btn {
        opacity: 1;
    }

    .copy-key-btn:hover,
    .get-models-btn:hover,
    .view-details-btn:hover {
        color: var(--text-primary);
        background: var(--bg-secondary);
    }

    .view-details-btn:hover {
        color: var(--accent-info);
    }

    /* 空状态提示 */
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: var(--text-tertiary);
        height: 100%;
    }

    .empty-state .empty-icon {
        margin-bottom: 14px;
        opacity: 0.3;
    }

    /* 复制按钮 */
    .copy-btn {
        padding: 0 12px;
        background: var(--bg-surface);
        color: var(--text-primary);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        font-family: var(--font-sans);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        height: 30px;
        box-shadow: var(--shadow-light-ring);
    }

    .copy-btn:hover {
        background: var(--bg-secondary);
    }

    /* 自定义选择器（排序） */
    .custom-select {
        position: relative;
        width: 104px;
        font-size: 13px;
        height: 30px;
    }

    .custom-select-trigger {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        background: var(--bg-surface);
        box-shadow: var(--shadow-light-ring);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: var(--font-sans);
    }

    .custom-select-trigger:hover {
        background: var(--bg-secondary);
    }

    .custom-select.open .custom-select-trigger {
        box-shadow: var(--shadow-light-ring);
        background: var(--bg-secondary);
    }

    .custom-select-trigger .arrow {
        width: 8px;
        height: 8px;
        border-left: 2px solid var(--text-tertiary);
        border-bottom: 2px solid var(--text-tertiary);
        transform: rotate(-45deg);
        transition: transform 0.2s ease;
    }

    .custom-select.open .arrow {
        transform: rotate(135deg);
    }

    .custom-options {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--bg-surface);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-medium);
        z-index: 10;
    }

    .custom-option {
        padding: 8px 10px;
        cursor: pointer;
        transition: background-color 0.2s ease;
        display: block;
        font-family: var(--font-sans);
    }

    .custom-option:hover {
        background-color: var(--bg-tertiary);
    }

    .custom-option.selected {
        background-color: var(--bg-selected);
        color: var(--text-primary);
        font-weight: 500;
    }

    @media (max-width: 768px) {
        .result-line-actions button {
            padding: 0 8px;
            min-width: 44px;
            min-height: 44px;
            opacity: 1;
        }
    }
</style>
