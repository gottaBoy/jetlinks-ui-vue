<template>
  <!--
    三栏沉浸式工作台：专为 32:9 曲面屏设计（5120×1440）。
    position:fixed 覆盖全屏，无缝消除系统/软件分屏间隔。
    左右侧栏拖拽可调宽，宽度记忆至 localStorage。
    侧栏可配置 iframe 链接（点击「配置链接」弹入），空时显示占位符。
  -->
  <div ref="shellRef" class="uw-shell" :class="{ 'uw-shell--dragging': !!dragging, 'uw-shell--fullscreen': isShellFullscreen }">

    <!-- ─── Left side panel ─── -->
    <aside class="uw-panel uw-panel--side" :style="{ width: leftPx + 'px' }">
      <div v-if="leftSrc" class="uw-embed">
        <iframe :src="leftSrc" class="uw-iframe" allow="fullscreen *" referrerpolicy="no-referrer" />
        <div class="uw-embed__toolbar">
          <button class="uw-embed__clear" title="清除链接" @click="leftSrc = ''">✕</button>
        </div>
      </div>
      <div v-else class="uw-placeholder" @dblclick="promptSrc('left')">
        <span class="uw-placeholder__icon">🗺️</span>
        <span class="uw-placeholder__label">地图面板</span>
        <span class="uw-placeholder__hint">待接入 · 双击或点击按钮配置链接</span>
        <button class="uw-placeholder__btn" @click.stop="promptSrc('left')">配置链接</button>
      </div>
    </aside>

    <!-- ─── Drag handle: left ─── -->
    <div
      class="uw-handle"
      :class="{ 'uw-handle--active': dragging === 'left' }"
      title="拖拽调整宽度，双击重置"
      @mousedown.prevent="startDrag('left', $event)"
      @dblclick="resetWidths"
    />

    <!-- ─── Center: remote-control workbench ─── -->
    <main class="uw-panel uw-panel--center">
      <VehicleRemoteDeck presentation="remote-focus" :on-toggle-shell-fullscreen="toggleShellFullscreen" :is-shell-fullscreen="isShellFullscreen" />
    </main>

    <!-- ─── Drag handle: right ─── -->
    <div
      class="uw-handle"
      :class="{ 'uw-handle--active': dragging === 'right' }"
      title="拖拽调整宽度，双击重置"
      @mousedown.prevent="startDrag('right', $event)"
      @dblclick="resetWidths"
    />


    <!-- ─── Right side panel ─── -->
    <aside class="uw-panel uw-panel--side" :style="{ width: rightPx + 'px' }">
      <div v-if="rightSrc" class="uw-embed">
        <iframe :src="rightSrc" class="uw-iframe" allow="fullscreen *" referrerpolicy="no-referrer" />
        <div class="uw-embed__toolbar">
          <button class="uw-embed__clear" title="清除链接" @click="rightSrcOverride = ''">✕</button>
        </div>
      </div>
      <div v-else class="uw-placeholder" @dblclick="promptSrc('right')">
        <span class="uw-placeholder__icon">📊</span>
        <span class="uw-placeholder__label">运营面板</span>
        <span class="uw-placeholder__hint">待接入 · 双击或点击按钮配置链接</span>
        <button class="uw-placeholder__btn" @click.stop="promptSrc('right')">配置链接</button>
      </div>
    </aside>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import VehicleRemoteDeck from '../VehicleRemoteDeck.vue'

const route = useRoute()

// ── Constants ─────────────────────────────────────────────────────────────────
/** Width of each drag handle bar in px */
const HANDLE_W = 6
const HANDLE_COUNT = 2
/** Minimum width for each side panel */
const MIN_SIDE = 360
/** Minimum width reserved for the center remote-control panel */
const MIN_CENTER = 1100

const LS_KEY_WIDTHS = 'uw-shell-widths-v1'
const LS_KEY_LEFT_SRC = 'uw-shell-left-src'

// ── Side-panel iframe URLs ─────────────────────────────────────────────────────
const LEFT_SRC_DEFAULT = 'http://10.8.201.11:31569/'

