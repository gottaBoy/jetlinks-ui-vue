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
import { computed } from 'vue'
import WebRtcPlayer from './WebRtcPlayer.vue'

const props = defineProps<{
  label: string
  baseUrl: string
  app: string
  protocol: string
  stream: string | null
  url: string
  isFront?: boolean
}>()

const direction = computed(() => {
  const l = props.label?.toLowerCase() || ''
  if (l.includes('front') || l.includes('前')) return 'front'
  if (l.includes('back') || l.includes('后')) return 'back'
  if (l.includes('left') || l.includes('左')) return 'left'
  if (l.includes('right') || l.includes('右')) return 'right'
  return ''
})
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
  min-height: 0;
  overflow: hidden;
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
