<template>
  <div ref="rootRef" class="front-camera-distance-guide" :style="boxStyle" aria-hidden="true">
    <!--
      层位与 object-fit:contain 下 &lt;video&gt; 实际绘制区对齐（sideGuideOverlayRectInWrapper，同侧视）。
      viewBox 960×768 + meet：在标定画幅内等比绘制，再随层整体等比缩放。
    -->
    <svg
      class="fcg-svg"
      :viewBox="`0 0 ${refW} ${refH}`"
      preserveAspectRatio="xMidYMid meet"
      shape-rendering="geometricPrecision"
    >
      <defs>
        <filter id="fcg-text-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            :stdDeviation="shadowBlurUu"
            dx="0"
            dy="0"
            flood-color="#000"
            flood-opacity="0.75"
          />
        </filter>
      </defs>

      <!-- 水平距离标线（每组左右端点连线） -->
      <template v-for="(row, i) in orderedRows" :key="'h-' + i">
        <g v-if="showHorizontalLines" class="fcg-row">
          <line
            :x1="toUuX(row.left.x)"
            :y1="toUuY(row.left.y)"
            :x2="toUuX(row.right.x)"
            :y2="toUuY(row.right.y)"
            :stroke="row.color"
            :stroke-opacity="horizontalLineOpacity"
            :stroke-width="horizontalStrokeUu"
            stroke-linecap="round"
          />
          <text
            v-if="showLabels && showDistanceLabelForRow(row)"
            class="fcg-label"
            :fill="row.color"
            :font-size="labelFontUu"
            :stroke-width="labelStrokeUu"
            dominant-baseline="middle"
            :opacity="labelOpacity"
            :filter="labelShadow ? 'url(#fcg-text-shadow)' : 'none'"
            v-bind="labelTextBind(row)"
          >
            {{ formatDistanceLabel(row) }}
          </text>
        </g>
      </template>

      <!-- 左右纵向：默认 PCA 校准直线段（min～max 投影）；可选原始折线或延长至视口 -->
      <template v-if="showBoundaryLines && boundaryMode === 'calibrated'">
        <line
          v-if="leftCalibratedUu"
          :x1="leftCalibratedUu.x1"
          :y1="leftCalibratedUu.y1"
          :x2="leftCalibratedUu.x2"
          :y2="leftCalibratedUu.y2"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-opacity="0.9"
        />
        <line
          v-if="rightCalibratedUu"
          :x1="rightCalibratedUu.x1"
          :y1="rightCalibratedUu.y1"
          :x2="rightCalibratedUu.x2"
          :y2="rightCalibratedUu.y2"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-opacity="0.9"
        />
      </template>
      <template v-else-if="showBoundaryLines && boundaryMode === 'rawPolyline'">
        <polyline
          v-if="leftPolylinePointsUu"
          :points="leftPolylinePointsUu"
          fill="none"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.9"
        />
        <polyline
          v-if="rightPolylinePointsUu"
          :points="rightPolylinePointsUu"
          fill="none"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-opacity="0.9"
        />
      </template>
      <template v-else-if="showBoundaryLines && boundaryMode === 'extendedViewport'">
        <line
          v-if="leftExtendedUu"
          :x1="leftExtendedUu.x1"
          :y1="leftExtendedUu.y1"
          :x2="leftExtendedUu.x2"
          :y2="leftExtendedUu.y2"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-opacity="0.9"
        />
        <line
          v-if="rightExtendedUu"
          :x1="rightExtendedUu.x1"
          :y1="rightExtendedUu.y1"
          :x2="rightExtendedUu.x2"
          :y2="rightExtendedUu.y2"
          :stroke="boundaryStroke"
          :stroke-width="boundaryStrokeUu"
          stroke-linecap="round"
          stroke-opacity="0.9"
        />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, unref, type Ref } from 'vue'
import type { FrontGuideRow } from './front-camera-guide-config'
import {
  DEFAULT_BOUNDARY_STROKE,
  FRONT_GUIDE_NY_GLOBAL_OFFSET,
  REF_CALIBRATION_H,
  REF_CALIBRATION_W,
} from './front-camera-guide-config'
import { sideGuideOverlayRectInWrapper } from './side-camera-guide-config'
import { resolveCalibrationVideoWrapper } from './useVideoCalibrationOverlayRect'
import {
  type LineSegment,
  fitBoundaryLineToUnitSquare,
  fitCalibratedBoundarySegment,
} from './front-camera-line-fit'

/** 与 defineProps 分写，避免 SFC 将泛型 &lt; &gt; 与模板混淆 */
type FrontDistanceGuideMeasureHost = HTMLElement | Ref<HTMLElement | null> | null

