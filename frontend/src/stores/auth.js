import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
    getToken,
    setSession,
    clearSession,
    getStoredUser,
    authFetch,
    authHeaders,
} from '@/stores/authToken';

export const useAuthStore = defineStore('auth', () => {
    const token = ref(getToken());
    const user = ref(getStoredUser());
    const bootstrapped = ref(false);
    const loading = ref(false);
    const error = ref('');

    const isAuthenticated = computed(() => Boolean(token.value && user.value));

    async function bootstrap() {
        loading.value = true;
        error.value = '';
        try {
            if (!token.value) {
                user.value = null;
                return false;
            }
            const response = await authFetch('/api/auth/me', {
                headers: { ...authHeaders() },
            });
            if (!response.ok) {
                logout();
                return false;
            }
            const data = await response.json();
            user.value = data.user;
            setSession(token.value, data.user);
            return true;
        } catch (e) {
            logout();
            return false;
        } finally {
            loading.value = false;
            bootstrapped.value = true;
        }
    }

    async function register({ email, password, inviteCode }) {
        loading.value = true;
        error.value = '';
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, inviteCode }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                error.value = data.error || 'Register failed';
                throw new Error(error.value);
            }
            token.value = data.token;
            user.value = data.user;
            setSession(data.token, data.user);
            return data.user;
        } finally {
            loading.value = false;
        }
    }

    async function login({ email, password }) {
        loading.value = true;
        error.value = '';
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                error.value = data.error || 'Login failed';
                throw new Error(error.value);
            }
            token.value = data.token;
            user.value = data.user;
            setSession(data.token, data.user);
            return data.user;
        } finally {
            loading.value = false;
        }
    }

    function logout() {
        token.value = '';
        user.value = null;
        error.value = '';
        clearSession();
        try {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: { ...authHeaders() },
            }).catch(() => {});
        } catch {
            /* ignore */
        }
    }

    return {
        token,
        user,
        bootstrapped,
        loading,
        error,
        isAuthenticated,
        bootstrap,
        register,
        login,
        logout,
    };
});