/** 右侧运营面板默认 URL：始终取当前路由的 VIN，确保车辆对齐
 *  格式：http://host:port/#/parallel-driving/vehicles/job-config?vehicleId=xxx&layout=false
 */
const buildRightDefault = (): string => {
  const id = String(route.params.id || '')
  if (!id) return ''
  const base = window.location.origin
  return `${base}/#/parallel-driving/vehicles/job-config?vehicleId=${encodeURIComponent(id)}&layout=false`
}

const leftSrc  = ref(((): string => { try { return localStorage.getItem(LS_KEY_LEFT_SRC) || LEFT_SRC_DEFAULT } catch { return LEFT_SRC_DEFAULT } })())

/**
 * 右侧覆盖 URL（仅本 session 有效，不写 localStorage）
 * 因为 job-config URL 是车辆相关的，持久化会导致换车后仍显示旧 VIN
 */
const rightSrcOverride = ref('')

/**
 * 右侧 URL：computed 保证始终响应 route.params.id 变化
 * - 用户本 session 填了自定义 URL → 用 override
 * - 否则实时用当前车 VIN 生成
 */
const rightSrc = computed(() => rightSrcOverride.value || buildRightDefault())

watch(leftSrc, (v) => { try { localStorage.setItem(LS_KEY_LEFT_SRC, v) } catch { /* ignore */ } })

const promptSrc = (side: 'left' | 'right') => {
  const cur = side === 'left' ? leftSrc.value : rightSrc.value
  const label = side === 'left' ? '地图' : '运营'
  // eslint-disable-next-line no-alert
  const url = window.prompt(`输入${label}面板链接（留空则恢复默认）：`, cur)
  if (url === null) return // cancelled
  if (side === 'left') {
    leftSrc.value = url.trim()
  } else {
    // 右侧仅 session 级别覆盖；清空则恢复当前车 VIN 默认值
    rightSrcOverride.value = url.trim()
  }
}

// ── Column widths ─────────────────────────────────────────────────────────────
/**
 * Default side panel width strategy for 32:9 screens:
 *   Available px = viewport - handles
 *   Side ≈ 20% → on 5120px: 5108 × 0.20 ≈ 1022px each
 *   Center gets the remaining ≈ 3076px — comfortable for the 3-camera video layout
 *
 * Also works on standard 2560×1440 16:9 as a fallback:
 *   Side ≈ 2548 × 0.20 ≈ 510px, center ≈ 1528px (still > MIN_CENTER)
 */
const calcDefaultSide = (): number =>
  Math.max(MIN_SIDE, Math.round((window.innerWidth - HANDLE_W * HANDLE_COUNT) * 0.20))

const loadWidths = (): { left: number; right: number } => {
  try {
    const raw = localStorage.getItem(LS_KEY_WIDTHS)
    if (raw) {
      const { left, right } = JSON.parse(raw) as { left: number; right: number }
      if (Number.isFinite(left) && Number.isFinite(right)) {
        return { left: Math.max(MIN_SIDE, left), right: Math.max(MIN_SIDE, right) }
      }
    }
  } catch { /* ignore */ }
  const s = calcDefaultSide()
  return { left: s, right: s }
}

const initWidths = loadWidths()
const leftPx  = ref(initWidths.left)
const rightPx = ref(initWidths.right)

const saveWidths = () => {
  try {
    localStorage.setItem(LS_KEY_WIDTHS, JSON.stringify({ left: leftPx.value, right: rightPx.value }))
  } catch { /* ignore */ }
}

/** Double-click on any handle to reset both sides to default */
const resetWidths = () => {
  const s = calcDefaultSide()
  leftPx.value  = s
  rightPx.value = s
  saveWidths()
}

// ── Drag-to-resize ────────────────────────────────────────────────────────────
const dragging = ref<'left' | 'right' | null>(null)
let _dragStartX   = 0
let _snapLeft     = 0
let _snapRight    = 0

const startDrag = (side: 'left' | 'right', e: MouseEvent) => {
  dragging.value = side
  _dragStartX = e.clientX
  _snapLeft   = leftPx.value
  _snapRight  = rightPx.value
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup',   onDragEnd)
}

