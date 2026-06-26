<script setup>
import { ref, onMounted, computed, reactive } from 'vue';
import { useKeyManagerStore } from '@/stores/keyManager';
import { useUiStore } from '@/stores/ui';
import { useConfigStore } from '@/stores/config';
import { fetchModels } from '@/api';
import { t, currentLang } from '@/i18n';

const keyManager   = useKeyManagerStore();
const uiStore      = useUiStore();
const configStore  = useConfigStore();

const keyId = computed(() => uiStore.modalData?.keyId || null);

const isEditing       = ref(false);
const editAlias       = ref('');
const editProvider    = ref('');
const isTesting       = ref(false);
const isLoadingModels = ref(false);
const modelSearch     = ref('');
const showBalanceHistory = ref(false);
const newTag          = ref('');
const testingModel    = ref('');
const modelSpeedResults = reactive({});

const keyRecord = computed(() => keyManager.keys.find(k => k.id === keyId.value) || null);

const providerLabel = computed(() =>
    !keyRecord.value ? '' : (configStore.providers[keyRecord.value.provider]?.label || keyRecord.value.provider)
);

const statusText = computed(() => {
    void currentLang.value;
    return ({
        valid:     t('statusValid'),
        invalid:   t('statusInvalid'),
        rateLimit: t('statusRateLimit'),
        unknown:   t('statusUnknown'),
    }[keyRecord.value?.status] || t('statusUnknown'));
});

const statusClass = computed(() => ({
    valid: 'status-valid', invalid: 'status-invalid',
    rateLimit: 'status-rateLimit', unknown: 'status-unknown',
}[keyRecord.value?.status] || 'status-unknown'));

const filteredModels = computed(() => {
    if (!keyRecord.value) return [];
    if (!modelSearch.value) return keyRecord.value.models;
    const term = modelSearch.value.toLowerCase();
    return keyRecord.value.models.filter(m => m.toLowerCase().includes(term));
});

function formatDate(iso) {
    if (!iso) return '-';
    const lang = currentLang.value;
    const locale = lang === 'en' ? 'en-US' : lang === 'zh-CN' ? 'zh-CN' : 'zh-TW';
    return new Date(iso).toLocaleString(locale);
}

function formatBalance(balance, currency) {
    if (balance === null || balance === undefined) return '-';
    return currency === 'USD' ? `$${balance.toFixed(4)}` : `${balance} ${currency || ''}`;
}

onMounted(() => {
    if (keyRecord.value) {
        editAlias.value    = keyRecord.value.alias;
        editProvider.value = keyRecord.value.provider;
        keyManager.loadBalanceHistory(keyId.value);
    }
});

async function saveEdit() {
    await keyManager.updateKey(keyId.value, {
        alias:    editAlias.value.trim(),
        provider: editProvider.value,
    });
    isEditing.value = false;
    uiStore.showToast(t('toastKdSaved'), 'success');
}

async function runConnectionTest(modelOverride) {
    if (!keyRecord.value) return null;

    const providerConfig = {
        provider: keyRecord.value.provider,
        baseUrl:  keyRecord.value.baseUrl || configStore.providers[keyRecord.value.provider]?.defaultBase || '',
        model:    modelOverride || keyRecord.value.model || configStore.providers[keyRecord.value.provider]?.defaultModel || '',
        enableStream: false,
        region: configStore.currentRegion,
        validationPrompt: configStore.validationPrompt,
        validationMaxTokens: configStore.validationMaxTokens,
        validationMaxOutputTokens: configStore.validationMaxOutputTokens,
    };
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const startedAt = performance.now();
    const result = await new Promise((resolve, reject) => {
        const ws = new WebSocket(`${protocol}//${host}/check`);
        const timeout = setTimeout(() => { ws.close(); reject(new Error(t('kdTestTimeout'))); }, 30000);
        ws.onopen = () => ws.send(JSON.stringify({
            command: 'start',
            data: { tokens: [{ token: keyRecord.value.token, order: 0 }], providerConfig, concurrency: 1 },
        }));
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'result') { clearTimeout(timeout); ws.close(); resolve(msg.data); }
            else if (msg.type === 'error') { clearTimeout(timeout); ws.close(); reject(new Error(msg.message)); }
        };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error(t('kdWsConnFailed'))); };
        ws.onclose = () => { clearTimeout(timeout); };
    });

    return {
        result,
        elapsedMs: Math.round(performance.now() - startedAt),
    };
}

