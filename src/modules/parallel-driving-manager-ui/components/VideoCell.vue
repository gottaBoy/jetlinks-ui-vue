<template>
  <div class="video-box" :class="{ 'video-box-front': isFront }">
    <div class="video-wrapper">
      <WebRtcPlayer
        v-if="protocol === 'webrtc' && stream"
        :base-url="baseUrl"
        :app="app"
        :stream="stream"
      />
      <Player
        v-else-if="url"
        :url="url"
        :protocol="protocol"
        :live="true"
        autoplay
      />
      <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
      <span class="video-badge">{{ label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import WebRtcPlayer from './WebRtcPlayer.vue'

defineProps<{
  label: string
  baseUrl: string
  app: string
  protocol: string
  stream: string | null
  url: string
  isFront?: boolean
}>()
</script>

<style scoped>
.video-box {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.video-wrapper {
  flex: 1;
  position: relative;
  aspect-ratio: 16 / 9;
  min-height: 120px;
}

.video-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 3;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  line-height: 1.4;
  pointer-events: none;
  user-select: none;
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
