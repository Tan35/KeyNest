<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useCheckerStore } from '@/stores/checker';
import { useKeyManagerStore } from '@/stores/keyManager';
import { useConfigStore } from '@/stores/config';
import { useAuthStore } from '@/stores/auth';
import { RESULT_TAB_CONFIG } from '@/constants';
import { currentLang, setLang, SUPPORTED_LANGS, LANG_LABELS, t } from '@/i18n';

// 导入组件
import ProviderSelector from './components/ProviderSelector.vue';
import ApiConfig from './components/ApiConfig.vue';
import KeyInput from './components/KeyInput.vue';
import ActionButtons from './components/ActionButtons.vue';
import ResultsTabs from './components/ResultsTabs.vue';
import ResultPanel from './components/ResultPanel.vue';
import ToastContainer from './components/ToastContainer.vue';
import ModalContainer from './components/ModalContainer.vue';
import KeyManager from './components/KeyManager.vue';
import AuthPage from './components/AuthPage.vue';

/**
 * @description 结果标签页的配置数组。
 */
const resultTabsConfig = RESULT_TAB_CONFIG;

const uiStore = useUiStore();
const checkerStore = useCheckerStore();
const keyManager = useKeyManagerStore();
const configStore = useConfigStore();
const authStore = useAuthStore();
const scrollPosition = ref(0);

/** 语言切换下拉菜单开关 */
const langMenuOpen = ref(false);



const currentProviderLabel = computed(() => {
    return configStore.providers[configStore.currentProvider]?.label || configStore.currentProvider;
});

const currentRegionLabel = computed(() => {
    return configStore.regions[configStore.currentRegion] || configStore.currentRegion;
});

const statusLabel = computed(() => {
    if (checkerStore.isPaused) return t('statusPaused');
    if (checkerStore.isChecking) return `${t('statusChecking')} ${checkerStore.progress}%`;
    return t('statusIdle');
});

/**
 * @description 监听 checkerStore 的 lastStatusMessage 变化，并触发 UI Toast 提示。
 */
watch(() => checkerStore.lastStatusMessage, (newMessage) => {
    if (newMessage && newMessage.text) {
        uiStore.showToast(newMessage.text, newMessage.type, newMessage.duration);
    }
}, { deep: true });

/**
 * @description 侦听弹窗状态，以实现可靠的滚动锁定。
 * 当模态框激活时，锁定页面滚动；模态框关闭时，恢复滚动。
 */
watch(() => uiStore.isModalActive, (isActive) => {
    const body = document.body;
    if (isActive) {
        scrollPosition.value = window.scrollY;
        body.style.position = 'fixed';
        body.style.top = `-${scrollPosition.value}px`;
        body.style.width = '100%';
        body.classList.add('modal-open');
    } else {
        body.style.position = '';
        body.style.top = '';
        body.style.width = '';
        body.classList.remove('modal-open');
        window.scrollTo(0, scrollPosition.value);
    }
});

/**
 * @description 处理 ESC 键按下事件，用于关闭模态框。
 * @param {KeyboardEvent} e - 键盘事件对象。
 */
const handleEscKey = (e) => {
    if (e.key === 'Escape') {
        if (langMenuOpen.value) { langMenuOpen.value = false; return; }
        if (!uiStore.activeModal) return;
        if (uiStore.activeModal === 'modelSelector' && uiStore.modelSearch) {
            uiStore.modelSearch = '';
        } else {
            uiStore.closeModal();
        }
    }
};

/**
 * @description 点击外部关闭语言菜单。
 */
const handleOutsideClick = (e) => {
    if (!e.target.closest('.lang-switcher')) {
        langMenuOpen.value = false;
    }
};

/**
 * @description 未授权时踢回登录页。
 */
function handleUnauthorized() {
    authStore.logout();
    keyManager.keys = [];
}

/**
 * @description 退出登录。
 */
function handleLogout() {
    authStore.logout();
    keyManager.keys = [];
    keyManager.showManager = false;
    uiStore.showToast(t('authLoggedOut'), 'info');
}

/**
 * @description 组件挂载时鉴权引导并初始化会话。
 */
