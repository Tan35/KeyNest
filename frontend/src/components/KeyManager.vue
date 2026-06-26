<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useKeyManagerStore } from '@/stores/keyManager';
import { useUiStore } from '@/stores/ui';
import { useConfigStore } from '@/stores/config';
import KeyCard from './KeyCard.vue';
import CustomSelect from './CustomSelect.vue';
import { t, currentLang } from '@/i18n';

const keyManager   = useKeyManagerStore();
const uiStore      = useUiStore();
const configStore  = useConfigStore();

const addModalOpen   = ref(false);
const newKeyText     = ref('');
const newKeyAlias    = ref('');
const newKeyProvider = ref('openai');
const importProvider = ref('openai');
const newKeyBaseUrl  = ref('');
const newKeyModel    = ref('');
const selectedIds    = ref(new Set());
const selectAll      = ref(false);
const showImportExport = ref(false);
const importText     = ref('');

watch(newKeyProvider, (val) => {
    const p = configStore.providers[val];
    if (p) {
        newKeyBaseUrl.value = p.defaultBase || '';
        newKeyModel.value   = p.defaultModel || '';
    }
}, { immediate: true });

function openAddModal() {
    newKeyText.value     = '';
    newKeyAlias.value    = '';
    newKeyProvider.value = 'openai';
    addModalOpen.value   = true;
}

const providerOptions = computed(() =>
    Object.entries(configStore.providers).map(([key, val]) => ({ key, label: val.label }))
);

const filterProviderOptions = computed(() => {
    void currentLang.value;
    const options = [{ key: '', label: t('filterAllProviders') }];
    for (const [key, val] of Object.entries(configStore.providers)) {
        options.push({ key, label: val.label });
    }
    return options;
});

const filterStatusOptions = computed(() => {
    void currentLang.value;
    return [
        { key: '',           label: t('filterAllStatus') },
        { key: 'valid',      label: t('statusValid') },
        { key: 'invalid',    label: t('statusInvalid') },
        { key: 'rateLimit',  label: t('statusRateLimit') },
        { key: 'unknown',    label: t('statusUnknown') },
    ];
});

const sortOptionsForSelect = computed(() => {
    void currentLang.value;
    return [
        { key: 'createdAt',   label: t('sortPrefix') + t('sortCreatedAt') },
        { key: 'lastChecked', label: t('sortPrefix') + t('sortLastChecked') },
        { key: 'balance',     label: t('sortPrefix') + t('sortBalance') },
        { key: 'provider',    label: t('sortPrefix') + t('sortProvider') },
    ];
});

onMounted(() => { keyManager.loadKeys(); });

async function handleAddKey() {
    const token = newKeyText.value.trim();
    if (!token) { uiStore.showToast(t('toastPleaseEnterKey'), 'warning'); return; }
    const existing = keyManager.keys.find(k => k.token === token);
    if (existing) { uiStore.showToast(t('toastKeyExists'), 'warning'); return; }
    const added = await keyManager.addKey({
        token,
        alias:    newKeyAlias.value.trim(),
        provider: newKeyProvider.value,
        baseUrl:  newKeyBaseUrl.value.trim() || configStore.providers[newKeyProvider.value]?.defaultBase || '',
        model:    newKeyModel.value.trim()   || configStore.providers[newKeyProvider.value]?.defaultModel || '',
    });
    if (!added) { uiStore.showToast(t('toastKeyExists'), 'warning'); return; }
    newKeyText.value = newKeyAlias.value = newKeyBaseUrl.value = newKeyModel.value = '';
    addModalOpen.value = false;
    uiStore.showToast(t('toastKeyAdded'), 'success');
}

async function handleBatchImport() {
    const raw = importText.value.trim();
    if (!raw) { uiStore.showToast(t('toastNoValidKey'), 'warning'); return; }

    try {
        let count = 0;
        if (raw.startsWith('[') || raw.startsWith('{')) {
            count = await keyManager.importKeys(raw);
        } else {
            const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) { uiStore.showToast(t('toastNoValidKey'), 'warning'); return; }
            const records = lines.map(token => ({
                token,
                provider: importProvider.value,
                baseUrl:  configStore.providers[importProvider.value]?.defaultBase || '',
                model:    configStore.providers[importProvider.value]?.defaultModel || '',
            }));
            count = await keyManager.addKeysBatch(records);
        }

        if (count === 0) {
            uiStore.showToast(t('toastNoNewKeys'), 'warning');
            return;
        }

        importText.value = '';
        showImportExport.value = false;
        uiStore.showToast(t('toastImportedCount', { count }), 'success');
    } catch (err) {
        uiStore.showToast(t('toastImportFailed', { msg: err.message || '' }), 'error');
    }
}