const onDragMove = (e: MouseEvent) => {
  if (!dragging.value) return
  const available = window.innerWidth - HANDLE_W * HANDLE_COUNT
  const dx = e.clientX - _dragStartX

  if (dragging.value === 'left') {
    // Left handle moves right → left panel grows, center shrinks
    leftPx.value = Math.max(
      MIN_SIDE,
      Math.min(_snapLeft + dx, available - rightPx.value - MIN_CENTER),
    )
  } else {
    // Right handle moves right → right panel shrinks, center grows
    rightPx.value = Math.max(
      MIN_SIDE,
      Math.min(_snapRight - dx, available - leftPx.value - MIN_CENTER),
    )
  }
}

const onDragEnd = () => {
  if (!dragging.value) return
  dragging.value = null
  saveWidths()
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup',   onDragEnd)
}

// ── Whole-shell fullscreen ───────────────────────────────────────────────────
const shellRef = ref<HTMLElement | null>(null)
const isShellFullscreen = ref(false)

const onFullscreenChange = () => {
  // 只有全屏元素是 shellRef 本身时才标记为整页全屏
  // 中间视频进入自己的全屏时 fullscreenElement 是视频内部元素，不应影响此状态
  isShellFullscreen.value = document.fullscreenElement === shellRef.value
}

