<!-- WebRTC 低延迟播放器，对接 ZLMediaKit /index/api/webrtc -->
<template>
  <div ref="playerBoxRef" class="webrtc-player">
    <video
      ref="videoRef"
      autoplay
      muted
      playsinline
      :controls="!props.liveOnly"
      class="webrtc-video"
      :class="{ 'live-only': props.liveOnly }"
      style="width: 100%; height: 100%; object-fit: contain"
    />
    <div v-if="!loading && !error" class="webrtc-top-bar" :style="webrtcTopBarStyle">
      <div
        v-if="showCloudLinkRtt"
        class="webrtc-cloud-link-rtt"
        :title="cloudLinkRttTitle"
      >{{ cloudLinkRttText }}</div>
      <div
        class="webrtc-net-badge"
        :class="{ 'wnb-health-warn': healthUi.tone === 'warn', 'wnb-health-bad': healthUi.tone === 'bad', 'wnb-health-recover': healthUi.tone === 'recover' }"
      >
        <span
          class="wnb-dot"
          :class="{ 'wnb-dot-warn': healthUi.tone === 'warn', 'wnb-dot-bad': healthUi.tone === 'bad', 'wnb-dot-recover': healthUi.tone === 'recover' }"
        />
        <span v-if="healthUi.label" class="wnb-health-label" :title="healthUi.tooltip">{{ healthUi.label }}</span>
        <span v-if="healthUi.label" class="wnb-sep">·</span>
        <span class="wnb-bitrate">{{ statsDisplay.bitrate }}</span>
        <span class="wnb-sep">·</span>
        <span class="wnb-fps">{{ statsDisplay.fps }}fps</span>
        <span v-if="props.liveOnly" class="wnb-sep">·</span>
        <span v-if="props.liveOnly" class="wnb-time">{{ elapsedText }}</span>
      </div>
      <button
        type="button"
        class="webrtc-stats-toggle"
        :class="{ active: showStats }"
        @click="showStats = !showStats"
        title="WebRTC Stats"
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M2 12h3v6H2zm5-4h3v10H7zm5-5h3v15h-3zm5 2h1v13h-1z"/>
        </svg>
      </button>
    </div>

    <Transition name="stats-fade">
      <div v-if="showStats && !loading && !error" class="webrtc-stats-panel" :style="webrtcStatsPanelStyle">
        <div class="ws-row"><span class="ws-label">FPS</span><span class="ws-value">{{ statsDisplay.fps }}</span></div>
        <div class="ws-row"><span class="ws-label">RTT</span><span class="ws-value">{{ statsDisplay.rtt }}</span></div>
        <div class="ws-row"><span class="ws-label">Jitter</span><span class="ws-value">{{ statsDisplay.jitter }}</span></div>
        <div class="ws-row"><span class="ws-label">Bitrate</span><span class="ws-value">{{ statsDisplay.bitrate }}</span></div>
        <div class="ws-row"><span class="ws-label">Loss</span><span class="ws-value" :class="statsDisplay.lossClass">{{ statsDisplay.loss }}</span></div>
        <div class="ws-row"><span class="ws-label">Res</span><span class="ws-value">{{ statsDisplay.resolution }}</span></div>
        <div class="ws-row"><span class="ws-label">Codec</span><span class="ws-value">{{ statsDisplay.codec }}</span></div>
        <div class="ws-row"><span class="ws-label">链路</span><span class="ws-value">{{ pipelineHealthLines.link }}</span></div>
        <div class="ws-row"><span class="ws-label">诊断</span><span class="ws-value">{{ pipelineHealthLines.hint }}</span></div>
      </div>
    </Transition>

    <div v-if="loading" class="webrtc-loading">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
    <div v-if="error" class="webrtc-error-wrap">
      <div class="webrtc-error">{{ error }}</div>
      <div class="webrtc-error-hint">ICE 连接失败常见原因：1) ZLMediaKit 需配置 rtp.externalIP 为客户端可访问的 IP；2) 防火墙需放行 UDP；3) 跨网段时需 TURN 服务器</div>
      <a-button type="link" size="small" @click="retry">重试</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  /** 便于详情页打点：区分卡顿候选 vs 连接断开会话 */
  (e: 'media-health-change', payload: MediaHealthPayload): void
}>()

/** ICE/peer；收流停滞用 stats；渲染停滞用 requestVideoFrameCallback */
interface MediaHealthPayload {
  kind: 'healthy' | 'stall_inbound' | 'stall_render' | 'disconnect_ice' | 'peer_disconnected' | 'recovering'
  peerState: string | null
  iceState: string | null
  /** 最近一次恢复动作说明 */
  lastRecoveryHint: string | null
}

const props = withDefaults(
  defineProps<{
    baseUrl: string
    app: string
    stream: string
    /** 实时远控场景：隐藏进度条，仅显示 LIVE 状态 */
    liveOnly?: boolean
    /** 车云网络 RTT(估) ms，来自 cloud_link_network_rtt_ms；与 webrtc-net-badge 同排，在其左侧 */
    cloudLinkNetworkRttMs?: number | null
    showCloudLinkRtt?: boolean
    /**
     * 远控：更快 getStats、更短 ICE 宽限、收流停约 800ms 内触发软重拉（易多误重连，普通点播可关）
     */
    fastVideoRecovery?: boolean
  }>(),
  { liveOnly: true, showCloudLinkRtt: false, fastVideoRecovery: false }
)