const props = withDefaults(
  defineProps<{
    rows: FrontGuideRow[]
    /** 绘制左右纵向引导（沿各距离点连接） */
    showBoundaryLines?: boolean
    /** 水平标线 */
    showHorizontalLines?: boolean
    /** 距离文字 */
    showLabels?: boolean
    /**
     * 仅当 distanceM 小于该值时显示距离数字（过远不标，减少干扰）。
     * 默认 8：不标 8m、10m，仍绘制对应水平标线。
     */
    labelDistanceCutoffM?: number
    boundaryStroke?: string
    /** 相对标定宽度的线宽：描边宽度 = 该值 × 960（用户单位，与 0~1 数据一致） */
    horizontalStrokeWidth?: number
    /** 横向标线不透明度（0~1） */
    horizontalLineOpacity?: number
    boundaryStrokeWidth?: number
    labelFontSize?: number
    /**
     * 数字标签位置：center=线段中点（默认，半透明 HUD）；left/right=沿线两侧；above-center=中点上方
     */
    labelPlacement?: 'center' | 'left' | 'right' | 'above-center'
    /** 标签整体不透明度（0~1），略透明减轻遮挡 */
    labelOpacity?: number
    /** 标签相对左/右端点的内边距（归一化），placement 为 left/right 时生效 */
    labelInset?: number
    /** labelPlacement=above-center 时相对中点上移量 */
    labelOffsetY?: number
    /** 是否使用文字投影（透明时可关，更干净） */
    labelShadow?: boolean
    /**
     * 纵线：calibrated=PCA 校准直线段（默认，覆盖 0.5～5m 标定带）；
     * rawPolyline=未校准折线；extendedViewport=校准直线延长至画面边缘。
     */
    boundaryMode?: 'calibrated' | 'rawPolyline' | 'extendedViewport'
    /**
     * 引导层与 video 不同父级时（如 layout-e 叠层）传入前视根宿主，在其下解析 `.video-wrapper` 与 &lt;video&gt;（默认同父即 video 框层）。
     */
    measureWithin?: FrontDistanceGuideMeasureHost
  }>(),
  {
    showBoundaryLines: true,
    showHorizontalLines: true,
    showLabels: true,
    boundaryMode: 'calibrated',
    boundaryStroke: DEFAULT_BOUNDARY_STROKE,
    horizontalStrokeWidth: 0.00125,
    horizontalLineOpacity: 0.88,
    boundaryStrokeWidth: 0.0014,
    labelFontSize: 0.022,
    labelPlacement: 'center',
    labelOpacity: 0.72,
    labelInset: 0.01,
    labelOffsetY: 0.022,
    labelShadow: true,
    labelDistanceCutoffM: 8,
  }
)

/** 标定逻辑画幅 960×768（与配置、视频 contain 于同一等比内接层一致） */
const refW = REF_CALIBRATION_W
const refH = REF_CALIBRATION_H

function toUuX(nx: number) {
  return nx * refW
}
function toUuY(ny: number) {
  const t = Math.min(1, Math.max(0, ny + FRONT_GUIDE_NY_GLOBAL_OFFSET))
  return t * refH
}

function mapSegToUu(seg: LineSegment | null): LineSegment | null {
  if (!seg) return null
  return {
    x1: toUuX(seg.x1),
    y1: toUuY(seg.y1),
    x2: toUuX(seg.x2),
    y2: toUuY(seg.y2),
  }
}

const horizontalStrokeUu = computed(() =>
  props.showHorizontalLines ? props.horizontalStrokeWidth * refW : 0
)
const boundaryStrokeUu = computed(() => (props.showBoundaryLines ? props.boundaryStrokeWidth * refW : 0))
const labelFontUu = computed(() => String(props.labelFontSize * refW))
/** 与旧 viewBox 0~1 下 0.008 线宽、0.008 字阴影同一量级 */
const labelStrokeUu = computed(() => 0.008 * refW)
const shadowBlurUu = computed(() => 0.008 * refH)

const horizontalLineOpacity = computed(() => props.horizontalLineOpacity)

/** 仅数字，不显示 m，减少遮挡与视觉噪音 */
function formatDistanceLabel(row: FrontGuideRow) {
  return String(row.distanceM)
}

function showDistanceLabelForRow(row: FrontGuideRow) {
  return row.distanceM < props.labelDistanceCutoffM
}

function labelAttrs(row: FrontGuideRow): {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
} {
  const midY = (row.left.y + row.right.y) / 2
  const inset = props.labelInset
  if (props.labelPlacement === 'right') {
    return {
      x: toUuX(row.right.x - inset),
      y: toUuY(midY),
      anchor: 'end',
    }
  }
  if (props.labelPlacement === 'above-center') {
    return {
      x: toUuX((row.left.x + row.right.x) / 2),
      y: toUuY(midY - props.labelOffsetY),
      anchor: 'middle',
    }
  }
  if (props.labelPlacement === 'center') {
    return {
      x: toUuX((row.left.x + row.right.x) / 2),
      y: toUuY(midY),
      anchor: 'middle',
    }
  }
  return {
    x: toUuX(row.left.x + inset),
    y: toUuY(midY),
    anchor: 'start',
  }
}

/** SVG <text> 绑定，避免模板重复计算 */
function labelTextBind(row: FrontGuideRow) {
  const a = labelAttrs(row)
  return {
    x: a.x,
    y: a.y,
    'text-anchor': a.anchor,
  }
}

const orderedRows = computed(() =>
  [...props.rows].sort((a, b) => a.distanceM - b.distanceM)
)