const toggleShellFullscreen = async () => {
  if (!document.fullscreenElement) {
    await shellRef.value?.requestFullscreen().catch(() => { /* 用户拒绝或不支持 */ })
  } else {
    await document.exitFullscreen().catch(() => {})
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

// 清理所有历史遗留的右侧 URL 缓存（这些 key 含旧 VIN，不再使用）
try {
  localStorage.removeItem('uw-shell-right-src')
  localStorage.removeItem('uw-shell-right-src-custom')
} catch { /* ignore */ }

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup',   onDragEnd)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<style scoped lang="less">
// ── Shell ──────────────────────────────────────────────────────────────────────
.uw-shell {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  // 极深蓝黑，比纯黑更有深度感
  background: #040810;
  overflow: hidden;

  &--dragging .uw-iframe {
    pointer-events: none;
  }
  &--dragging {
    cursor: col-resize;
  }
}

// ── Panels ─────────────────────────────────────────────────────────────────────
.uw-panel {
  height: 100%;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;

  // Center: take all remaining space after the two side panels + handles
  &--center {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    user-select: auto;
    display: flex;
    flex-direction: column;

    // 曲面屏模式下隐藏顶部车牌/标签栏，车牌信息已合并至工具栏一行
    :deep(.pd-remote-focus-app-bar) {
      display: none;
    }

    // 移除 j-page-container / ant-spin / ant-card 等自带 padding，让视频占满中栏
    :deep(.pd-vehicle-detail-root),
    :deep(.pd-vehicle-detail-root--remote-focus) {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    // j-page-container 内部包裹层
    :deep(.pd-vehicle-detail-root > *),
    :deep(.pd-vehicle-detail-root--remote-focus > *) {
      flex: 1;
      min-height: 0;
      padding: 0 !important;
      margin: 0 !important;
    }

    :deep(.ant-spin-nested-loading),
    :deep(.ant-spin-container) {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    :deep(.vehicle-detail) {
      flex: 1;
      min-height: 0;
      padding: 0 !important;
      margin: 0 !important;
      display: flex;
      flex-direction: column;
    }

    :deep(.remote-control-card-fs.ant-card),
    :deep(.pd-rc-card--remote-focus.ant-card) {
      flex: 1;
      min-height: 0;
      margin: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      display: flex;
      flex-direction: column;
    }

    :deep(.remote-control-card-fs .ant-card-body),
    :deep(.pd-rc-card--remote-focus .ant-card-body) {
      flex: 1;
      min-height: 0;
      padding: 0 !important;
      display: flex;
      flex-direction: column;
    }

    :deep(.pd-vehicle-detail-fs) {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    :deep(.video-section) {
      flex: 1 !important;
      min-height: 0 !important;
      margin-top: 0 !important;
    }

    // 覆盖 VehicleRemoteDeck 里为独立页设计的硬编码高度 calc(100dvh - 132px)
    // height: 100% 在 flex 子元素上对 flex 计算高度无效，需用 height: auto 解除硬编码
    // 让 flex: 1（已在 pd-vehicle-detail-fs 规则中设置）来决定实际高度
    :deep(.card-body-fullscreen-wrapper) {
      height: auto !important;
      min-height: 0 !important;
    }

    // remote-control-wrapper 是 vehicle-detail（flex column）的直接子元素
    // 必须 flex: 1 才能填满父容器，否则 flex-grow 默认 0，剩余空间变黑色空白
    :deep(.remote-control-wrapper) {
      flex: 1 !important;
      min-height: 0;
      display: flex;
      flex-direction: column;
      margin: 0 !important;
    }
  }
}

// ── Drag handles ───────────────────────────────────────────────────────────────
.uw-handle {
  flex-shrink: 0;
  width: 4px;              // 更细，减少视觉割裂
  height: 100%;
  // 默认：极细发光线，低调
  background: linear-gradient(to bottom, transparent 0%, #1a2a4a 30%, #1e3260 50%, #1a2a4a 70%, transparent 100%);
  cursor: col-resize;
  position: relative;
  transition: background 0.2s ease, width 0.15s ease, box-shadow 0.2s ease;
  z-index: 10;

  // 扩大点击区域
  &::before {
    content: '';
    position: absolute;
    inset: 0 -8px;
  }

  // 中央小圆点（抓手提示）
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 3px;
    height: 40px;
    border-radius: 2px;
    background: rgba(58, 106, 239, 0.3);
    transition: background 0.2s ease, height 0.2s ease, box-shadow 0.2s ease;
  }

  &:hover,
  &--active {
    width: 4px;
    background: linear-gradient(to bottom, transparent 0%, #2a4a8a 20%, #4a7adf 50%, #2a4a8a 80%, transparent 100%);
    box-shadow: 0 0 8px rgba(74, 122, 223, 0.4), 0 0 20px rgba(74, 122, 223, 0.15);

    &::after {
      background: rgba(100, 160, 255, 0.9);
      height: 64px;
      box-shadow: 0 0 6px rgba(100, 160, 255, 0.6);
    }
  }
}

// ── Placeholder ────────────────────────────────────────────────────────────────
.uw-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #050912;
  gap: 14px;
  user-select: none;

  &__icon {
    font-size: 48px;
    opacity: 0.12;
    filter: grayscale(1);
    line-height: 1;
  }

  &__label {
    font-size: 15px;
    font-weight: 600;
    color: #1d2a42;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  &__hint {
    font-size: 11px;
    color: #111a2a;
    letter-spacing: 0.03em;
  }

  &__btn {
    margin-top: 8px;
    padding: 5px 18px;
    border-radius: 4px;
    border: 1px solid #162038;
    background: transparent;
    color: #1e3050;
    font-size: 11px;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s, box-shadow 0.15s;

    &:hover {
      border-color: #3a5faa;
      color: #6a9ae0;
      background: rgba(30, 60, 120, 0.15);
      box-shadow: 0 0 12px rgba(58, 95, 170, 0.2);
    }
  }
}

// ── Embedded iframe panel ──────────────────────────────────────────────────────
.uw-embed {
  position: relative;
  width: 100%;
  height: 100%;

  // 右上角浮动工具栏：hover 时才淡入，不遮挡 iframe 内容
  &__toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 20;
    pointer-events: none;
  }

  &:hover &__toolbar {
    opacity: 1;
    pointer-events: auto;
  }
}

.uw-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #050912;
  display: block;
}

.uw-embed__clear {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  border: 1px solid rgba(50, 80, 140, 0.6);
  background: rgba(4, 8, 20, 0.8);
  color: #4a6a9f;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    background: rgba(20, 40, 80, 0.95);
    border-color: #5a7aaa;
    color: #aac8ff;
  }
}
</style>