function toggleSelect(id) {
    if (selectedIds.value.has(id)) selectedIds.value.delete(id);
    else selectedIds.value.add(id);
    selectedIds.value = new Set(selectedIds.value);
    selectAll.value = selectedIds.value.size === keyManager.filteredKeys.length;
}

function toggleSelectAll() {
    if (selectAll.value) selectedIds.value = new Set();
    else selectedIds.value = new Set(keyManager.filteredKeys.map(k => k.id));
    selectAll.value = !selectAll.value;
}

async function handleBatchDelete() {
    if (selectedIds.value.size === 0) { uiStore.showToast(t('toastSelectFirst'), 'warning'); return; }
    const confirmed = await uiStore.showConfirmation(
        t('batchSelected', { count: selectedIds.value.size })
    );
    if (confirmed) {
        await keyManager.deleteKeysBatch([...selectedIds.value]);
        selectedIds.value = new Set();
        selectAll.value = false;
        uiStore.showToast(t('toastDeleted'), 'success');
    }
}

async function handleExport() {
    const json = await keyManager.exportKeys();
    try {
        await navigator.clipboard.writeText(json);
        uiStore.showToast(t('toastCopiedClipboard'), 'success');
    } catch {
        showImportExport.value = true;
        importText.value = json;
        uiStore.showToast(t('toastManualCopy'), 'info');
    }
}

async function handleDeleteKey(id) {
    await keyManager.deleteKey(id);
    selectedIds.value.delete(id);
    selectedIds.value = new Set(selectedIds.value);
    uiStore.showToast(t('toastDeleted'), 'success');
}

function openDetail(id) {
    keyManager.selectKey(id);
    uiStore.openModal('keyDetail', { keyId: id });
}

watch(() => keyManager.filteredKeys.length, () => {
    selectAll.value = false;
    selectedIds.value = new Set();
});
</script>

