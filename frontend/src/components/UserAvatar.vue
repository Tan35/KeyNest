<script setup>
import { computed } from 'vue';
import { gradientToDataURL } from '@outpacelabs/avatars';

const props = defineProps({
    /** 确定性 seed，同一用户始终同一图案 */
    seed: {
        type: [String, Number],
        required: true,
    },
    /** 显示尺寸（CSS px） */
    size: {
        type: Number,
        default: 32,
    },
    /** 生成分辨率，略高于显示尺寸更清晰 */
    renderSize: {
        type: Number,
        default: 96,
    },
    alt: {
        type: String,
        default: '',
    },
});

const src = computed(() => {
    if (props.seed === '' || props.seed == null) return '';
    try {
        return gradientToDataURL(props.seed, { size: props.renderSize });
    } catch (e) {
        console.warn('avatar render failed', e);
        return '';
    }
});
</script>

<template>
    <img
        v-if="src"
        class="user-avatar"
        :src="src"
        :alt="alt"
        :width="size"
        :height="size"
        :style="{ width: size + 'px', height: size + 'px' }"
        draggable="false"
    />
    <span
        v-else
        class="user-avatar user-avatar-fallback"
        :style="{ width: size + 'px', height: size + 'px' }"
        aria-hidden="true"
    />
</template>

<style scoped>
.user-avatar {
    display: block;
    border-radius: 9999px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: var(--shadow-light-ring);
    background: var(--bg-secondary);
    user-select: none;
    -webkit-user-drag: none;
}

.user-avatar-fallback {
    display: inline-block;
    border-radius: 9999px;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-light-ring);
}
</style>