async function testConnection() {
    if (!keyRecord.value || isTesting.value) return;
    isTesting.value = true;
    try {
        const { result } = await runConnectionTest();
        await keyManager.updateKeyFromCheck(keyRecord.value.token, result);
        if (result.isValid) {
            const balMsg = result.balance !== undefined && result.balance !== -1
                ? t('kdBalanceMsg', { balance: formatBalance(result.balance, result.currency) }) : '';
            uiStore.showToast(t('toastKdTestPassed', { balMsg }), 'success');
        } else {
            uiStore.showToast(t('toastKdTestFailed', { msg: result.message || t('statusInvalid') }), 'error');
        }
    } catch (err) {
        const msg = err.message || '';
        if (msg === t('kdWsConnFailed') || msg === t('kdTestTimeout'))
            uiStore.showToast(t('toastKdTestBackendDown'), 'error', 5000);
        else uiStore.showToast(t('toastKdTestFailed', { msg }), 'error');
    } finally { isTesting.value = false; }
}

async function testModelSpeed(model) {
    if (!keyRecord.value || testingModel.value) return;
    testingModel.value = model;
    modelSpeedResults[model] = { status: 'testing' };

    try {
        const { result, elapsedMs } = await runConnectionTest(model);
        if (!result.isValid) {
            throw new Error(result.message || t('statusInvalid'));
        }
        modelSpeedResults[model] = { status: 'success', elapsedMs, workerElapsedMs: result.workerElapsedMs ?? null };
    } catch (err) {
        modelSpeedResults[model] = { status: 'error', message: err.message || t('statusInvalid') };
    } finally {
        testingModel.value = '';
    }
}

function getModelSpeedText(model) {
    const state = modelSpeedResults[model];
    if (!state) return '';
    if (state.status === 'testing') return '';
    if (state.status === 'success') {
        return t('kdSpeedMs', { ms: state.workerElapsedMs ?? state.elapsedMs });
    }
    return t('kdSpeedFailed');
}

function getModelSpeedClass(model) {
    const state = modelSpeedResults[model];
    return state ? `is-${state.status}` : '';
}

async function handleFetchModels() {
    if (!keyRecord.value || isLoadingModels.value) return;
    isLoadingModels.value = true;
    try {
        const providerConfig = {
            currentProvider: keyRecord.value.provider,
            baseUrl: keyRecord.value.baseUrl || configStore.providers[keyRecord.value.provider]?.defaultBase || '',
            currentRegion: configStore.currentRegion,
        };
        const models = await fetchModels(keyRecord.value.token, providerConfig);
        await keyManager.updateKeyModels(keyId.value, models);
        uiStore.showToast(t('toastKdModelsCount', { count: models.length }), 'success');
    } catch (err) {
        uiStore.showToast(t('toastKdModelsFailed', { msg: err.message || '' }), 'error', 5000);
    } finally { isLoadingModels.value = false; }
}

async function copyToken() {
    if (!keyRecord.value) return;
    try {
        await navigator.clipboard.writeText(keyRecord.value.token);
        uiStore.showToast(t('toastKdCopied'), 'success', 1500);
    } catch { uiStore.showToast(t('toastKdCopyFailed'), 'error'); }
}

async function handleDelete() {
    const idToDelete = keyId.value;
    if (!idToDelete) return;

    const detailModalData = { ...uiStore.modalData };
    const confirmed = await uiStore.showConfirmation(t('kdConfirmDelete'));

    if (confirmed) {
        await keyManager.deleteKey(idToDelete);
        uiStore.closeModal();
        uiStore.showToast(t('toastKdDeleted'), 'success');
    } else {
        uiStore.openModal('keyDetail', detailModalData);
    }
}

