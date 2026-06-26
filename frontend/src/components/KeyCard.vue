<script setup>
import { computed } from 'vue';
import { useKeyManagerStore } from '@/stores/keyManager';
import { useUiStore } from '@/stores/ui';
import { t, currentLang } from '@/i18n';

const props = defineProps({
    keyRecord: { type: Object, required: true },
    selected:  { type: Boolean, default: false },
});
const emit = defineEmits(['select', 'delete']);

const keyManager = useKeyManagerStore();
const uiStore    = useUiStore();

const maskedToken = computed(() => {
    const tok = props.keyRecord.token;
    if (tok.length <= 8) return '****';
    return tok.substring(0, 4) + '****' + tok.substring(tok.length - 4);
});

const statusClass = computed(() => ({
    valid:     'status-valid',
    invalid:   'status-invalid',
    rateLimit: 'status-rateLimit',
    unknown:   'status-unknown',
}[props.keyRecord.status] || 'status-unknown'));

const statusText = computed(() => {
    void currentLang.value;
    return ({
        valid:     t('statusValid'),
        invalid:   t('statusInvalid'),
        rateLimit: t('statusRateLimit'),
        unknown:   t('statusUnknown'),
    }[props.keyRecord.status] || t('statusUnknown'));
});

const balanceText = computed(() => {
    const b = props.keyRecord.balance;
    if (b === null || b === undefined) return null;
    const c = props.keyRecord.currency || 'USD';
    return c === 'USD' ? `$${b.toFixed(2)}` : `${b} ${c}`;
});

const providerLabel = computed(() => {
    const map = {
        openai_responses: 'OpenAI (R)', openai: 'OpenAI', anthropic: 'Anthropic',
        gemini: 'Gemini', deepseek: 'DeepSeek', groq: 'Groq', moonshot: 'Moonshot',
        siliconflow: 'SiliconFlow', xai: 'xAI', zhipu: 'Zhipu', qwen: 'Qwen',
    };
    return map[props.keyRecord.provider] || props.keyRecord.provider;
});