onMounted(async () => {
    uiStore.initTheme();
    document.addEventListener('keydown', handleEscKey);
    document.addEventListener('click', handleOutsideClick);
    window.addEventListener('keynest:unauthorized', handleUnauthorized);

    const ok = await authStore.bootstrap();
    if (ok) {
        checkerStore.initSession();
        await keyManager.loadKeys();
    }
});

watch(
    () => authStore.isAuthenticated,
    async (authed, wasAuthed) => {
        if (authed && !wasAuthed) {
            checkerStore.initSession();
            await keyManager.loadKeys();
        }
    }
);

/**
 * @description 组件卸载前移除键盘事件监听器。
 */
onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleEscKey);
    document.removeEventListener('click', handleOutsideClick);
    window.removeEventListener('keynest:unauthorized', handleUnauthorized);
    // 完整恢复 body 样式，防止残留
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.width = '';
    body.classList.remove('modal-open');
});
</script>

<template>
    <div v-if="!authStore.bootstrapped" class="auth-boot">
        <div class="auth-boot-inner">{{ t('authBooting') }}</div>
    </div>
    <AuthPage v-else-if="!authStore.isAuthenticated" />
    <div v-else class="page-wrapper">
        <header class="topbar">
            <div class="brand-lockup" @click="keyManager.showManager = false" role="button" :title="t('navChecker')" style="cursor:pointer">
                <span class="brand-mark" aria-hidden="true"></span>
                <div class="brand-text">
                    <h1>KeyNest</h1>
                </div>
            </div>

            <div class="topbar-actions">
                <!-- 语言切换 -->
                <div class="lang-switcher" :class="{ open: langMenuOpen }">
                    <button
                        class="lang-btn"
                        @click.stop="langMenuOpen = !langMenuOpen"
                        :aria-label="'Language / 語言 / 语言'"
                        :title="'Language / 語言 / 语言'"
                    >
                        <!-- Globe icon -->
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                        </svg>
                        <span class="lang-label">{{ LANG_LABELS[currentLang] }}</span>
                    </button>
                    <div v-if="langMenuOpen" class="lang-menu" role="listbox">
                        <button
                            v-for="lang in SUPPORTED_LANGS"
                            :key="lang"
                            class="lang-option"
                            :class="{ active: lang === currentLang }"
                            role="option"
                            :aria-selected="lang === currentLang"
                            @click.stop="setLang(lang); langMenuOpen = false"
                        >
                            {{ LANG_LABELS[lang] }}
                        </button>
                    </div>
                </div>

                <div v-if="authStore.user" class="user-chip" :title="authStore.user.email">
                    <span class="user-chip-email">{{ authStore.user.email }}</span>
                    <button type="button" class="user-logout-btn" @click="handleLogout">{{ t('authLogout') }}</button>
                </div>

                <!-- 深色模式切换按钮 -->
                <button
                    class="theme-toggle-btn"
                    @click="uiStore.toggleDarkMode()"
                    :title="uiStore.isDarkMode ? '切換到淺色模式 / Switch to Light' : '切換到深色模式 / Switch to Dark'"
                    :aria-label="uiStore.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                >
                    <!-- 浅色模式显示月亮图标 -->
                    <svg v-if="!uiStore.isDarkMode" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                    <!-- 深色模式显示太阳图标 -->
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                </button>

                <div v-if="checkerStore.isChecking || checkerStore.isPaused"
                    class="run-status"
                    :class="{ active: checkerStore.isChecking && !checkerStore.isPaused, paused: checkerStore.isPaused }">
                    <span class="run-status-dot" aria-hidden="true"></span>
                    <span>{{ statusLabel }}</span>
                </div>

                <div class="view-tabs" role="tablist" :aria-label="'View / 視圖'">
                    <div class="tab-indicator" :class="{ 'is-right': keyManager.showManager }"></div>
                <button
                    :class="['view-tab', { active: !keyManager.showManager }]"
                    @click="keyManager.showManager = false"
                    role="tab"
                    :aria-selected="!keyManager.showManager"
                >
                    {{ t('tabChecker') }}
                </button>
                <button
                    :class="['view-tab', { active: keyManager.showManager }]"
                    @click="keyManager.showManager = true"
                    role="tab"
                    :aria-selected="keyManager.showManager"
                >
                    {{ t('tabKey') }}
                    <span class="tab-count" v-if="keyManager.keys.length > 0">{{ keyManager.keys.length }}</span>
                </button>
                </div>
            </div>
        </header>

        <main class="workspace">
            <div v-if="!keyManager.showManager" class="main-grid">
                <div class="main-content">
                    <section class="input-section input-section-unified">
                        <ProviderSelector />
                        <ApiConfig />
                        <div class="input-divider"></div>
                        <KeyInput />
                    </section>
                    <ActionButtons />
                </div>
                <div class="sidebar-content">
                    <div class="results-wrapper">
                        <ResultsTabs />
                        <div class="results-panels">
                            <ResultPanel v-for="tab in resultTabsConfig" :key="tab.id" :category="tab.id" :title="tab.name"
                                :sortable="tab.sortable" />
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="manager-grid">
                <KeyManager />
            </div>
        </main>

        <footer class="footer">
            <p class="footer-credit">
                © <a class="footer-author" href="https://tanxy.club" target="_blank" rel="noopener noreferrer">SeanTan</a>
                <span>2026</span>
                <span class="footer-heart" aria-label="love">❤</span>
            </p>
            <a class="cloudflare-badge" href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" aria-label="Powered by Cloudflare">
                <span class="cloudflare-badge-text">Powered by Cloudflare</span>
            </a>
        </footer>
        <ToastContainer />
        <ModalContainer />
    </div>