const cloudLinkRttText = computed(() => {
  const v = props.cloudLinkNetworkRttMs
  if (v == null || !Number.isFinite(Number(v))) return '--'
  return `${Math.round(Number(v))} ms`
})

const cloudLinkRttTitle = computed(() =>
  t('parallel-driving.vehicle-detail.cloud-link-network-rtt-tooltip', {
    value: cloudLinkRttText.value,
  })
)

const videoRef = ref<HTMLVideoElement | null>(null)
/** 根容器，用于按 video 原始分辨率计算 contain 后的绘制区，使顶栏贴在「实际画面」右上角而非黑边 */
const playerBoxRef = ref<HTMLElement | null>(null)
/** contain 后画面相对播放器左上角的 inset，用于定位顶栏/统计浮层 */
const containFrameInset = ref<{
  top: number
  rightGap: number
  contentW: number
} | null>(null)

let uiSyncRaf: number = 0
let boxResizeObserver: ResizeObserver | null = null

const syncUiToContainFrame = () => {
  const v = videoRef.value
  const box = playerBoxRef.value
  if (!v || !box) {
    containFrameInset.value = null
    return
  }
  const vw = v.videoWidth
  const vh = v.videoHeight
  const cw = box.clientWidth
  const ch = box.clientHeight
  if (!vw || !vh || !cw || !ch) {
    containFrameInset.value = null
    return
  }
  const scale = Math.min(cw / vw, ch / vh)
  const dw = vw * scale
  const dh = vh * scale
  const left = (cw - dw) / 2
  const top = (ch - dh) / 2
  containFrameInset.value = {
    top,
    rightGap: cw - left - dw,
    contentW: dw,
  }
}

const scheduleSyncUiToContainFrame = () => {
  if (uiSyncRaf) cancelAnimationFrame(uiSyncRaf)
  uiSyncRaf = requestAnimationFrame(() => {
    uiSyncRaf = 0
    syncUiToContainFrame()
  })
}

const onVideoLayoutChange = () => scheduleSyncUiToContainFrame()

const UI_EDGE_PAD = 3
/** 顶栏默认与统计面板的竖向间距（与样式里 .webrtc-stats-panel top 一致） */
const STATS_PANEL_TOP_OFFSET = 30

const webrtcTopBarStyle = computed(() => {
  const inset = containFrameInset.value
  if (!inset) return undefined
  const maxW = Math.max(48, inset.contentW - UI_EDGE_PAD * 2)
  return {
    top: `${inset.top + UI_EDGE_PAD}px`,
    right: `${inset.rightGap + UI_EDGE_PAD}px`,
    maxWidth: `${maxW}px`,
  }
})

const webrtcStatsPanelStyle = computed(() => {
  const inset = containFrameInset.value
  if (!inset) return undefined
  return {
    top: `${inset.top + STATS_PANEL_TOP_OFFSET}px`,
    right: `${inset.rightGap + UI_EDGE_PAD}px`,
  }
})
const loading = ref(true)
const error = ref('')
let pc: RTCPeerConnection | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null
/** 首帧后一段时间内：ICE 易抖、RTP 易受 GOP 间距影响，避免「快出画就软重拉」 */
const POST_MEDIA_SETTLE_MS = 8000
/** 尚未收到 ontrack 前：connectionState 常在 connecting/connected/disconnected 间抖，加长宽限 */
const PRE_TRACK_DISCONNECT_EXTRA_MS = 5200
/** 建链末尾短暂 failed 有时是栈的瞬时态，去抖后再决定是否重拉 SDP */
const ICE_FAILED_DEFER_MS = 1500
let iceFailedDeferTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 快恢复（远控）：更勤 getStats，但若阈值过紧会在「刚出画面 + GOP 间隙」误触软重拉。
 * 已对 fast 路径：放宽 stall 阈值、加长 tick 窗口、首帧后 guard、ICE disconnected 宽限。
 * 标准：1s 统计、3s ICE 宽限、6 拍后才收流软重拉。
 */
const recoveryConfig = computed(() => {
  if (props.fastVideoRecovery) {
    return {
      statsIntervalMs: 250,
      disconnectGraceMs: 1600,
      reconnectDelayMs: 180,
      /** 连续多少拍几乎无收流 → 标「收流卡」 */
      inboundZeroTicksFlag: 4,
      /** 连续多少拍 RTP 字节几乎不增长 → 软重拉（与 statsIntervalMs 相乘为过短易在刚出画面后误触发） */
      inboundStallReconnectTicks: 8,
      renderStallMs: 1100,
      disconnectGraceHintMs: 1600,
    }
  }
  return {
    statsIntervalMs: 1000,
    disconnectGraceMs: 3000,
    reconnectDelayMs: 500,
    inboundZeroTicksFlag: 2,
    inboundStallReconnectTicks: 6,
    renderStallMs: 2000,
    disconnectGraceHintMs: 3000,
  }
})