<template>
    <div class="key-manager">

        <!-- ── Toolbar ── -->
        <div class="km-toolbar">
            <div class="km-toolbar-left">
                <button @click="openAddModal" class="km-btn primary">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path d="M7 2v10M2 7h10"/>
                    </svg>
                    {{ t('btnAddKey') }}
                </button>
                <button @click="showImportExport = !showImportExport" class="km-btn">
                    {{ t('btnImportExport') }}
                </button>
            </div>
            <span class="km-count">{{ t('kmCount', { filtered: keyManager.filteredKeys.length, total: keyManager.keys.length }) }}</span>
        </div>

        <!-- ── Filter bar ── -->
        <div class="km-filters">
            <div class="km-search-wrap">
                <svg class="km-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="6" cy="6" r="4.5"/>
                    <path d="M10 10l2.5 2.5"/>
                </svg>
                <input
                    v-model="keyManager.searchTerm"
                    type="text"
                    class="km-search"
                    :placeholder="t('placeholderSearchKm')"
                />
            </div>
            <div class="km-filter-group">
                <CustomSelect
                    v-model="keyManager.filterProvider"
                    :options="filterProviderOptions"
                    :placeholder="t('filterAllProviders')"
                    class="km-custom-select"
                />
                <CustomSelect
                    v-model="keyManager.filterStatus"
                    :options="filterStatusOptions"
                    :placeholder="t('filterAllStatus')"
                    class="km-custom-select"
                />
                <CustomSelect
                    v-model="keyManager.sortBy"
                    :options="sortOptionsForSelect"
                    :placeholder="t('sortPrefix') + t('sortCreatedAt')"
                    class="km-custom-select km-custom-select-sort"
                />
                <button
                    @click="keyManager.sortDir = keyManager.sortDir === 'asc' ? 'desc' : 'asc'"
                    class="km-btn km-sort-dir"
                    :title="keyManager.sortDir === 'asc' ? t('titleAsc') : t('titleDesc')"
                >
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path v-if="keyManager.sortDir === 'asc'" d="M7 2v10M3 8l4 4 4-4"/>
                        <path v-else d="M7 12V2M3 6l4-4 4 4"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- ── Batch action bar ── -->
        <div v-if="selectedIds.size > 0" class="km-batch-bar">
            <label class="km-check-label">
                <input type="checkbox" :checked="selectAll" @change="toggleSelectAll" />
                <span>{{ t('batchSelectAll') }}</span>
            </label>
            <span class="km-selected-count">{{ t('batchSelected', { count: selectedIds.size }) }}</span>
            <button @click="handleBatchDelete" class="km-btn danger km-btn-sm">{{ t('btnBatchDelete') }}</button>
        </div>

        <!-- ── Import/Export panel ── -->
        <div v-if="showImportExport" class="km-ie-panel">
            <div class="km-ie-header">
                <span class="km-ie-title">{{ t('ieTitle') }}</span>
                <button @click="showImportExport = false" class="km-btn km-btn-sm">{{ t('btnClose') }}</button>
            </div>
            <div class="km-form-group km-ie-provider">
                <label>{{ t('labelPlatform') }}</label>
                <CustomSelect
                    v-model="importProvider"
                    :options="providerOptions"
                    :placeholder="t('placeholderSelectPlatform')"
                />
            </div>
            <textarea
                v-model="importText"
                class="km-ie-textarea"
                :placeholder="t('iePlaceholder')"
                rows="5"
            ></textarea>
            <div class="km-ie-actions">
                <button @click="handleBatchImport" class="km-btn primary km-btn-sm">{{ t('btnImport') }}</button>
                <button @click="handleExport" class="km-btn km-btn-sm">{{ t('btnExportAll') }}</button>
            </div>
        </div>

        <!-- ── Key list ── -->
        <div class="km-key-list" v-if="keyManager.keys.length > 0">
            <div class="km-key-list-inner">
                <label class="km-check-label km-check-all" v-if="keyManager.filteredKeys.length > 0">
                    <input type="checkbox" :checked="selectAll" @change="toggleSelectAll" />
                    <span>{{ t('batchSelectAll') }}</span>
                </label>
                <div
                    v-for="key in keyManager.filteredKeys"
                    :key="key.id"
                    class="km-key-item"
                >
                    <input
                        type="checkbox"
                        :checked="selectedIds.has(key.id)"
                        @change="toggleSelect(key.id)"
                        class="km-key-checkbox"
                    />
                    <div class="km-key-card-wrapper" @click="openDetail(key.id)">
                        <KeyCard
                            :key-record="key"
                            :selected="selectedIds.has(key.id)"
                            @delete="handleDeleteKey"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- ── Empty state ── -->
        <div v-else class="km-empty">
            <svg class="km-empty-icon" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.25">
                <rect x="6" y="10" width="28" height="22" rx="3"/>
                <path d="M14 10V8a2 2 0 012-2h8a2 2 0 012 2v2"/>
                <path d="M20 19v6M17 22h6"/>
            </svg>
            <p class="km-empty-title">{{ t('kmEmptyTitle') }}</p>
            <p class="km-empty-hint">{{ t('kmEmptyHint') }}</p>
            <button @click="openAddModal" class="km-empty-cta">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M7 2v10M2 7h10"/>
                </svg>
                {{ t('kmEmptyCta') }}
            </button>
        </div>

    </div>

    <!-- ── Add Key Modal ── -->
    <Teleport to="body">
        <div v-if="addModalOpen" class="km-overlay" @click.self="addModalOpen = false">
            <div class="km-modal">
                <div class="km-modal-header">
                    <h3>{{ t('modalAddKeyTitle') }}</h3>
                    <button @click="addModalOpen = false" class="km-modal-close" :aria-label="t('btnClose')">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
                            <path d="M3 3l10 10M13 3L3 13"/>
                        </svg>
                    </button>
                </div>
                <div class="km-modal-body">
                    <div class="km-form-group">
                        <label>{{ t('labelPlatform') }}</label>
                        <CustomSelect
                            v-model="newKeyProvider"
                            :options="providerOptions"
                            :placeholder="t('placeholderSelectPlatform')"
                        />
                    </div>
                    <div class="km-form-group">
                        <label>{{ t('labelApiKeyRequired') }} <span class="km-required">*</span></label>
                        <input
                            v-model="newKeyText"
                            type="text"
                            class="km-input"
                            :placeholder="t('placeholderApiKey')"
                            @keydown.enter="handleAddKey"
                        />
                    </div>
                    <div class="km-form-group">
                        <label>{{ t('labelAlias') }}</label>
                        <input v-model="newKeyAlias" type="text" class="km-input" :placeholder="t('placeholderAlias')" />
                    </div>
                    <div class="km-form-row">
                        <div class="km-form-group">
                            <label>{{ t('labelBaseUrl') }}</label>
                            <input v-model="newKeyBaseUrl" type="text" class="km-input" placeholder="https://..." />
                        </div>
                        <div class="km-form-group">
                            <label>{{ t('labelModel2') }}</label>
                            <input v-model="newKeyModel" type="text" class="km-input" :placeholder="t('placeholderModel2')" />
                        </div>
                    </div>
                </div>
                <div class="km-modal-footer">
                    <button @click="addModalOpen = false" class="km-btn">{{ t('btnCancel') }}</button>
                    <button @click="handleAddKey" class="km-btn primary">{{ t('btnAdd') }}</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* ── Layout ── */