async function addTag() {
    const tag = newTag.value.trim();
    if (!tag) return;
    await keyManager.addTag(keyId.value, tag);
    newTag.value = '';
}

async function removeTag(tag) {
    await keyManager.removeTag(keyId.value, tag);
}
</script>

<template>
    <div class="detail-modal" v-if="keyRecord">
        <div class="detail-header">
            <div class="detail-header-left">
                <span class="provider-pill">{{ providerLabel }}</span>
                <span class="status-badge" :class="statusClass">{{ statusText }}</span>
            </div>
            <button @click="uiStore.closeModal()" class="detail-close" :aria-label="t('btnClose')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75">
                    <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
            </button>
        </div>

        <div class="detail-body">

            <!-- ── Info grid ── -->
            <div class="detail-grid">
                <!-- Token -->
                <div class="detail-field full-width">
                    <span class="field-label">{{ t('kdFieldApiKey') }}</span>
                    <div class="token-row" @click="copyToken" :title="t('kdCopyHint')">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="1" y="3" width="10" height="7" rx="1.5"/>
                            <path d="M4 3V2a2 2 0 014 0v1"/>
                        </svg>
                        <span class="token-text">{{ keyRecord.token.substring(0, 20) }}...</span>
                        <span class="copy-hint">{{ t('kdCopyHint') }}</span>
                    </div>
                </div>

                <!-- Alias -->
                <div class="detail-field">
                    <span class="field-label">{{ t('kdFieldAlias') }}</span>
                    <span v-if="!isEditing" class="field-value">{{ keyRecord.alias || '—' }}</span>
                    <input v-else v-model="editAlias" class="field-input" :placeholder="t('kdPlaceholderAlias')" />
                </div>

                <!-- Provider -->
                <div class="detail-field">
                    <span class="field-label">{{ t('kdFieldPlatform') }}</span>
                    <span v-if="!isEditing" class="field-value">{{ providerLabel }}</span>
                    <select v-else v-model="editProvider" class="field-select">
                        <option v-for="(val, key) in configStore.providers" :key="key" :value="key">{{ val.label }}</option>
                    </select>
                </div>

                <!-- Balance -->
                <div class="detail-field" v-if="keyRecord.balance !== null && keyRecord.balance !== undefined">
                    <span class="field-label">{{ t('kdFieldBalance') }}</span>
                    <span class="field-value balance-value">{{ formatBalance(keyRecord.balance, keyRecord.currency) }}</span>
                </div>

                <!-- Model -->
                <div class="detail-field" v-if="keyRecord.model">
                    <span class="field-label">{{ t('kdFieldModel') }}</span>
                    <span class="field-value mono">{{ keyRecord.model }}</span>
                </div>

                <!-- Base URL -->
                <div class="detail-field full-width" v-if="keyRecord.baseUrl">
                    <span class="field-label">{{ t('kdFieldBaseUrl') }}</span>
                    <span class="field-value mono small">{{ keyRecord.baseUrl }}</span>
                </div>

                <!-- Dates -->
                <div class="detail-field">
                    <span class="field-label">{{ t('kdFieldCreatedAt') }}</span>
                    <span class="field-value small">{{ formatDate(keyRecord.createdAt) }}</span>
                </div>
                <div class="detail-field">
                    <span class="field-label">{{ t('kdFieldLastChecked') }}</span>
                    <span class="field-value small">{{ formatDate(keyRecord.lastChecked) }}</span>
                </div>
            </div>

            <!-- ── Actions ── -->
            <div class="detail-actions">
                <button @click="testConnection" :disabled="isTesting" class="detail-btn primary">
                    <svg v-if="isTesting" class="spin-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.75">
                        <path d="M6 1a5 5 0 100 10A5 5 0 006 1z" opacity=".25"/>
                        <path d="M11 6a5 5 0 00-5-5"/>
                    </svg>
                    {{ isTesting ? t('btnTesting') : t('btnTestConn') }}
                </button>
                <button @click="handleDelete" class="detail-btn danger">{{ t('btnDelete') }}</button>
                <template v-if="!isEditing">
                    <button @click="isEditing = true" class="detail-btn">{{ t('btnEdit') }}</button>
                </template>
                <template v-else>
                    <button @click="saveEdit" class="detail-btn primary">{{ t('btnSave') }}</button>
                    <button @click="isEditing = false" class="detail-btn">{{ t('btnCancelEdit') }}</button>
                </template>
                <button @click="handleFetchModels" :disabled="isLoadingModels" class="detail-btn">
                    {{ isLoadingModels ? t('btnFetchingModels') : t('btnFetchModels') }}
                </button>
            </div>

            <!-- ── Tags ── -->
            <div class="detail-section">
                <h4 class="section-title">{{ t('sectionTags') }}</h4>
                <div class="tag-list" v-if="keyRecord.tags.length > 0">
                    <span v-for="tag in keyRecord.tags" :key="tag" class="tag-item">
                        {{ tag }}
                        <button @click="removeTag(tag)" class="tag-remove" :aria-label="t('btnDelete')">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M2 2l6 6M8 2L2 8"/>
                            </svg>
                        </button>
                    </span>
                </div>
                <p v-else class="tag-empty-hint">{{ t('tagEmptyHint') }}</p>
                <div class="tag-add">
                    <input v-model="newTag" class="field-input" :placeholder="t('placeholderTag')" @keyup.enter="addTag" />
                    <button @click="addTag" class="detail-btn detail-btn-sm">{{ t('btnAddTag') }}</button>
                </div>
            </div>

            <!-- ── Balance history ── -->
            <div class="detail-section" v-if="keyManager.balanceHistory.length > 0">
                <button class="section-toggle" @click="showBalanceHistory = !showBalanceHistory">
                    <span class="section-title">{{ t('sectionBalanceHistory') }} ({{ keyManager.balanceHistory.length }})</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
                         :style="{ transform: showBalanceHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">
                        <path d="M2 4l4 4 4-4"/>
                    </svg>
                </button>
                <div v-if="showBalanceHistory" class="balance-history">
                    <div v-for="snap in keyManager.balanceHistory" :key="snap.id" class="balance-snap">
                        <span class="snap-time">{{ formatDate(snap.timestamp) }}</span>
                        <span class="snap-balance">{{ formatBalance(snap.balance, snap.currency) }}</span>
                    </div>
                </div>
            </div>

            <!-- ── Models ── -->
            <div class="detail-section" v-if="keyRecord.models.length > 0">
                <h4 class="section-title">{{ t('sectionModels') }} ({{ keyRecord.models.length }})</h4>
                <input v-model="modelSearch" class="field-input" :placeholder="t('placeholderSearchModel')" style="margin-bottom:8px;" />
                <div class="model-list">
                    <div v-for="model in filteredModels" :key="model" class="model-row">
                        <div class="model-item">{{ model }}</div>
                        <button
                            class="model-speed-btn"
                            :disabled="!!testingModel"
                            @click="testModelSpeed(model)"
                        >
                            {{ testingModel === model ? t('btnSpeedTesting') : t('btnSpeedTest') }}
                        </button>
                        <span
                            v-if="modelSpeedResults[model]"
                            class="model-speed-result"
                            :class="getModelSpeedClass(model)"
                            :title="modelSpeedResults[model]?.message || ''"
                        >
                            <span v-if="modelSpeedResults[model]?.status === 'testing'" class="model-speed-placeholder" aria-hidden="true"></span>
                            <template v-else>{{ getModelSpeedText(model) }}</template>
                        </span>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
