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
    <div v-if="props.liveOnly && !loading && !error" class="webrtc-live-badge">
      <span>LIVE</span>
      <span class="webrtc-duration">{{ elapsedText }}</span>
    </div>
    <!-- <div v-if="bitrateText" class="webrtc-stats">
      <span>{{ bitrateText }}</span>
    </div> -->
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

const bitrateKbps = ref<number | null>(null)
const bitrateText = computed(() => {
  const v = bitrateKbps.value
  if (v == null) return ''
  if (!Number.isFinite(v)) return ''
  if (v >= 1000) return `${(v / 1000).toFixed(1)} Mbps`
  return `${v.toFixed(0)} kbps`
})

let statsTimer: ReturnType<typeof setInterval> | null = null
let lastBytes = 0
let lastTime = 0

const getInboundVideoBytes = async (conn: RTCPeerConnection) => {
  const stats = await conn.getStats()
  let bytesReceived = 0
  stats.forEach((report) => {
    const r: any = report as any
    if (r?.type !== 'inbound-rtp') return
    const mediaType = r.mediaType || r.kind
    if (mediaType !== 'video') return
    // 有些浏览器会带 isRemote，remote-inbound-rtp 不计入
    if (r.isRemote === true) return
    const b = typeof r.bytesReceived === 'number' ? r.bytesReceived : 0
    bytesReceived += b
  })
  return bytesReceived
}

const stopBitrateMonitor = () => {
  if (statsTimer) {
    clearInterval(statsTimer)
    statsTimer = null
  }
  bitrateKbps.value = null
  lastBytes = 0
  lastTime = 0
}

const startBitrateMonitor = () => {
  if (!pc || statsTimer) return
  lastBytes = 0
  lastTime = Date.now()
  bitrateKbps.value = null

  statsTimer = setInterval(async () => {
    const conn = pc
    if (!conn) {
      stopBitrateMonitor()
      return
    }
    try {
      const bytes = await getInboundVideoBytes(conn)
      const now = Date.now()
      const dt = (now - lastTime) / 1000
      if (dt > 0) {
        const deltaBytes = bytes >= lastBytes ? bytes - lastBytes : 0
        const kbps = (deltaBytes * 8) / 1000 / dt
        bitrateKbps.value = Math.max(0, kbps)
      }
      lastBytes = bytes
      lastTime = now
    } catch {
      // getStats 失败通常是连接已关闭或浏览器限制，忽略即可
    }
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
        startBitrateMonitor()
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
    startBitrateMonitor()
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
  stopBitrateMonitor()
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

  video {
    display: block;
  }

  .webrtc-live-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
    user-select: none;
  }

  .webrtc-live-badge span:first-child {
    color: #ff3b30;
    font-size: 11px;
  }

  .webrtc-duration {
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .webrtc-stats {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    padding: 4px 8px;
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
    user-select: none;
  }

  .webrtc-loading,
  .webrtc-error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
    font-size: 14px;
  }

  .webrtc-error-wrap {
    text-align: center;
    padding: 8px;
  }

  .webrtc-error {
    color: #ff4d4f;
    margin-bottom: 4px;
  }

  .webrtc-error-hint {
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    margin-bottom: 8px;
    max-width: 280px;
    line-height: 1.4;
  }
}
</style>
