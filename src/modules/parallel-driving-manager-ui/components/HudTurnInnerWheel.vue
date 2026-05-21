<template>
  <div
    class="hud-turn-wheel"
    :class="['hud-turn-wheel--' + side, { 'has-steer': hasSteer }]"
    :style="boxTransformStyle"
    aria-hidden="true"
  >
    <svg class="hud-turn-wheel-svg" viewBox="0 0 8 34" shape-rendering="geometricPrecision">
      <line class="hud-tw-line" x1="4" y1="29" x2="4" y2="5" stroke-linecap="round" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    side: 'left' | 'right'
    knuckleDeg: number | null
    /**
     * true：整体以 SVG 底边中点为轴旋转（用于锚在 0.5m 引导线端点时，绕端点摆动）
     * false：以 SVG 底边中点为轴旋转，但不做位移（底栏 / 旧 overlay）
     */
    pivotOnGround?: boolean
  }>(),
  { pivotOnGround: false }
)

const STEER_EPS = 0.35

const deg = computed(() =>
  props.knuckleDeg != null && Number.isFinite(props.knuckleDeg) ? props.knuckleDeg : null
)

const hasSteer = computed(() => deg.value != null && Math.abs(deg.value) > STEER_EPS)

/** 左轮前束角在画面上向左摆为正；绕 SVG 底边中点旋转，与 knuckle 符号一致用 -deg */
const boxTransformStyle = computed(() => {
  const d = deg.value
  if (props.pivotOnGround) {
    return {
      position: 'absolute',
      left: 0,
      bottom: 0,
      transform: d != null ? `translateX(-50%) rotate(${-d}deg)` : 'translateX(-50%)',
      transformOrigin: '50% 100%',
    }
  }
  return {
    transform: d != null ? `rotate(${-d}deg)` : 'none',
    transformOrigin: '50% 100%',
  }
})
</script>

<style scoped>
.hud-turn-wheel {
  flex-shrink: 0;
  opacity: 0.92;
}

.hud-turn-wheel-svg {
  display: block;
  width: 10px;
  height: 32px;
}

.hud-tw-line {
  stroke: rgba(255, 255, 255, 0.82);
  stroke-width: 4;
  transition: stroke 0.15s ease;
}

.hud-turn-wheel.has-steer .hud-tw-line {
  stroke: rgba(129, 212, 250, 0.95);
}

@media (prefers-reduced-motion: reduce) {
  .hud-tw-line {
    transition: none;
  }
}
</style>