/**
 * 同页多路共弱网时，若同时满足重连条件会「同一时刻」打 SDP，表现为一起刷。
 * 每路仅用自己的 app+stream 做稳定 hash，给重连/宽限加错峰（无全局锁、不共享状态）。
 */
const staggerMsForThisStream = (extraMax: number) => {
  if (extraMax <= 0) return 0
  const s = `${props.app}|${props.stream}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % extraMax
}

let rvfcMonitoring = false
const peerConnectionState = ref<string | null>(null)
const iceConnectionState = ref<string | null>(null)
const lastRecoveryHint = ref<string | null>(null)
/** 独立于 peer：收流是否真的在动（卡顿 vs 短暂缓冲） */
const inboundStalled = ref(false)
const renderStalled = ref(false)
/** 任一自动重拉已排隊 */
const reconnectScheduled = ref(false)

const lastFramePresentedAt = ref(0)

const stopRvfcMonitoring = () => {
  rvfcMonitoring = false
  lastFramePresentedAt.value = 0
}

const beginRvfcMonitoring = () => {
  stopRvfcMonitoring()
  const v = videoRef.value
  if (!v || typeof v.requestVideoFrameCallback !== 'function') return
  rvfcMonitoring = true
  const step: VideoFrameRequestCallback = () => {
    if (!rvfcMonitoring || !videoRef.value) return
    lastFramePresentedAt.value = performance.now()
    videoRef.value.requestVideoFrameCallback(step)
  }
  try {
    v.requestVideoFrameCallback(step)
  } catch {
    rvfcMonitoring = false
  }
}

// 播放时长（自开始播放起计时）
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
const elapsedText = computed(() => {
  const s = elapsedSeconds.value
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})
const startElapsedTimer = () => {
  stopElapsedTimer()
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}
const stopElapsedTimer = () => {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

// ── WebRTC Stats ──
const showStats = ref(false)

interface RtcStats {
  fps: number | null
  rttMs: number | null
  jitterMs: number | null
  bitrateKbps: number | null
  packetsLost: number
  packetsReceived: number
  frameWidth: number | null
  frameHeight: number | null
  codec: string
}

const rtcStats = ref<RtcStats>({
  fps: null, rttMs: null, jitterMs: null, bitrateKbps: null,
  packetsLost: 0, packetsReceived: 0,
  frameWidth: null, frameHeight: null, codec: '',
})

const statsDisplay = computed(() => {
  const s = rtcStats.value
  const fmt = (v: number | null, unit: string, decimals = 1) =>
    v != null && Number.isFinite(v) ? `${v.toFixed(decimals)} ${unit}` : '—'

  const lossRate = s.packetsReceived > 0
    ? (s.packetsLost / (s.packetsReceived + s.packetsLost)) * 100
    : 0
  const lossStr = s.packetsReceived > 0 ? `${lossRate.toFixed(1)}%` : '—'

  let bitrateStr = '—'
  if (s.bitrateKbps != null && Number.isFinite(s.bitrateKbps)) {
    bitrateStr = s.bitrateKbps >= 1000
      ? `${(s.bitrateKbps / 1000).toFixed(1)} Mbps`
      : `${s.bitrateKbps.toFixed(0)} kbps`
  }

  return {
    fps: s.fps != null ? `${Math.round(s.fps)}` : '—',
    rtt: fmt(s.rttMs, 'ms', 0),
    jitter: fmt(s.jitterMs, 'ms', 1),
    bitrate: bitrateStr,
    loss: lossStr,
    lossClass: lossRate > 5 ? 'ws-warn' : lossRate > 1 ? 'ws-caution' : '',
    resolution: s.frameWidth && s.frameHeight ? `${s.frameWidth}×${s.frameHeight}` : '—',
    codec: s.codec || '—',
  }
})

/** 链路层展示：Peer / ICE（getStats 周期见 fastVideoRecovery） */
const pipelineHealthLines = computed(() => {
  const graceMs = recoveryConfig.value.disconnectGraceHintMs
  const peer = peerConnectionState.value ?? '—'
  const icing = iceConnectionState.value ?? '—'
  const link = `peer:${peer} · ice:${icing}`
  if (reconnectScheduled.value) {
    return {
      link,
      hint: lastRecoveryHint.value || 'scheduled reconnect · 远端或收流阈值触发',
    }
  }
  if (peer === 'failed' || icing === 'failed') {
    return {
      link,
      hint: 'ICE/Peer failed（断连）：将 teardown 并重拉 SDP',
    }
  }
  if (peer === 'disconnected') {
    return {
      link,
      hint:
        `Peer disconnected：若 ${graceMs}ms 内不自愈则按 ICE 断开处理（短暂 flap 属正常抖动）`,
    }
  }
  if (renderStalled.value && !inboundStalled.value) {
    return {
      link,
      hint:
        `疑似页面/解码卡顿：RTP仍在进但画布 >${recoveryConfig.value.renderStallMs}ms 无新帧（rvfc）`,
    }
  }
  if (inboundStalled.value) {
    return {
      link,
      hint:
        '收流停滞候选：链路仍 connected·inbound-rtp字节不增长；多为上游抖动/服务端无帧；达阈值将自动软重拉',
    }
  }
  return {
    link,
    hint:
      '链路正常 · 若为偶发顿挫多为 jitter buffer/GOP（非本项目 UI 特例）',
  }
})

/** 徽章：卡顿 vs 断连 vs 恢复中 */
const healthUi = computed(() => {
  type Tone = 'warn' | 'bad' | 'recover' | ''
  const empty = { tone: '' as Tone, label: '', tooltip: '' as string }
  if (loading.value && !reconnectScheduled.value) return empty
  if (reconnectScheduled.value) {
    return {
      tone: 'recover',
      label: '重拉',
      tooltip: lastRecoveryHint.value ?? '自动重拉',
    }
  }
  if (
    peerConnectionState.value === 'failed' ||
    iceConnectionState.value === 'failed'
  ) {
    return {
      tone: 'bad',
      label: '断连',
      tooltip: lastRecoveryHint.value ?? 'peer/ICE failed → 重建连接',
    }
  }
  if (peerConnectionState.value === 'disconnected') {
    return {
      tone: 'warn',
      label: '链路不稳',
      tooltip: `ICE 瞬时断开，${recoveryConfig.value.disconnectGraceHintMs}ms 内不自愈将重拉`,
    }
  }
  if (renderStalled.value && !inboundStalled.value) {
    return {
      tone: 'warn',
      label: '画面卡',
      tooltip: pipelineHealthLines.value.hint,
    }
  }
  if (inboundStalled.value) {
    return {
      tone: 'warn',
      label: '收流卡',
      tooltip: pipelineHealthLines.value.hint,
    }
  }
  return empty
})

const mediaHealthPayload = computed((): MediaHealthPayload => ({
  kind: (() => {
    if (reconnectScheduled.value) return 'recovering'
    const peer = peerConnectionState.value
    const icing = iceConnectionState.value
    if (peer === 'failed' || icing === 'failed') return 'disconnect_ice'
    if (
      peer === 'disconnected' ||
      peer === 'closed' ||
      icing === 'disconnected'
    )
      return 'peer_disconnected'
    if (renderStalled.value && !loading.value) return 'stall_render'
    if (inboundStalled.value && !loading.value) return 'stall_inbound'
    return 'healthy'
  })(),
  peerState: peerConnectionState.value,
  iceState: iceConnectionState.value,
  lastRecoveryHint: lastRecoveryHint.value,
}))

let statsTimer: ReturnType<typeof setInterval> | null = null
let lastBytes = 0
let lastTime = 0
let zeroInboundStreak = 0
let hadInboundProgress = false

/** 首帧已出画面后的时间锚点：用于屏蔽「刚连上/GOP 间隙」触发的误判软重拉 */
let firstStableMediaAtMs = 0
/** fastVideoRecovery：此窗口内不因 inbound_stall 自动重拉（与 POST_MEDIA_SETTLE_MS 叠加时取较长保护） */
const FAST_INBOUND_STALL_GUARD_MS = 6500

const resetInboundStreakState = () => {
  zeroInboundStreak = 0
  hadInboundProgress = false
  lastBytes = 0
  lastTime = 0
}

const stopStatsMonitor = () => {
  if (statsTimer) {
    clearInterval(statsTimer)
    statsTimer = null
  }
  resetInboundStreakState()
}

const startStatsMonitor = () => {
  if (!pc || statsTimer) return
  lastBytes = 0
  lastTime = Date.now()

  statsTimer = setInterval(async () => {
    const conn = pc
    if (!conn) { stopStatsMonitor(); return }
    try {
      const allStats = await conn.getStats()
      let bytesReceived = 0
      const patch: Partial<RtcStats> = {}

      allStats.forEach((report: any) => {
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video') && !report.isRemote) {
          bytesReceived = report.bytesReceived ?? 0
          if (report.framesPerSecond != null) patch.fps = report.framesPerSecond
          if (report.jitter != null) patch.jitterMs = report.jitter * 1000
          patch.packetsLost = report.packetsLost ?? 0
          patch.packetsReceived = report.packetsReceived ?? 0
          if (report.frameWidth) patch.frameWidth = report.frameWidth
          if (report.frameHeight) patch.frameHeight = report.frameHeight
          if (report.codecId) {
            const codecReport: any = allStats.get(report.codecId)
            if (codecReport?.mimeType) {
              patch.codec = codecReport.mimeType.replace('video/', '')
            }
          }
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime != null) {
            patch.rttMs = report.currentRoundTripTime * 1000
          }
        }
      })

      const now = Date.now()
      const dt = (now - lastTime) / 1000
      const prevBytes = lastBytes
      const inboundDelta =
        bytesReceived >= prevBytes ? bytesReceived - prevBytes : 0
      if (dt > 0 && prevBytes > 0) {
        patch.bitrateKbps = (inboundDelta * 8) / 1000 / dt
      }
      lastBytes = bytesReceived
      lastTime = now

      rtcStats.value = { ...rtcStats.value, ...patch }

      const peerSt = conn.connectionState
      const icing = conn.iceConnectionState
      peerConnectionState.value = peerSt
      iceConnectionState.value = icing

      if (bytesReceived > 2048 && inboundDelta > 0) hadInboundProgress = true

      const connectedOk =
        peerSt === 'connected' &&
        icing !== 'failed' &&
        icing !== 'closed'

      const rCfg = recoveryConfig.value

      /** 远端 GOP/低码率统计窗口内字节增量常为 0，快恢复路径阈值过紧会秒级误触软重拉 */
      const stallByteEps =
        props.fastVideoRecovery && rCfg.statsIntervalMs < 500 ? 56 : 8

      if (connectedOk && !loading.value && hadInboundProgress) {
        if (inboundDelta < stallByteEps && bytesReceived >= 2048) {
          zeroInboundStreak += 1
        } else {
          zeroInboundStreak = 0
        }
      } else {
        zeroInboundStreak = 0
      }

      inboundStalled.value =
        connectedOk &&
        !loading.value &&
        hadInboundProgress &&
        zeroInboundStreak >= recoveryConfig.value.inboundZeroTicksFlag

      const perfNow = performance.now()
      const noFrameForMs =
        lastFramePresentedAt.value > 0
          ? perfNow - lastFramePresentedAt.value
          : 0
      renderStalled.value =
        !!(
          connectedOk &&
          !loading.value &&
          inboundDelta > (props.fastVideoRecovery ? 560 : 400) &&
          noFrameForMs > rCfg.renderStallMs
        )

      if (
        zeroInboundStreak >= rCfg.inboundStallReconnectTicks &&
        connectedOk &&
        !reconnectScheduled.value
      ) {
        const msSinceMedia = firstStableMediaAtMs ? Date.now() - firstStableMediaAtMs : Infinity
        const inPostMediaSettle =
          firstStableMediaAtMs > 0 && msSinceMedia >= 0 && msSinceMedia < POST_MEDIA_SETTLE_MS
        const inFastInboundGuard =
          props.fastVideoRecovery &&
          firstStableMediaAtMs > 0 &&
          msSinceMedia < FAST_INBOUND_STALL_GUARD_MS
        if (inPostMediaSettle || inFastInboundGuard) {
          zeroInboundStreak = Math.max(
            0,
            Math.floor(rCfg.inboundStallReconnectTicks / 2),
          )
        } else {
          scheduleReconnect('inbound_stall')
        }
      }

      if (
        renderStalled.value &&
        connectedOk &&
        !reconnectScheduled.value &&
        !inboundStalled.value
      ) {
        ensureVideoPlaying()
      }
    } catch { /* connection closed */ }
  }, recoveryConfig.value.statsIntervalMs)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** ZLM 常见：流尚未注册到 mediaserver 时返回英文/中文「找不到流」 */
function isZlmStreamNotFoundMessage(msg: string): boolean {
  const s = msg.toLowerCase().trim()
  if (!s) return false
  return (
    /stream\s+not\s+found/.test(s) ||
    /can\s*not\s*find\s*stream/.test(s) ||
    /cannot\s*find\s*stream/.test(s) ||
    /no\s+such\s+stream/.test(s) ||
    /stream\s+not\s+exist/.test(s) ||
    /流未找到|流不存在|未找到流|无此流/.test(msg)
  )
}

type WebrtcPlayErrorCtx = { app?: string; stream?: string }

/** 浏览器对 fetch 网络层失败常抛 `Failed to fetch`，原样显示不利于排查 */
function formatWebrtcPlayError(e: unknown, ctx?: WebrtcPlayErrorCtx): string {
  const raw =
    e != null && typeof e === 'object' && 'message' in e && typeof (e as Error).message === 'string'
      ? (e as Error).message
      : String(e)
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return `${raw}。常见原因：ZLMediaKit 地址不可达或 CORS 未放行；HTTPS 页面不能请求 http 流（混合内容）；本机防火墙/代理拦截。`
  }
  if (isZlmStreamNotFoundMessage(raw)) {
    const who =
      ctx?.app && ctx?.stream
        ? `（app=${ctx.app}，stream=${ctx.stream}）`
        : ''
    return `${raw}${who}。含义：ZLMediaKit 上该 app 下尚无此流——车端可能尚未推该路、流名与配置不一致，或推流比页面拉流晚几秒。远控已自动重试若干次；仍失败请核对 ZLM 后台流列表或点「重试」。`
  }
  return raw
}

const play = async () => {
  if (!props.baseUrl || !props.app || !props.stream) return
  await nextTick()
  if (iceFailedDeferTimer != null) {
    clearTimeout(iceFailedDeferTimer)
    iceFailedDeferTimer = null
  }
  if (!videoRef.value) {
    error.value = '视频元素未就绪'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  firstStableMediaAtMs = 0

  /** 单次建 PeerConnection → ICE → POST SDP；成功则保持 pc 与后续逻辑 */
  const negotiateZlmWebrtcOnce = async () => {
    const conn = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: [],
      iceTransportPolicy: 'all',
    })
    pc = conn
    const videoTransceiver = conn.addTransceiver('video', { direction: 'recvonly' })
    conn.addTransceiver('audio', { direction: 'recvonly' })

    // 低延迟直播场景：提示 jitter buffer 最小化缓冲，避免 modify_stamp 时间戳平滑导致的 ~220ms 地板
    if ('playoutDelayHint' in videoTransceiver.receiver) {
      ;(videoTransceiver.receiver as any).playoutDelayHint = 0
    }

    conn.ontrack = (e) => {
      if (e.receiver && 'playoutDelayHint' in e.receiver) {
        ;(e.receiver as any).playoutDelayHint = 0
      }
      if (videoRef.value && e.streams[0]) {
        videoRef.value.srcObject = e.streams[0]
        videoRef.value.play().catch(() => {})
        loading.value = false
        error.value = ''
        firstStableMediaAtMs = Date.now()
        startStatsMonitor()
        beginRvfcMonitoring()
        if (props.liveOnly) startElapsedTimer()
        void nextTick(() => scheduleSyncUiToContainFrame())
      }
    }
    conn.onconnectionstatechange = () => {
      const state = conn.connectionState
      peerConnectionState.value = state ?? null
      if (state === 'connected') {
        reconnectScheduled.value = false
        cancelDisconnectGrace()
        if (iceFailedDeferTimer != null) {
          clearTimeout(iceFailedDeferTimer)
          iceFailedDeferTimer = null
        }
      } else if (state === 'disconnected') {
        startDisconnectGrace()
      } else if (state === 'failed') {
        cancelDisconnectGrace()
        const awaitingFirstFrame = loading.value || firstStableMediaAtMs === 0
        const inSettleAfterFirst =
          firstStableMediaAtMs > 0 &&
          Date.now() - firstStableMediaAtMs < POST_MEDIA_SETTLE_MS
        if (awaitingFirstFrame || inSettleAfterFirst) {
          if (iceFailedDeferTimer != null) clearTimeout(iceFailedDeferTimer)
          iceFailedDeferTimer = setTimeout(() => {
            iceFailedDeferTimer = null
            if (!pc || pc.connectionState !== 'failed') return
            lastRecoveryHint.value =
              'PeerConnection failed（建链/首帧窗口去抖后仍为 failed）→ SDP 重建'
            scheduleReconnect('ice_peer_failed')
          }, ICE_FAILED_DEFER_MS)
        } else {
          if (iceFailedDeferTimer != null) {
            clearTimeout(iceFailedDeferTimer)
            iceFailedDeferTimer = null
          }
          scheduleReconnect('ice_peer_failed')
        }
      }
    }

    const offer = await conn.createOffer()
    await conn.setLocalDescription(offer)
    if (conn.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (!done) {
            done = true
            conn.removeEventListener('icegatheringstatechange', onStateChange)
            resolve()
          }
        }
        const onStateChange = () => {
          if (conn.iceGatheringState === 'complete') finish()
        }
        conn.addEventListener('icegatheringstatechange', onStateChange)
        setTimeout(finish, 3000)
      })
    }

    const url = `${props.baseUrl.replace(/\/$/, '')}/index/api/webrtc?app=${encodeURIComponent(props.app)}&stream=${encodeURIComponent(props.stream)}&type=play`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: conn.localDescription!.sdp,
      mode: 'cors',
    })
    const text = await res.text()
    let data: { code?: number; sdp?: string; msg?: string; message?: string }
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(res.ok ? '响应格式错误' : `请求失败 ${res.status}: ${text.slice(0, 100)}`)
    }
    if (data.code !== 0 || !data.sdp) {
      throw new Error(data.msg || data.message || `服务端错误 code=${data.code}`)
    }
    await conn.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }))
    startStatsMonitor()
    setTimeout(() => {
      if (loading.value && pc) {
        error.value = '未收到视频流，请确认流已推送到 ZLMediaKit'
        loading.value = false
      }
    }, 10000)
  }

  const ctx: WebrtcPlayErrorCtx = { app: props.app, stream: props.stream }
  /** 远控：流晚于 UI 注册时 ZLM 常先返回 stream not found；多给几次短间隔重试 */
  const streamNotFoundMaxExtra = props.fastVideoRecovery ? 5 : 3

  try {
    for (let attempt = 0; attempt <= streamNotFoundMaxExtra; attempt++) {
      try {
        await negotiateZlmWebrtcOnce()
        return
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        softStop()
        if (!isZlmStreamNotFoundMessage(msg) || attempt >= streamNotFoundMaxExtra) {
          throw e
        }
        await sleep(520 + attempt * 380 + staggerMsForThisStream(320))
      }
    }
  } catch (e: unknown) {
    error.value = formatWebrtcPlayError(e, ctx)
    loading.value = false
    reconnectScheduled.value = false
    softStop()
  }
}

const cancelReconnect = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

const cancelDisconnectGrace = () => {
  if (disconnectGraceTimer) {
    clearTimeout(disconnectGraceTimer)
    disconnectGraceTimer = null
  }
}

/**
 * disconnected 是临时状态；在「等首帧」或「首帧后短窗」内 ICE 更易抖，需在基础宽限上再加时间，
 * 否则会表现为「快出画 / 快连上又软重拉」。
 */
const startDisconnectGrace = () => {
  cancelDisconnectGrace()
  const stagger = staggerMsForThisStream(props.fastVideoRecovery ? 280 : 450)
  let settleOrPreTrackExtra = 0
  if (loading.value) {
    settleOrPreTrackExtra += PRE_TRACK_DISCONNECT_EXTRA_MS
  } else if (firstStableMediaAtMs > 0) {
    const since = Date.now() - firstStableMediaAtMs
    if (since >= 0 && since < POST_MEDIA_SETTLE_MS)
      settleOrPreTrackExtra += POST_MEDIA_SETTLE_MS - since
  }
  const delay =
    recoveryConfig.value.disconnectGraceMs + stagger + settleOrPreTrackExtra
  disconnectGraceTimer = setTimeout(() => {
    if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
      lastRecoveryHint.value = 'disconnect 超时仍失败 → SDP 重建'
      scheduleReconnect('disconnect_grace')
    }
  }, delay)
}

const scheduleReconnect = (reason: string) => {
  cancelReconnect()
  if (!props.baseUrl || !props.app || !props.stream) return
  reconnectScheduled.value = true
  if (reason === 'inbound_stall') {
    lastRecoveryHint.value =
      '收流 RTP 字节在 connected 状态下长期不增长：按收流停滞软重拉'
  } else if (reason === 'disconnect_grace') {
    lastRecoveryHint.value =
      'Peer disconnected 超过宽限期未恢复 → 重建 SDP / ICE'
  } else if (reason === 'ice_peer_failed') {
    lastRecoveryHint.value = 'PeerConnection failed → SDP 重建'
  } else {
    lastRecoveryHint.value = `reconnect:${reason}`
  }
  reconnectTimer = setTimeout(() => {
    softStop()
    play()
  }, recoveryConfig.value.reconnectDelayMs + staggerMsForThisStream(props.fastVideoRecovery ? 400 : 600))
}

const ensureVideoPlaying = () => {
  const v = videoRef.value
  if (v && v.srcObject && v.paused) {
    v.play().catch(() => {})
  }
}

/**
 * Soft stop: close PeerConnection but keep video srcObject alive
 * to avoid black frame flash that triggers browser fullscreen exit.
 */
const softStop = () => {
  cancelReconnect()
  cancelDisconnectGrace()
  if (iceFailedDeferTimer != null) {
    clearTimeout(iceFailedDeferTimer)
    iceFailedDeferTimer = null
  }
  stopStatsMonitor()
  stopRvfcMonitoring()
  firstStableMediaAtMs = 0
  inboundStalled.value = false
  renderStalled.value = false
  if (pc) {
    pc.onconnectionstatechange = null
    pc.ontrack = null
    pc.close()
    pc = null
  }
  peerConnectionState.value = null
  iceConnectionState.value = null
  error.value = ''
}

const stop = () => {
  softStop()
  stopElapsedTimer()
  containFrameInset.value = null
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  loading.value = true
}

/** 防抖：_vehicle / 路由 / 勾选在短窗口内连着变时，合并为一次 teardown+SDP，减轻「无端全路重连」观感 */
let videoSourceFlushTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.baseUrl, props.app, props.stream] as const,
  (tuple, oldTuple) => {
    const same =
      oldTuple != null &&
      tuple[0] === oldTuple[0] &&
      tuple[1] === oldTuple[1] &&
      tuple[2] === oldTuple[2]
    if (same) return

    if (videoSourceFlushTimer != null) clearTimeout(videoSourceFlushTimer)
    /**
     * 左中右同时挂载时，若多路在同一毫秒对 ZLM POST /index/api/webrtc，服务端或浏览器侧易瞬时失败，
     * 界面表现为 Failed to fetch；重新勾选仅会重建少数几路，故「点一下前/后/…」又正常。
     * baseDelay + staggerMsForThisStream：稳定错峰，与重连 stagger 同一套 hash。
     */
    const baseDelay = oldTuple === undefined ? 48 : 120
    const staggerWindow = props.fastVideoRecovery ? 420 : 560
    const delay = baseDelay + staggerMsForThisStream(staggerWindow)
    videoSourceFlushTimer = setTimeout(() => {
      videoSourceFlushTimer = null
      stop()
      if (props.baseUrl && props.app && props.stream) {
        void play()
      } else {
        loading.value = false
      }
    }, delay)
  },
  { immediate: true }
)

const retry = () => {
  stop()
  error.value = ''
  loading.value = true
  play()
}

watch(
  () => ({
    k: mediaHealthPayload.value.kind,
    inb: inboundStalled.value,
    ren: renderStalled.value,
    rec: reconnectScheduled.value,
    hint: lastRecoveryHint.value,
    peer: peerConnectionState.value,
    ice: iceConnectionState.value,
  }),
  () => emit('media-health-change', mediaHealthPayload.value),
)

watch(
  () => props.fastVideoRecovery,
  () => {
    if (pc && statsTimer) {
      stopStatsMonitor()
      startStatsMonitor()
    }
  }
)

const onFsChange = () => {
  ensureVideoPlaying()
  scheduleSyncUiToContainFrame()
}
const onVisChange = () => {
  if (!document.hidden) ensureVideoPlaying()
}
document.addEventListener('fullscreenchange', onFsChange)
document.addEventListener('visibilitychange', onVisChange)

onMounted(() => {
  void nextTick(() => {
    const box = playerBoxRef.value
    if (box && !boxResizeObserver) {
      boxResizeObserver = new ResizeObserver(onVideoLayoutChange)
      boxResizeObserver.observe(box)
    }
    const v = videoRef.value
    if (v) {
      v.addEventListener('loadedmetadata', onVideoLayoutChange)
      v.addEventListener('resize', onVideoLayoutChange as EventListener)
    }
    scheduleSyncUiToContainFrame()
  })
})

onBeforeUnmount(() => {
  if (videoSourceFlushTimer != null) {
    clearTimeout(videoSourceFlushTimer)
    videoSourceFlushTimer = null
  }
  if (boxResizeObserver) {
    boxResizeObserver.disconnect()
    boxResizeObserver = null
  }
  if (uiSyncRaf) {
    cancelAnimationFrame(uiSyncRaf)
    uiSyncRaf = 0
  }
  const v = videoRef.value
  if (v) {
    v.removeEventListener('loadedmetadata', onVideoLayoutChange)
    v.removeEventListener('resize', onVideoLayoutChange as EventListener)
  }
  cancelDisconnectGrace()
  stop()
  document.removeEventListener('fullscreenchange', onFsChange)
  document.removeEventListener('visibilitychange', onVisChange)
})

defineExpose({ play, stop, retry })
</script>

<style scoped lang="less">
.webrtc-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;

  video { display: block; }

  // 右上角：码率徽章 + 统计开关（与常见视频控件习惯一致）
  .webrtc-top-bar {
    position: absolute;
    top: 3px;
    right: 3px;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    max-width: calc(100% - 8px);
    pointer-events: none;
    & > * {
      pointer-events: auto;
    }
  }

  // 车云网络延时(估)，在 webrtc-net-badge（码率/fps）左侧
  .webrtc-cloud-link-rtt {
    display: flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.88);
    background: rgba(0, 0, 0, 0.45);
    user-select: none;
    line-height: 1.5;
    flex-shrink: 0;
    order: 0;
  }

  .webrtc-net-badge {
    order: 1;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(0, 0, 0, 0.4);
    user-select: none;
    line-height: 1.5;
    flex-shrink: 1;
    min-width: 0;
  }
  .wnb-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }
  .wnb-dot-warn { background: #eab308; }
  .wnb-dot-bad { background: #ef4444; }
  .wnb-dot-recover { background: #38bdf8; }
  .wnb-health-label {
    flex-shrink: 1;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.85);
  }
  .webrtc-net-badge.wnb-health-warn {
    background: rgba(120, 53, 15, 0.45);
  }
  .webrtc-net-badge.wnb-health-bad {
    background: rgba(127, 29, 29, 0.5);
  }
  .webrtc-net-badge.wnb-health-recover {
    background: rgba(12, 74, 110, 0.5);
  }
  .wnb-bitrate { color: rgba(255, 255, 255, 0.8); }
  .wnb-fps { color: rgba(255, 255, 255, 0.55); }
  .wnb-sep { color: rgba(255, 255, 255, 0.25); font-weight: 400; }
  .wnb-time { color: rgba(255, 255, 255, 0.5); }

  // ── Stats toggle button ──
  .webrtc-stats-toggle {
    order: 2;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.35);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
    &:hover { background: rgba(0, 0, 0, 0.65); color: #fff; }
    &.active { background: rgba(24, 144, 255, 0.75); color: #fff; }
  }

  // ── Stats panel ──
  .webrtc-stats-panel {
    position: absolute;
    top: 30px;
    right: 3px;
    left: auto;
    transform-origin: top right;
    z-index: 3;
    min-width: 150px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.9);
    pointer-events: none;
    user-select: none;
  }
  .ws-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2.5px 0;
    gap: 12px;
  }
  .ws-label {
    color: rgba(255, 255, 255, 0.45);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .ws-value {
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  .ws-warn { color: #ff4d4f; }
  .ws-caution { color: #faad14; }

  // ── Stats fade transition ──
  .stats-fade-enter-active,
  .stats-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
  .stats-fade-enter-from,
  .stats-fade-leave-to { opacity: 0; transform: translateY(-4px); }

  .webrtc-loading,
  .webrtc-error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 14px;
  }
  .webrtc-error-wrap { text-align: center; padding: 8px; }
  .webrtc-error { color: #ff4d4f; margin-bottom: 4px; }
  .webrtc-error-hint {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    margin-bottom: 8px;
    max-width: 280px;
    line-height: 1.4;
  }
}
</style>
