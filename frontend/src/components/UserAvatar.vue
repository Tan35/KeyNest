<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    /** 确定性 seed（用户 id），同一用户始终同一图案 */
    seed: {
        type: [String, Number],
        required: true,
    },
    /** 显示尺寸（CSS px） */
    size: {
        type: Number,
        default: 24,
    },
    alt: {
        type: String,
        default: '',
    },
});

const src = ref('');

/** Style 单例缓存（异步加载后复用） */
let cachedStyle = null;

async function getOpenPeepsStyle() {
    if (cachedStyle) return cachedStyle;
    const [{ Style }, openPeepsMod] = await Promise.all([
        import('@dicebear/core'),
        import('@dicebear/styles/open-peeps.json'),
    ]);
    const definition = openPeepsMod.default ?? openPeepsMod;
    cachedStyle = new Style(definition);
    return cachedStyle;
}

async function renderAvatar(seed) {
    if (seed === '' || seed == null) {
        src.value = '';
        return;
    }
    try {
        const { Avatar } = await import('@dicebear/core');
        const style = await getOpenPeepsStyle();
        const avatar = new Avatar(style, {
            seed: String(seed),
            size: 96,
        });
        src.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatar.toString())}`;
    } catch (e) {
        console.warn('avatar render failed', e);
        src.value = '';
    }
}

watch(() => props.seed, (seed) => { renderAvatar(seed); }, { immediate: true });
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
    border-radius: 9999px; /* 仅裁成圆形，不加描边/外环 */
    object-fit: cover;
    object-position: center 18%;
    flex-shrink: 0;
    /* 消除 img 作为替换元素时的基线空隙，避免 flex 里和文字对不齐 */
    vertical-align: middle;
    line-height: 0;
    background: var(--bg-secondary);
    user-select: none;
    -webkit-user-drag: none;
}

.user-avatar-fallback {
    display: block;
    border-radius: 9999px;
    flex-shrink: 0;
    background: var(--bg-secondary);
}
</style>