/* ── Modal shell ── */
.detail-modal {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    width: 90vw;
    max-width: 520px;
    max-height: 88vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-full-card);
}

/* ── Header ── */
.detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    box-shadow: inset 0 -1px 0 0 var(--border-color);
    flex-shrink: 0;
}
.detail-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.provider-pill {
    font-size: 12px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 9999px;
    background: var(--ds-gray-100);
    color: var(--ds-gray-700);
}
.status-badge {
    font-size: 12px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 9999px;
}
.status-valid     { background: #f0fdf4; color: #166534; }
.status-invalid   { background: #fff1f0; color: var(--ds-red-dark); }
.status-rateLimit { background: #fdf2fa; color: var(--ds-pink); }
.status-unknown   { background: var(--ds-gray-100); color: var(--ds-gray-500); }

.detail-close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-tertiary);
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: color var(--transition-fast), background var(--transition-fast);
}
.detail-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }

/* ── Body ── */
.detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* ── Info grid ── */
.detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.detail-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.detail-field.full-width { grid-column: 1 / -1; }

.field-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.field-value {
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-all;
}
.field-value.mono  { font-family: var(--font-mono); font-size: 12px; }
.field-value.small { font-size: 12px; color: var(--text-secondary); }
.field-value.balance-value { font-family: var(--font-mono); }

