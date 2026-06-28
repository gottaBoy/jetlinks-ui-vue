<template>
  <div
    ref="videoBoxRef"
    class="video-box"
    :class="{
      'video-box-front': isFront,
      'video-box--calib-inscribed': lockCalibInscribed,
    }"
  >
    <div
      class="video-wrapper"
      :class="{ 'video-wrapper--calib-inscribed-layer': lockCalibInscribed }"
      :style="calibWrapperStyle"
    >
      <WebRtcPlayer
        v-if="protocol === 'webrtc' && stream"
        :base-url="baseUrl"
        :app="app"
        :stream="stream"
        :show-cloud-link-rtt="showCloudRttPill"
        :cloud-link-network-rtt-ms="cloudLinkNetworkRttMs"
        :fast-video-recovery="fastVideoRecovery"
        :mirror="mirrorEffective"
        :flip-vertical="flipVertical"
        :abr-layers="abrLayers"
        :abr-preset="abrPreset"
      />
      <Player
        v-else-if="url"
        :url="url"
        :protocol="protocol"
        :live="true"
        autoplay
      />
      <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
      <FrontCameraDistanceGuide
        v-if="direction === 'front' && showGuideEffective && !props.frontCalibMatchExternal"
        :rows="distanceGuideRows"
      />
      <SideCameraParallelGuide
        v-else-if="direction === 'left' && showGuideEffective"
        :flip-horizontal="false"
      />
      <SideCameraParallelGuide
        v-else-if="direction === 'right' && showGuideEffective"
        :flip-horizontal="true"
      />
      <span class="video-badge" :title="label">
        <svg v-if="direction === 'front'" viewBox="0 0 16 16" class="vb-icon"><path d="M8 3l5 8H3z"/></svg>
        <svg v-else-if="direction === 'back'" viewBox="0 0 16 16" class="vb-icon"><path d="M8 13l5-8H3z"/></svg>
        <svg v-else-if="direction === 'left'" viewBox="0 0 16 16" class="vb-icon"><path d="M3 8l8-5v10z"/></svg>
        <svg v-else-if="direction === 'right'" viewBox="0 0 16 16" class="vb-icon"><path d="M13 8l-8 5V3z"/></svg>
        <svg v-else viewBox="0 0 16 16" class="vb-icon"><circle cx="8" cy="8" r="3"/></svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import WebRtcPlayer from './WebRtcPlayer.vue'
import FrontCameraDistanceGuide from './FrontCameraDistanceGuide.vue'
import SideCameraParallelGuide from './SideCameraParallelGuide.vue'
import { DEFAULT_FRONT_GUIDE_ROWS, type FrontGuideRow } from './front-camera-guide-config'
import { SIDE_GUIDE_REF_H, SIDE_GUIDE_REF_W } from './side-camera-guide-config'
import { useCalibratedInscribed } from './useCalibratedInscribed'

const props = withDefaults(
  defineProps<{
    label: string
    /** 显式指定镜头方向；不设时从 label 文案推断（避免个别文案无法匹配） */
    cameraDirection?: 'front' | 'back' | 'left' | 'right'
    baseUrl: string
    app: string
    protocol: string
    stream: string | null
    url: string
    isFront?: boolean
    /** 前视：显示距离引导线（归一化坐标见 front-camera-guide-config） */
    showDistanceGuide?: boolean
    /** 覆盖默认标定行 */
    distanceGuideRows?: FrontGuideRow[]
    /** 车云网络 RTT(估) ms，来自 cloud_link_network_rtt_ms */
    cloudLinkNetworkRttMs?: number | null
    /** 为 true 且前视+webrtc 时在画面右上显示 */
    showCloudLinkRtt?: boolean
    /**
     * 父级已叠前视距离引导（如左中右 layout-e），不在此重复绘制 SVG；
     * 为 true 时前视仍按标定 960×768 做内接，与父级引导坐标系一致。
     */
    frontCalibMatchExternal?: boolean
    /**
     * WebRTC 远控快恢复：`WebRtcPlayer` 更短统计周期与 ICE / 收流阈值（默认开）
     */
    fastVideoRecovery?: boolean
    /**
     * 水平镜像（后视镜效果）。不传时仅左后/右后挂车辅路默认镜像，其余摄像头不镜像。
     * 显式传 true/false 可强制开关。
     */
    mirror?: boolean
    /** 垂直翻转。与 mirror 同开即 180° 旋转（挂后摄像头的司机最佳视角）。 */
    flipVertical?: boolean
    /** 自适应码率层级列表，e.g. ['_high','_mid','_low'] */
    abrLayers?: string[]
    /** ABR 策略预设 */
    abrPreset?: 'critical' | 'high' | 'normal' | 'low'
  }>(),
  {
    showDistanceGuide: true,
    showCloudLinkRtt: false,
    frontCalibMatchExternal: false,
    fastVideoRecovery: true,
  }
)