function pointsToPolylineAttrUu(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  return pts.map((p) => `${toUuX(p.x)},${toUuY(p.y)}`).join(' ')
}

const leftPolylinePointsUu = computed(() =>
  pointsToPolylineAttrUu(orderedRows.value.map((r) => r.left))
)

const rightPolylinePointsUu = computed(() =>
  pointsToPolylineAttrUu(orderedRows.value.map((r) => r.right))
)

const leftCalibrated = computed(() =>
  fitCalibratedBoundarySegment(orderedRows.value.map((r) => r.left))
)
const rightCalibrated = computed(() =>
  fitCalibratedBoundarySegment(orderedRows.value.map((r) => r.right))
)
const leftCalibratedUu = computed(() => mapSegToUu(leftCalibrated.value))
const rightCalibratedUu = computed(() => mapSegToUu(rightCalibrated.value))

const leftExtended = computed(() =>
  fitBoundaryLineToUnitSquare(orderedRows.value.map((r) => r.left))
)
const rightExtended = computed(() =>
  fitBoundaryLineToUnitSquare(orderedRows.value.map((r) => r.right))
)
const leftExtendedUu = computed(() => mapSegToUu(leftExtended.value))
const rightExtendedUu = computed(() => mapSegToUu(rightExtended.value))

/** 与侧视一致：叠在 video contain 内容矩形上（父级为 video-wrapper） */
const rootRef = ref<HTMLElement | null>(null)
const overlay = ref({ left: 0, top: 0, width: 0, height: 0 })

const boxStyle = computed(() => {
  const { left, top, width, height } = overlay.value
  return {
    position: 'absolute' as const,
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    right: 'auto' as const,
    bottom: 'auto' as const,
  }
})

let ro: ResizeObserver | null = null
let mo: MutationObserver | null = null
let raf = 0
const videoCleanups: Array<() => void> = []

function measureHostEl(): HTMLElement | null {
  const el = rootRef.value
  if (!el) return null
  return (unref(props.measureWithin) as HTMLElement | null) ?? el.parentElement
}

function scheduleMeasure() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    raf = 0
    const el = rootRef.value
    const mh = measureHostEl()
    if (!el || !mh) return
    const w = resolveCalibrationVideoWrapper(mh)
    if (!w) return
    const video = w.querySelector('video') as HTMLVideoElement | null
    const r0 = sideGuideOverlayRectInWrapper(w, video)
    const parent = el.parentElement
    if (!parent) {
      overlay.value = r0
      return
    }
    if (parent === w) {
      overlay.value = r0
    } else {
      const pr = parent.getBoundingClientRect()
      const wr = w.getBoundingClientRect()
      overlay.value = {
        left: wr.left - pr.left + r0.left,
        top: wr.top - pr.top + r0.top,
        width: r0.width,
        height: r0.height,
      }
    }
  })
}

function bindVideoListeners(calibWrapper: HTMLElement) {
  const v = calibWrapper.querySelector('video')
  if (!v || v.dataset.fcgBound === '1') return
  v.dataset.fcgBound = '1'
  const onVid = () => scheduleMeasure()
  v.addEventListener('loadedmetadata', onVid)
  v.addEventListener('loadeddata', onVid)
  v.addEventListener('emptied', onVid)
  videoCleanups.push(() => {
    v.removeEventListener('loadedmetadata', onVid)
    v.removeEventListener('loadeddata', onVid)
    v.removeEventListener('emptied', onVid)
    delete v.dataset.fcgBound
  })
}

function onResizeOrTree() {
  const mh = measureHostEl()
  if (mh) {
    const w = resolveCalibrationVideoWrapper(mh)
    if (w) bindVideoListeners(w)
  }
  scheduleMeasure()
}

onMounted(() => {
  const el = rootRef.value
  if (!el) return
  onResizeOrTree()

  ro = new ResizeObserver(onResizeOrTree)
  const mh0 = measureHostEl()
  if (mh0) {
    ro.observe(mh0)
    const w0 = resolveCalibrationVideoWrapper(mh0)
    if (w0) ro.observe(w0)
  }

  mo = new MutationObserver(onResizeOrTree)
  if (mh0) {
    mo.observe(mh0, { childList: true, subtree: true })
  }

  window.addEventListener('resize', onResizeOrTree)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResizeOrTree)
  ro?.disconnect()
  mo?.disconnect()
  cancelAnimationFrame(raf)
  for (const u of videoCleanups) u()
  videoCleanups.length = 0
})
</script>

<style scoped>
.front-camera-distance-guide {
  /* 位置由行内 boxStyle（sideGuideOverlayRectInWrapper）给出，勿 inset:0 铺满 wrapper */
  z-index: 6;
  pointer-events: none;
  overflow: hidden;
}

.fcg-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.fcg-label {
  font-weight: 600;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  paint-order: stroke fill;
  /* 与 labelOpacity 搭配：略淡描边；线宽在模板用 labelStrokeUu（用户单位，随 960 画幅） */
  stroke: rgba(0, 0, 0, 0.32);
}
</style>
