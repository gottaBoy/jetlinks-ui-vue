<!-- WebRTC 低延迟播放器，对接 ZLMediaKit /index/api/webrtc -->
<template>
  <div class="webrtc-player">
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
    <div v-if="!loading && !error" class="webrtc-net-badge">
      <span class="wnb-dot" />
      <span class="wnb-bitrate">{{ statsDisplay.bitrate }}</span>
      <span class="wnb-sep">·</span>
      <span class="wnb-fps">{{ statsDisplay.fps }}fps</span>
      <span v-if="props.liveOnly" class="wnb-sep">·</span>
      <span v-if="props.liveOnly" class="wnb-time">{{ elapsedText }}</span>
    </div>

    <button
      v-if="!loading && !error"
      class="webrtc-stats-toggle"
      :class="{ active: showStats }"
      @click="showStats = !showStats"
      title="WebRTC Stats"
    >
      <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
        <path d="M2 12h3v6H2zm5-4h3v10H7zm5-5h3v15h-3zm5 2h1v13h-1z"/>
      </svg>
    </button>

    <Transition name="stats-fade">
      <div v-if="showStats && !loading && !error" class="webrtc-stats-panel">
        <div class="ws-row"><span class="ws-label">FPS</span><span class="ws-value">{{ statsDisplay.fps }}</span></div>
        <div class="ws-row"><span class="ws-label">RTT</span><span class="ws-value">{{ statsDisplay.rtt }}</span></div>
        <div class="ws-row"><span class="ws-label">Jitter</span><span class="ws-value">{{ statsDisplay.jitter }}</span></div>
        <div class="ws-row"><span class="ws-label">Bitrate</span><span class="ws-value">{{ statsDisplay.bitrate }}</span></div>
        <div class="ws-row"><span class="ws-label">Loss</span><span class="ws-value" :class="statsDisplay.lossClass">{{ statsDisplay.loss }}</span></div>
        <div class="ws-row"><span class="ws-label">Res</span><span class="ws-value">{{ statsDisplay.resolution }}</span></div>
        <div class="ws-row"><span class="ws-label">Codec</span><span class="ws-value">{{ statsDisplay.codec }}</span></div>
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
import { ref, watch, onBeforeUnmount, nextTick, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    baseUrl: string
    app: string
    stream: string
    /** 实时远控场景：隐藏进度条，仅显示 LIVE 状态 */
    liveOnly?: boolean
  }>(),
  { liveOnly: true }
)

const videoRef = ref<HTMLVideoElement | null>(null)
const loading = ref(true)
const error = ref('')
let pc: RTCPeerConnection | null = null

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

let statsTimer: ReturnType<typeof setInterval> | null = null
let lastBytes = 0
let lastTime = 0

const stopStatsMonitor = () => {
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null }
  lastBytes = 0; lastTime = 0
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
      if (dt > 0 && lastBytes > 0) {
        const delta = bytesReceived >= lastBytes ? bytesReceived - lastBytes : 0
        patch.bitrateKbps = (delta * 8) / 1000 / dt
      }
      lastBytes = bytesReceived
      lastTime = now

      rtcStats.value = { ...rtcStats.value, ...patch }
    } catch { /* connection closed */ }
  }, 1000)
}

const play = async () => {
  if (!props.baseUrl || !props.app || !props.stream) return
  await nextTick()
  if (!videoRef.value) {
    error.value = '视频元素未就绪'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    pc = new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      iceServers: [],              // [{ urls: 'stun:stun.l.google.com:19302' }] 不用 Google STUN，靠 host candidates 即可
      iceTransportPolicy: 'all',
    })
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    pc.ontrack = (e) => {
      if (videoRef.value && e.streams[0]) {
        videoRef.value.srcObject = e.streams[0]
        loading.value = false
        startStatsMonitor()
        if (props.liveOnly) startElapsedTimer()
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') {
        error.value = `连接失败: ${pc.connectionState}`
        loading.value = false
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    // 等待 ICE 候选收集完成，确保 offer 包含完整候选再发送
    if (pc.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        let done = false
        const finish = () => {
          if (!done) {
            done = true
            pc?.removeEventListener('icegatheringstatechange', onStateChange)
            resolve()
          }
        }
        const onStateChange = () => {
          if (pc?.iceGatheringState === 'complete') finish()
        }
        pc.addEventListener('icegatheringstatechange', onStateChange)
        setTimeout(finish, 3000)
      })
    }

    const url = `${props.baseUrl.replace(/\/$/, '')}/index/api/webrtc?app=${encodeURIComponent(props.app)}&stream=${encodeURIComponent(props.stream)}&type=play`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: pc.localDescription!.sdp,
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
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }))
    startStatsMonitor()
    // 若 10 秒内未收到轨道，提示可能流不存在
    setTimeout(() => {
      if (loading.value && pc) {
        error.value = '未收到视频流，请确认流已推送到 ZLMediaKit'
        loading.value = false
      }
    }, 10000)
  } catch (e: any) {
    error.value = e?.message || String(e)
    loading.value = false
  }
}

const stop = () => {
  stopStatsMonitor()
  stopElapsedTimer()
  if (pc) {
    pc.close()
    pc = null
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  loading.value = true
  error.value = ''
}

watch(
  () => [props.baseUrl, props.app, props.stream],
  () => {
    stop()
    if (props.baseUrl && props.app && props.stream) {
      play()
    }
  },
  { immediate: true }
)

const retry = () => {
  stop()
  error.value = ''
  loading.value = true
  play()
}

onBeforeUnmount(stop)

defineExpose({ play, stop, retry })
</script>

<style scoped lang="less">
.webrtc-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;

  video { display: block; }

  .webrtc-net-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    z-index: 2;
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
    pointer-events: none;
    user-select: none;
    line-height: 1.5;
  }
  .wnb-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }
  .wnb-bitrate { color: rgba(255, 255, 255, 0.8); }
  .wnb-fps { color: rgba(255, 255, 255, 0.55); }
  .wnb-sep { color: rgba(255, 255, 255, 0.25); font-weight: 400; }
  .wnb-time { color: rgba(255, 255, 255, 0.5); }

  // ── Stats toggle button ──
  .webrtc-stats-toggle {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 4;
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
    transition: all 0.2s;
    &:hover { background: rgba(0, 0, 0, 0.65); color: #fff; }
    &.active { background: rgba(24, 144, 255, 0.75); color: #fff; }
  }

  // ── Stats panel ──
  .webrtc-stats-panel {
    position: absolute;
    top: 30px;
    left: 4px;
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