const distanceGuideRows = computed(() => props.distanceGuideRows ?? DEFAULT_FRONT_GUIDE_ROWS)

/** 前辅助线、左右辅助线分控；未 provide 时默认开 */
const showFrontAuxGuide = inject<Ref<boolean>>('showFrontAuxGuide', ref(true))
const showSideAuxGuide = inject<Ref<boolean>>('showSideAuxGuide', ref(true))
/**
 * 前视：倒车(R) 时关前辅助线。左/右鱼眼不受 R 影响，只受 showSideAuxGuide。
 */
const showFrontAuxGuideVisible = inject<Ref<boolean> | undefined>(
  'showFrontAuxGuideVisible',
  undefined
)

const showGuideEffective = computed(() => {
  if (props.showDistanceGuide === false) return false
  if (direction.value === 'front') {
    if (showFrontAuxGuideVisible) return showFrontAuxGuideVisible.value
    return showFrontAuxGuide.value
  }
  if (direction.value === 'left' || direction.value === 'right') {
    return showSideAuxGuide.value
  }
  return false
})

/** 文案含 hitch / 挂后：与左右鱼眼同用 960×768 contain 内接；direction 仍不归为 left/right，避免侧视平行线/角标误判 */
const isRearHitchStream = computed(() => {
  const label = props.label ?? ''
  const l = label.toLowerCase()
  return /hitch|挂后/i.test(label) || /\bhitch\b/i.test(l)
})

const direction = computed(() => {
  if (props.cameraDirection) return props.cameraDirection
  const label = props.label ?? ''
  const l = label.toLowerCase()
  if (isRearHitchStream.value) {
    return ''
  }
  if (l.includes('front') || label.includes('前')) return 'front'
  if (l.includes('back') || label.includes('后')) return 'back'
  if (l.includes('left') || label.includes('左')) return 'left'
  if (l.includes('right') || label.includes('右')) return 'right'
  return ''
})

const showCloudRttPill = computed(
  () =>
    props.showCloudLinkRtt === true &&
    direction.value === 'front' &&
    props.protocol === 'webrtc' &&
    !!props.stream
)

/**
 * 镜像生效值：显式 prop 优先；否则仅左后/右后挂车辅路默认镜像（后视镜效果），其余摄像头不镜像。
 */
const mirrorEffective = computed(() => {
  if (props.mirror !== undefined) return props.mirror
  return isRearHitchStream.value
})

/** 左右鱼眼、挂后辅路：960×768 内接（contain，不裁剪）。前视引导由 FrontCameraDistanceGuide 单独处理。 */
const calibSpec = computed(() => {
  if (isRearHitchStream.value) {
    return { rw: SIDE_GUIDE_REF_W, rh: SIDE_GUIDE_REF_H }
  }
  if (direction.value === 'left' || direction.value === 'right') {
    return { rw: SIDE_GUIDE_REF_W, rh: SIDE_GUIDE_REF_H }
  }
  return null
})

const lockCalibInscribed = computed(() => calibSpec.value != null)

const videoBoxRef = ref<HTMLElement | null>(null)
const { wrapperStyle: calibWrapperStyle } = useCalibratedInscribed(videoBoxRef, calibSpec)
</script>

<style scoped>
.video-box {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.video-box--calib-inscribed {
  flex: 1;
  min-height: 0;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.video-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.video-wrapper--calib-inscribed-layer {
  flex: 0 0 auto;
}

/* 引导线须在 video 之上；部分内核里未设 z-index 时 video 会盖住后序兄弟节点 */
.video-wrapper > :deep(.webrtc-player),
.video-wrapper > :deep([class*='player']) {
  z-index: 1;
}
.video-wrapper > .video-placeholder {
  z-index: 1;
}
.video-wrapper > :deep(.front-camera-distance-guide),
.video-wrapper > :deep(.side-camera-parallel-guide) {
  z-index: 5;
}

.video-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: none;
  user-select: none;
}

.vb-icon {
  width: 12px;
  height: 12px;
  fill: rgba(255, 255, 255, 0.55);
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}
</style>