/* Token row */
.token-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--transition-fast);
}
.token-row:hover { background: var(--bg-tertiary); }
.token-text {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.copy-hint {
    font-size: 11px;
    color: var(--text-tertiary);
    flex-shrink: 0;
}

/* Inputs */
.field-input {
    width: 100%;
    height: 34px;
    padding: 0 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: 13px;
    font-family: var(--font-sans);
    transition: box-shadow var(--transition-fast);
    box-sizing: border-box;
}
.field-input:focus { outline: none; box-shadow: var(--shadow-ring); }

.field-select {
    height: 34px;
    padding: 0 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: 13px;
    font-family: var(--font-sans);
    cursor: pointer;
}
.field-select:focus { outline: none; }

/* ── Actions ── */
.detail-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.detail-btn {
    height: 32px;
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-light-ring);
    font-size: 12px;
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    transition: background var(--transition-fast);
}
.detail-btn:hover { background: var(--bg-secondary); }
.detail-btn.primary { background: var(--ds-gray-1000); color: var(--ds-white); box-shadow: none; }
.detail-btn.primary:hover { background: var(--ds-black); color: var(--ds-white); }
.detail-btn.danger  { background: var(--ds-red); color: #ffffff; box-shadow: none; }
.detail-btn.danger:hover  { background: var(--ds-red-dark); color: #ffffff; }
.detail-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.detail-btn-sm { height: 28px; padding: 0 10px; font-size: 11px; }

/* Spin animation */
.spin-icon { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Sections ── */
.detail-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
}
.section-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-primary);
}

/* ── Tags ── */
.tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}
.tag-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--ds-gray-100);
    border-radius: 9999px;
    font-size: 12px;
    color: var(--ds-gray-700);
}
.tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    color: var(--ds-gray-400);
    transition: color var(--transition-fast);
}
.tag-remove:hover { color: var(--ds-red); }
.tag-empty-hint {
    font-size: 12px;
    color: var(--text-tertiary);
    margin: 0;
}
.tag-add {
    display: flex;
    gap: 6px;
    align-items: center;
}

/* ── Balance history ── */
.balance-history {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 160px;
    overflow-y: auto;
}
.balance-snap {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding: 4px 0;
    box-shadow: inset 0 -1px 0 0 var(--border-color);
}
.snap-time { color: var(--text-tertiary); }
.snap-balance { font-family: var(--font-mono); color: var(--text-primary); }

/* ── Models list ── */
.model-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
    padding-right: 8px;
}
.model-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 8px;
}
.model-item {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: background var(--transition-fast);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.model-item:hover { background: var(--bg-secondary); }
.model-speed-btn {
    height: 24px;
    padding: 0 8px;
    border: none;
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
}
.model-speed-btn:hover:not(:disabled) {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}
.model-speed-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.model-speed-result {
    font-size: 11px;
    white-space: nowrap;
    color: var(--text-tertiary);
}
.model-speed-result.is-success {
    color: #0a7c42;
    font-variant-numeric: tabular-nums;
}
.model-speed-result.is-error {
    color: var(--ds-red);
}
.model-speed-result.is-testing {
    display: inline-flex;
    align-items: center;
}
.model-speed-placeholder {
    width: 42px;
    height: 10px;
    border-radius: 9999px;
    background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
    background-size: 200% 100%;
    animation: model-speed-pulse 1s ease-in-out infinite;
}
@keyframes model-speed-pulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
