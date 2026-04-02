<template>
  <div class="ota-status-panel">
    <div class="ota-header">
      <span class="ota-title">OTA 升级状态</span>
      <a-button size="small" @click="refresh" :loading="loading">
        刷新
      </a-button>
    </div>
    <a-descriptions v-if="otaData" :column="2" size="small" bordered>
      <a-descriptions-item label="固件版本">
        {{ otaData.firmware_version || '未知' }}
      </a-descriptions-item>
      <a-descriptions-item label="Agent 版本">
        {{ otaData.ota_agent_version || '未知' }}
      </a-descriptions-item>
      <a-descriptions-item label="OTA 状态">
        <a-tag :color="statusColor">{{ otaData.ota_status || '未上报' }}</a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="最近更新">
        {{ otaData.last_update_time || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="镜像引用" :span="2">
        <span class="mono-text">{{ otaData.image_ref || '-' }}</span>
      </a-descriptions-item>
      <a-descriptions-item v-if="otaData.ota_message" label="状态消息" :span="2">
        {{ otaData.ota_message }}
      </a-descriptions-item>
    </a-descriptions>
    <a-empty v-else-if="!loading" description="暂无 OTA 数据" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getVehicleOTAStatus } from '../api/parallel-driving'

const props = defineProps<{
  vehicleDeviceId: string
}>()

const loading = ref(false)
const otaData = ref<Record<string, string> | null>(null)

const statusColor = computed(() => {
  const s = otaData.value?.ota_status
  if (!s) return 'default'
  switch (s.toUpperCase()) {
    case 'SUCCESS': return 'green'
    case 'DOWNLOADING':
    case 'INSTALLING': return 'blue'
    case 'ERROR': return 'red'
    default: return 'default'
  }
})

async function refresh() {
  if (!props.vehicleDeviceId) return
  loading.value = true
  try {
    const res = await getVehicleOTAStatus(props.vehicleDeviceId)
    const result: Record<string, string> = {}
    const items = res?.result || res?.data || res || []
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        if (item.property && item.formatValue !== undefined) {
          result[item.property] = String(item.formatValue)
        } else if (item.property && item.value !== undefined) {
          result[item.property] = String(item.value)
        }
      })
    }
    otaData.value = Object.keys(result).length > 0 ? result : null
  } catch (e) {
    console.warn('Failed to load OTA status:', e)
    otaData.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.vehicleDeviceId, () => refresh())
onMounted(() => refresh())
</script>

<style scoped>
.ota-status-panel {
  padding: 12px;
}
.ota-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.ota-title {
  font-weight: 600;
  font-size: 14px;
}
.mono-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