.key-manager {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* ── Toolbar ── */
.km-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.km-toolbar-left { display: flex; gap: 8px; }
.km-count {
    font-size: 12px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
}

/* ── Unified button — same height as global inputs (--ctrl-height-md = 36px) ── */
.km-btn {
    height: var(--ctrl-height-md);
    padding: 0 14px;
    box-shadow: var(--shadow-light-ring);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: var(--ctrl-font-md);
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
}
.km-btn:hover { background: var(--bg-secondary); }
.km-btn.primary { background: var(--ds-gray-1000); color: var(--ds-white); box-shadow: none; }
.km-btn.primary:hover { background: var(--ds-black); color: var(--ds-white); }
.km-btn.danger  { background: var(--ds-red); color: #ffffff; box-shadow: none; }
.km-btn.danger:hover  { background: var(--ds-red-dark); color: #ffffff; }
.km-btn-sm { height: var(--ctrl-height-sm); padding: 0 10px; font-size: var(--ctrl-font-sm); }

/* ── Filter bar ── */
.km-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    padding: 8px 0;
}
.km-search-wrap {
    position: relative;
    flex: 1;
    min-width: 180px;
    max-width: 320px;
}
.km-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ds-gray-400);
    pointer-events: none;
}
.km-search {
    width: 100%;
    height: var(--ctrl-height-md);
    padding: 0 12px 0 30px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: var(--ctrl-font-md);
    font-family: var(--font-sans);
    transition: box-shadow var(--transition-fast);
}
.km-search:focus {
    outline: none;
    box-shadow: var(--shadow-ring);
}
.km-filter-group {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    flex: 1;
}
/* CustomSelect width overrides inside filter group */
.km-custom-select { min-width: 100px; max-width: 160px; flex: 1 1 100px; }
.km-custom-select-sort { min-width: 120px; max-width: 170px; flex: 1 1 120px; }
.km-select {
    height: var(--ctrl-height-md);
    padding: 0 28px 0 10px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: var(--ctrl-font-md);
    font-family: var(--font-sans);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%238a8a8a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    transition: box-shadow var(--transition-fast);
}
.km-select:focus {
    outline: none;
    box-shadow: var(--shadow-ring);
}
.km-select-sort { min-width: 130px; }
.km-sort-dir {
    padding: 0 10px;
    flex-shrink: 0;
}

/* ── Custom checkbox ── */
.km-check-label input[type="checkbox"],
.km-key-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 15px;
    height: 15px;
    min-width: 15px;
    border-radius: 4px;
    border: none;
    box-shadow: var(--shadow-ring);
    background: var(--bg-input);
    cursor: pointer;
    position: relative;
    transition: background var(--transition-fast), box-shadow var(--transition-fast);
    flex-shrink: 0;
}
.km-check-label input[type="checkbox"]:hover,
.km-key-checkbox:hover {
    box-shadow: 0 0 0 1px var(--text-tertiary);
}
.km-check-label input[type="checkbox"]:checked,
.km-key-checkbox:checked {
    background: var(--accent-primary);
    box-shadow: none;
}
.km-check-label input[type="checkbox"]:checked::after,
.km-key-checkbox:checked::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 2px;
    width: 5px;
    height: 8px;
    border: 1.75px solid var(--bg-paper);
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
}

