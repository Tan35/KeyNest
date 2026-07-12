<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { t, currentLang, setLang, SUPPORTED_LANGS, LANG_LABELS } from '@/i18n';

const auth = useAuthStore();
const uiStore = useUiStore();

const mode = ref('login'); // login | register
const email = ref('');
const password = ref('');
const inviteCode = ref('');
const showPassword = ref(false);
const submitting = ref(false);
const formError = ref('');
const langMenuOpen = ref(false);

const title = computed(() => (mode.value === 'login' ? t('authLoginTitle') : t('authRegisterTitle')));
const submitLabel = computed(() =>
    submitting.value ? t('authWorking') : mode.value === 'login' ? t('authLoginBtn') : t('authRegisterBtn')
);

function switchMode(next) {
    mode.value = next;
    formError.value = '';
}

async function handleSubmit() {
    formError.value = '';
    const em = email.value.trim();
    const pw = password.value;
    if (!em || !pw) {
        formError.value = t('authFillRequired');
        return;
    }
    if (mode.value === 'register' && !inviteCode.value.trim()) {
        formError.value = t('authInviteRequired');
        return;
    }
    if (pw.length < 8) {
        formError.value = t('authPasswordTooShort');
        return;
    }

    submitting.value = true;
    try {
        if (mode.value === 'login') {
            await auth.login({ email: em, password: pw });
        } else {
            await auth.register({
                email: em,
                password: pw,
                inviteCode: inviteCode.value.trim(),
            });
        }
        uiStore.showToast(t('authSuccess'), 'success');
    } catch (e) {
        formError.value = e.message || t('authFailed');
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="auth-page">
        <div class="auth-topbar">
            <div class="brand-lockup">
                <span class="brand-mark" aria-hidden="true"></span>
                <div class="brand-text">
                    <h1>KeyNest</h1>
                </div>
            </div>
            <div class="auth-top-actions">
                <div class="lang-switcher" :class="{ open: langMenuOpen }">
                    <button class="lang-btn" type="button" @click.stop="langMenuOpen = !langMenuOpen">
                        <span class="lang-label">{{ LANG_LABELS[currentLang] }}</span>
                    </button>
                    <div v-if="langMenuOpen" class="lang-menu">
                        <button
                            v-for="lang in SUPPORTED_LANGS"
                            :key="lang"
                            type="button"
                            class="lang-option"
                            :class="{ active: lang === currentLang }"
                            @click.stop="setLang(lang); langMenuOpen = false"
                        >
                            {{ LANG_LABELS[lang] }}
                        </button>
                    </div>
                </div>
                <button
                    class="theme-toggle-btn"
                    type="button"
                    @click="uiStore.toggleDarkMode()"
                    :title="uiStore.isDarkMode ? '切換到淺色模式 / Switch to Light' : '切換到深色模式 / Switch to Dark'"
                    :aria-label="uiStore.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                >
                    <!-- 与主站 topbar 同一套图标；射线略内收避免 stroke 被 viewBox 裁切 -->
                    <svg v-if="!uiStore.isDarkMode" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="4.5"/>
                        <line x1="12" y1="2" x2="12" y2="4"/>
                        <line x1="12" y1="20" x2="12" y2="22"/>
                        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
                        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
                        <line x1="2" y1="12" x2="4" y2="12"/>
                        <line x1="20" y1="12" x2="22" y2="12"/>
                        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/>
                        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
                    </svg>
                </button>
            </div>
        </div>

        <div class="auth-center">
            <div class="auth-card">
                <h2 class="auth-title">{{ title }}</h2>
                <p class="auth-subtitle">{{ t('authSubtitle') }}</p>

                <form class="auth-form" @submit.prevent="handleSubmit">
                    <div class="auth-field">
                        <label for="auth-email">{{ t('authEmail') }}</label>
                        <input
                            id="auth-email"
                            v-model="email"
                            type="email"
                            autocomplete="username"
                            class="auth-input"
                            :placeholder="t('authEmailPlaceholder')"
                            required
                        />
                    </div>
                    <div class="auth-field">
                        <label for="auth-password">{{ t('authPassword') }}</label>
                        <div class="auth-password-row">
                            <input
                                id="auth-password"
                                v-model="password"
                                :type="showPassword ? 'text' : 'password'"
                                autocomplete="current-password"
                                class="auth-input"
                                :placeholder="t('authPasswordPlaceholder')"
                                required
                            />
                            <button type="button" class="auth-ghost-btn" @click="showPassword = !showPassword">
                                {{ showPassword ? t('btnHideToken') : t('btnShowToken') }}
                            </button>
                        </div>
                    </div>
                    <div v-if="mode === 'register'" class="auth-field">
                        <label for="auth-invite">{{ t('authInvite') }}</label>
                        <input
                            id="auth-invite"
                            v-model="inviteCode"
                            type="text"
                            class="auth-input"
                            :placeholder="t('authInvitePlaceholder')"
                            autocomplete="off"
                        />
                    </div>

                    <p v-if="formError" class="auth-error">{{ formError }}</p>

                    <button type="submit" class="auth-submit" :disabled="submitting">
                        {{ submitLabel }}
                    </button>
                </form>

                <div class="auth-switch">
                    <template v-if="mode === 'login'">
                        <span>{{ t('authNoAccount') }}</span>
                        <button type="button" class="auth-link" @click="switchMode('register')">{{ t('authGoRegister') }}</button>
                    </template>
                    <template v-else>
                        <span>{{ t('authHasAccount') }}</span>
                        <button type="button" class="auth-link" @click="switchMode('login')">{{ t('authGoLogin') }}</button>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.auth-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-paper);
    color: var(--text-primary);
}

.auth-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
}

.auth-top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.auth-center {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px 48px;
}

.auth-card {
    width: 100%;
    max-width: 400px;
    padding: 28px 24px 24px;
    border-radius: var(--radius-lg);
    background: var(--bg-surface);
    box-shadow: var(--shadow-light-ring);
}

.auth-title {
    margin: 0 0 6px;
    font-size: 1.25rem;
    font-weight: 600;
    font-family: var(--font-sans);
}

.auth-subtitle {
    margin: 0 0 22px;
    font-size: 13px;
    color: var(--text-tertiary);
    line-height: 1.5;
}

.auth-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.auth-field label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
}

.auth-input {
    height: var(--ctrl-height-md);
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-input);
    color: var(--text-primary);
    box-shadow: var(--shadow-ring);
    font-size: var(--ctrl-font-md);
    font-family: var(--font-sans);
    width: 100%;
}

.auth-input:focus {
    outline: none;
}

.auth-password-row {
    display: flex;
    gap: 6px;
    align-items: center;
}

.auth-password-row .auth-input {
    flex: 1;
    min-width: 0;
}

.auth-ghost-btn {
    height: var(--ctrl-height-md);
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-light-ring);
    font-size: var(--ctrl-font-sm);
    cursor: pointer;
    white-space: nowrap;
}

.auth-error {
    margin: 0;
    font-size: 12px;
    color: var(--ds-red, #e5484d);
}

.auth-submit {
    height: 40px;
    margin-top: 4px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--ds-gray-1000);
    color: var(--ds-white);
    font-size: var(--ctrl-font-md);
    font-weight: 500;
    font-family: var(--font-sans);
    cursor: pointer;
    transition: background var(--transition-fast);
}

.auth-submit:hover {
    background: var(--ds-black);
}

.auth-submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.auth-switch {
    margin-top: 18px;
    display: flex;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-tertiary);
}

.auth-link {
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
}
</style>