function formatDate(iso) {
    if (!iso) return '-';
    const lang = currentLang.value;
    const locale = lang === 'en' ? 'en-US' : lang === 'zh-CN' ? 'zh-CN' : 'zh-TW';
    return new Date(iso).toLocaleString(locale, {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

async function copyToken() {
    try {
        await navigator.clipboard.writeText(props.keyRecord.token);
        uiStore.showToast(t('toastKcCopied'), 'success', 1500);
    } catch {
        uiStore.showToast(t('toastKcCopyFailed'), 'error');
    }
}

async function confirmDelete() {
    const confirmed = await uiStore.showConfirmation(`${t('kdConfirmDelete')}\n${maskedToken.value}`);
    if (confirmed) emit('delete', props.keyRecord.id);
}
</script>

<template>
    <div class="key-card" :class="{ selected }" @click="emit('select', keyRecord.id)">
        <!-- 左侧：主内容区 -->
        <div class="key-card-body">
            <!-- 第一行：服务商 + 状态 + 别名 -->
            <div class="key-card-header">
                <span class="provider-pill">{{ providerLabel }}</span>
                <span class="status-pill" :class="statusClass">{{ statusText }}</span>
                <span v-if="keyRecord.alias" class="alias-text">{{ keyRecord.alias }}</span>
            </div>

            <!-- 第二行：脱敏 Key -->
            <div class="key-card-token">
                <svg class="token-icon" width="12" height="12" viewBox="0 -1 12 13" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="1" y="3" width="10" height="7" rx="1.5"/>
                    <path d="M4 3V2a2 2 0 014 0v1"/>
                </svg>
                <span class="token-text">{{ maskedToken }}</span>
            </div>

            <!-- 第三行：模型数 + 日期 + · + 余额 -->
            <div class="key-card-meta">
                <span v-if="keyRecord.models.length > 0" class="meta-chip">{{ t('kcModels', { count: keyRecord.models.length }) }}</span>
                <span class="meta-date">{{ keyRecord.lastChecked ? formatDate(keyRecord.lastChecked) : t('kcNotChecked') }}</span>
                <span v-if="balanceText" class="meta-sep">·</span>
                <span v-if="balanceText" class="meta-balance">{{ balanceText }}</span>
            </div>

            <!-- 第四行：标签 -->
            <div v-if="keyRecord.tags.length > 0" class="key-card-tags">
                <span v-for="tag in keyRecord.tags" :key="tag" class="tag-pill">{{ tag }}</span>
            </div>
        </div>

        <!-- 右侧：竖排操作区 -->
        <div class="key-card-actions" @click.stop>
            <button @click="copyToken" class="action-btn" :title="t('kdCopyHint')">
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="4" y="4" width="6" height="6" rx="1"/>
                    <path d="M8 4V2.5a.5.5 0 00-.5-.5h-5a.5.5 0 00-.5.5v5a.5.5 0 00.5.5H4"/>
                </svg>
            </button>
            <button @click="confirmDelete" class="action-btn action-btn-delete" :title="t('btnDelete')">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M2.5 4h9M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1 1 0 01-1 1H4a1 1 0 01-1-1V4"/>
                </svg>
            </button>
        </div>
    </div>
</template>

<style scoped>
/* ── 卡片外层：左内容 + 右操作 ── */
.key-card {
    background: var(--bg-surface);
    border-radius: var(--radius-md);
    padding: 10px 10px 10px 12px;
    cursor: pointer;
    display: flex;
    align-items: stretch;
    gap: 8px;
    transition: box-shadow var(--transition-fast), background var(--transition-fast);
    box-shadow: var(--shadow-light-ring);
}
.key-card:hover { background: var(--bg-secondary); box-shadow: var(--shadow-card); }
.key-card.selected {
    box-shadow: var(--shadow-card), 0 0 0 2px var(--bg-surface), 0 0 0 3px var(--ds-gray-400);
}

/* ── 左侧内容区 ── */
.key-card-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* 第一行：服务商 + 状态 + 别名 */
.key-card-header {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
}

.provider-pill {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 9999px;
    background: var(--ds-gray-100);
    color: var(--ds-gray-700);
}

.status-pill {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 7px;
    border-radius: 9999px;
}
.status-valid     { background: #f0fdf4; color: #0a7c42; }
.status-invalid   { background: #fff1f0; color: var(--ds-red-dark); }
.status-rateLimit { background: #fdf2fa; color: var(--ds-pink); }
.status-unknown   { background: var(--ds-gray-100); color: var(--ds-gray-500); }

.alias-text {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
}

/* 第二行：脱敏 Key */
.key-card-token {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: var(--token-bg);
    border-radius: var(--radius-sm);
}
.token-icon { color: var(--ds-gray-400); flex-shrink: 0; }
.token-text {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 第三行：余额 + 模型数 + 日期 */
.key-card-meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
}
.meta-balance {
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans);
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
}
.meta-chip {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 9999px;
    background: var(--ds-gray-100);
    color: var(--ds-gray-500);
}
.meta-date {
    font-size: 11px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
}
.meta-sep {
    font-size: 11px;
    color: var(--text-tertiary);
    user-select: none;
}

/* 第四行：标签 */
.key-card-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}
.tag-pill {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 9999px;
    background: var(--ds-gray-100);
    color: var(--ds-gray-600);
    font-weight: 500;
}

/* ── 右侧竖排操作区 ── */
.key-card-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex-shrink: 0;
    border-left: 1px solid var(--border-color);
    padding-left: 8px;
}
.action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 5px;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color var(--transition-fast), background var(--transition-fast);
}
.action-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }
.action-btn-delete:hover { color: var(--ds-red); background: var(--bg-tertiary); }

@media (max-width: 640px) {
    .key-card {
        padding: 10px;
        gap: 10px;
    }

    .key-card-header {
        gap: 4px;
    }

    .alias-text {
        flex-basis: 100%;
    }

    .key-card-meta {
        gap: 4px 6px;
    }

    .key-card-actions {
        border-left: none;
        padding-left: 0;
        justify-content: flex-start;
        padding-top: 2px;
    }

    .action-btn {
        padding: 4px;
    }
}
</style>
