<script setup lang="ts">
/**
 * 远近光 HUD 图标 — 纯 SVG，按参考图结构 1:1 复刻（非位图）：
 * - 灯体：竖长在右的 D，左直边 + 右侧半圆（高 > 宽）
 * - 近光：四条粗平行线，略下倾（更平），圆头；右端齐列，与竖边留统一间隙
 * - 远光：同一灯体 + 四条水平线
 */
defineProps<{
  highBeam: boolean
}>()

/** 竖边 x=32.8，y 14.2↔41.2（高 27），半圆 r=13.5 */
const lampD =
  'M32.8 14.2L32.8 41.2A13.5 13.5 0 0 1 32.8 14.2'

/** 近光：dy=2.8（更平，约 6.5°），dx=24.5 */
const raysLow =
  'M5.5 14.2L30 17M5.5 21.53L30 24.33M5.5 28.86L30 31.66M5.5 35.52L30 38.32'

/** 远光：与近光相同的四条右端高度，水平线 */
const raysHigh =
  'M5.5 17L30 17M5.5 24.33L30 24.33M5.5 31.66L30 31.66M5.5 38.32L30 38.32'
</script>

<template>
  <svg
    class="hud-beam-svg hud-beam-svg--xiaomi"
    viewBox="-2 -2 60 60"
    fill="none"
    aria-hidden="true"
  >
    <path
      stroke="currentColor"
      stroke-width="4.05"
      stroke-linecap="round"
      stroke-linejoin="round"
      :d="lampD"
    />
    <path
      stroke="currentColor"
      stroke-width="3.95"
      stroke-linecap="round"
      stroke-linejoin="round"
      :d="highBeam ? raysHigh : raysLow"
    />
  </svg>
</template>
