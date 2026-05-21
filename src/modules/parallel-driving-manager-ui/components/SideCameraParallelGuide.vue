<template>
  <div ref="rootRef" class="side-camera-parallel-guide" :style="boxStyle" aria-hidden="true">
    <svg
      class="scg-svg"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      shape-rendering="geometricPrecision"
      overflow="hidden"
    >
      <defs>
        <clipPath :id="clipId">
          <rect x="0" y="0" width="1" height="1" />
        </clipPath>
      </defs>
      <g :clip-path="clipPathUrl">
        <template v-for="(c, i) in curves" :key="'p-' + i">
          <polyline
            v-if="polylineAttrs[i]"
            :points="polylineAttrs[i]"
            fill="none"
            :stroke="c.color"
            :stroke-width="strokeW"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-opacity="0.9"
          />
        </template>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import {
  DEFAULT_SIDE_GUIDE_STROKE_W,
  DEFAULT_SIDE_PARALLEL_CURVES,
  sideGuidePolylineAttr,
  sideGuideOverlayRectInWrapper,
  type SideGuideCurve,
} from './side-camera-guide-config'

const props = withDefaults(
  defineProps<{
    curves?: SideGuideCurve[]
    /** 右摄像头：水平镜像（标定通常基于左侧） */
    flipHorizontal?: boolean
    /** 沿 nx 方向的采样段数 */
    sampleSteps?: number
    strokeWidth?: number
  }>(),
  {
    curves: () => [...DEFAULT_SIDE_PARALLEL_CURVES],
    flipHorizontal: false,
    sampleSteps: 96,
    strokeWidth: DEFAULT_SIDE_GUIDE_STROKE_W,
  }
)

const rootRef = ref<HTMLElement | null>(null)
const overlay = ref({ left: 0, top: 0, width: 0, height: 0 })

const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '_') || '0'
const clipId = `scg-clip-${rawId}`
const clipPathUrl = computed(() => `url(#${clipId})`)

const strokeW = computed(() => props.strokeWidth)

const polylineAttrs = computed(() =>
  props.curves.map((c) => sideGuidePolylineAttr(c, props.sampleSteps, props.flipHorizontal))
)

const boxStyle = computed(() => {
  const { left, top, width, height } = overlay.value
  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    right: 'auto',
    bottom: 'auto',
  }
})

let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null
let raf = 0
const videoCleanups: Array<() => void> = []

function scheduleMeasure() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    raf = 0
    const el = rootRef.value
    const wrapper = el?.parentElement
    if (!el || !wrapper) return
    const video = wrapper.querySelector('video')
    overlay.value = sideGuideOverlayRectInWrapper(
      wrapper,
      video as HTMLVideoElement | null
    )
  })
}

function bindVideoListeners(wrapper: HTMLElement) {
  const v = wrapper.querySelector('video')
  if (!v || v.dataset.scgBound === '1') return
  v.dataset.scgBound = '1'
  const onVid = () => scheduleMeasure()
  v.addEventListener('loadedmetadata', onVid)
  v.addEventListener('loadeddata', onVid)
  v.addEventListener('emptied', onVid)
  videoCleanups.push(() => {
    v.removeEventListener('loadedmetadata', onVid)
    v.removeEventListener('loadeddata', onVid)
    v.removeEventListener('emptied', onVid)
    delete v.dataset.scgBound
  })
}

onMounted(() => {
  const el = rootRef.value
  const wrapper = el?.parentElement
  if (!wrapper || !el) return

  bindVideoListeners(wrapper)
  scheduleMeasure()

  ro = new ResizeObserver(scheduleMeasure)
  ro.observe(wrapper)

  mo = new MutationObserver(() => {
    bindVideoListeners(wrapper)
    scheduleMeasure()
  })
  mo.observe(wrapper, { childList: true, subtree: true })

  window.addEventListener('resize', scheduleMeasure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleMeasure)
  ro?.disconnect()
  mo?.disconnect()
  cancelAnimationFrame(raf)
  for (const u of videoCleanups) u()
  videoCleanups.length = 0
})
</script>

<style scoped>
.side-camera-parallel-guide {
  z-index: 6;
  pointer-events: none;
  overflow: hidden;
}

.scg-svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