</template>

<style>
    /* 防止 Vue 渲染时闪烁未编译内容 */
    [v-cloak] {
        display: none;
    }

    .auth-boot {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-paper);
        color: var(--text-tertiary);
        font-size: 14px;
    }

    .user-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 220px;
        height: var(--ctrl-height-md);
        padding: 0 6px 0 10px;
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        box-shadow: var(--shadow-light-ring);
    }

    .user-chip-email {
        font-size: 12px;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    .user-logout-btn {
        flex-shrink: 0;
        height: 28px;
        padding: 0 10px;
        border: none;
        border-radius: var(--radius-md);
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 12px;
        font-family: var(--font-sans);
        cursor: pointer;
    }

    .user-logout-btn:hover {
        background: var(--bg-input);
    }

    /* 内容分隔线 */
    .input-divider {
        height: 1px;
        background: var(--border-color);
        margin: 14px 0;
    }

    /* ── 语言切换器 ── */
    .lang-switcher {
        position: relative;
        display: inline-flex;
        align-items: center;
    }
    .lang-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 34px;
        padding: 0 8px;
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        color: var(--text-tertiary);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        font-family: var(--font-sans);
        transition: color var(--transition-fast), background var(--transition-fast);
        flex-shrink: 0;
    }
    .lang-btn:hover,
    .lang-switcher.open .lang-btn {
        background: var(--bg-secondary);
        color: var(--text-primary);
    }
    .lang-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
    }
    .lang-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-full-card);
        z-index: 200;
        overflow: hidden;
        min-width: 72px;
        padding: 4px 0;
    }
    .lang-option {
        display: block;
        width: 100%;
        padding: 7px 14px;
        background: transparent;
        border: none;
        text-align: left;
        font-size: 13px;
        font-family: var(--font-sans);
        font-weight: 400;
        color: var(--text-secondary);
        cursor: pointer;
        transition: background var(--transition-fast), color var(--transition-fast);
        white-space: nowrap;
    }
    .lang-option:hover { background: var(--bg-secondary); color: var(--text-primary); }
    .lang-option.active { color: var(--text-primary); font-weight: 600; }

    /* 深色模式切换按钮 */
    .theme-toggle-btn {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: var(--radius-md);
        color: var(--text-tertiary);
        cursor: pointer;
        transition: color var(--transition-fast), background var(--transition-fast);
        flex-shrink: 0;
    }
    .theme-toggle-btn:hover {
        background: var(--bg-secondary);
        color: var(--text-primary);
    }

    /* 合并后的单一卡片内层布局 */
    .input-section-unified {
        display: flex;
        flex-direction: column;
    }

    .results-wrapper {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .results-panels {
        position: relative;
        padding: 10px;
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    @media (max-width: 1024px) {
        .results-wrapper {
            position: static;
            height: 560px;
        }
    }

    @media (max-width: 768px) {
        .results-wrapper {
            height: 520px;
        }
    }

    @media (max-width: 480px) {
        .results-wrapper {
            height: 400px;
        }
    }
</style>