/* ── Batch bar ── */
.km-batch-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-light-ring);
}
.km-check-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
}
.km-check-all { margin-bottom: 12px; }
.km-selected-count {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 600;
}

/* ── Import/Export panel ── */
.km-ie-panel {
    padding: 14px;
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-light-ring);
}
.km-ie-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.km-ie-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.km-ie-textarea {
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-input);
    box-shadow: var(--shadow-ring);
    font-family: var(--font-mono);
    font-size: 12px;
    resize: vertical;
    margin-bottom: 8px;
    color: var(--text-primary);
}
.km-ie-textarea:focus { outline: none; box-shadow: var(--shadow-ring); }
.km-ie-actions { display: flex; gap: 6px; }

/* ── Key list ── */
.km-key-list {
    flex: 1;
    overflow: hidden;
}
.km-key-list-inner {
    height: 100%;
    overflow-y: auto;
    padding: 3px 3px 3px 3px;
}
.km-key-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 10px;
}
.km-key-checkbox { margin-top: 14px; }
.km-key-card-wrapper { flex: 1; min-width: 0; }

/* ── Empty state ── */
.km-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 380px;
    color: var(--text-tertiary);
}
.km-empty-icon { opacity: 0.35; }
.km-empty-title { font-size: 14px; font-weight: 500; color: var(--text-secondary); }
.km-empty-hint  { font-size: 12px; color: var(--text-tertiary); margin-bottom: 4px; }
.km-empty-cta {
    height: var(--ctrl-height-md);
    padding: 0 16px;
    border-radius: var(--radius-md);
    background: var(--ds-gray-1000);
    color: var(--ds-white);
    font-size: var(--ctrl-font-md);
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    margin-top: 4px;
    transition: background var(--transition-fast);
}
.km-empty-cta:hover { background: var(--ds-black); color: var(--ds-white); }

/* ── Modal overlay ── */
.km-overlay {
    position: fixed;
    inset: 0;
    background: var(--ds-overlay-backdrop);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.km-modal {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 460px;
    box-shadow: var(--shadow-full-card);
}
.km-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    box-shadow: inset 0 -1px 0 0 var(--border-color);
}
.km-modal-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
.km-modal-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary);
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast), background var(--transition-fast);
}
.km-modal-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.km-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 0; }
.km-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    box-shadow: inset 0 1px 0 0 var(--border-color);
}

/* ── Form ── */
.km-form-group {
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.km-form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}
.km-required { color: var(--ds-red); }
.km-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.km-input {
    width: 100%;
    height: var(--ctrl-height-md);
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: 13px;
    font-family: var(--font-sans);
    transition: box-shadow var(--transition-fast);
}
.km-input:focus { outline: none; box-shadow: var(--shadow-ring); }

@media (max-width: 640px) {
    .key-manager {
        padding: 12px;
        gap: 12px;
    }

    .km-toolbar {
        align-items: stretch;
    }

    .km-toolbar-left {
        width: 100%;
    }

    .km-toolbar-left .km-btn {
        flex: 1 1 0;
        justify-content: center;
        min-width: 0;
    }

    .km-count {
        width: 100%;
        text-align: right;
    }

    .km-filters {
        flex-direction: column;
        align-items: stretch;
    }

    .km-search-wrap,
    .km-filter-group {
        width: 100%;
        max-width: none;
        min-width: 0;
    }

    .km-filter-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .km-custom-select,
    .km-custom-select-sort {
        min-width: 0;
        max-width: none;
    }

    .km-sort-dir {
        width: 100%;
        justify-content: center;
    }

    .km-batch-bar,
    .km-ie-header,
    .km-ie-actions,
    .km-modal-footer {
        flex-wrap: wrap;
    }

    .km-ie-actions .km-btn,
    .km-modal-footer .km-btn {
        flex: 1 1 0;
        justify-content: center;
    }

    .km-key-item {
        gap: 6px;
    }

    .km-key-checkbox {
        margin-top: 12px;
    }

    .km-form-row {
        grid-template-columns: 1fr;
    }
}
</style>
