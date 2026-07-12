<template>
    <teleport to="body">
        <div v-if="uiStore.activeModal" class="custom-modal show" @click.self="uiStore.closeModal()">
            <div class="modal-shell t-modal" :class="{ 'is-open': !uiStore.modalClosing, 'is-closing': uiStore.modalClosing }" role="dialog" aria-modal="true">
                <component :is="activeModalComponent" />
            </div>
        </div>
    </teleport>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useUiStore } from '@/stores/ui';
// 确认框极轻且调用频繁：同步导入，避免 async chunk 首开/每次 resolve 延迟
import ConfirmationModal from './modals/ConfirmationModal.vue';

const uiStore = useUiStore();

// 较大弹窗仍异步加载，降低首屏体积
const DetailsModal = defineAsyncComponent(() => import('./modals/DetailsModal.vue'));
const ModelSelectorModal = defineAsyncComponent(() => import('./modals/ModelSelectorModal.vue'));
const SettingsModal = defineAsyncComponent(() => import('./modals/SettingsModal.vue'));
const KeyDetailModal = defineAsyncComponent(() => import('./modals/KeyDetailModal.vue'));

/**
 * @description 计算属性，根据 uiStore.activeModal 的值动态选择要渲染的模态框组件。
 */
const activeModalComponent = computed(() => {
    switch (uiStore.activeModal) {
        case 'details':
            return DetailsModal;
        case 'modelSelector':
            return ModelSelectorModal;
        case 'regionSelector': // 注意：这里 'regionSelector' 实际对应的是 SettingsModal
            return SettingsModal;
        case 'confirmation':
            return ConfirmationModal;
        case 'keyDetail':
            return KeyDetailModal;
        default:
            return null;
    }
});
</script>

<style scoped>
    /* Overlay backdrop — 短过渡，避免「点了半天才看见」 */
    .custom-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        background: var(--ds-overlay-backdrop);
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: opacity var(--modal-open-dur) var(--modal-ease);
    }

    .custom-modal.show {
        opacity: 1;
        visibility: visible;
    }

    .modal-shell {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        max-height: 90vh;
        max-height: 90dvh;
    }

    :deep(.modal-content),
    :deep(.model-selector-content),
    :deep(.detail-modal) {
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-full-card);
    }

    @media (max-width: 768px) {
        .custom-modal {
            /* 移动端去掉 blur，减轻合成开销 */
            -webkit-backdrop-filter: none;
            backdrop-filter: none;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .custom-modal {
            transition: none !important;
        }
    }
</style>
