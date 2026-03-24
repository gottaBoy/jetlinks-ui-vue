<template>
  <div class="control-panel-container">
    <!-- A. 顶部会话栏 -->
    <a-card :title="$t('parallel-driving.control-panel.session-bar')" :bordered="false" style="margin-bottom: 16px">
      <a-row :gutter="24" align="middle">
        <a-col :span="8">
          <a-form-item :label="$t('parallel-driving.control-panel.cockpit-device')">
            <a-select
              v-model:value="form.cockpitDeviceId"
              :placeholder="$t('parallel-driving.control-panel.select-cockpit')"
              :loading="cockpitLoading"
              :filter-option="false"
              show-search
              allow-clear
              option-label-prop="label"
              style="width: 100%"
              @search="handleCockpitSearch"
              @change="handleCockpitChange"
            >
              <a-select-option
                v-for="device in cockpitDevices"
                :key="device.value"
                :value="device.value"
                :label="device.label"
              >
                <a-space>
                  <span>{{ device.label }}</span>
                  <a-tag v-if="device.productId === 'parallel-driving-joystick'" color="blue" size="small">
                    {{ $t('parallel-driving.control-panel.joystick') }}
                  </a-tag>
                  <a-tag v-else-if="device.productId === 'parallel-driving-cockpit'" color="green" size="small">
                    {{ $t('parallel-driving.control-panel.cockpit') }}
                  </a-tag>
                </a-space>
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="$t('parallel-driving.control-panel.vehicle-device')">
            <a-select
              v-model:value="form.vehicleDeviceId"
              :placeholder="$t('parallel-driving.control-panel.select-vehicle')"
              :loading="vehicleLoading"
              :disabled="!form.cockpitDeviceId"
              :filter-option="false"
              show-search
              allow-clear
              option-label-prop="label"
              style="width: 100%"
              @search="handleVehicleSearch"
            >
              <a-select-option
                v-for="device in vehicleDevices"
                :key="device.value"
                :value="device.value"
                :label="device.label"
              >
                {{ device.label }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-space>
            <a-button
              type="primary"
              :loading="controlling"
              :disabled="!form.cockpitDeviceId || !form.vehicleDeviceId || isControlling || !hasPermission"
              @click="handleControl"
            >
              <template #icon>
                <AIcon type="PlayCircleOutlined" />
              </template>
              {{ $t('parallel-driving.control-panel.start-control') }}
            </a-button>
            <a-button
              danger
              :loading="stopping"
              :disabled="!form.cockpitDeviceId || !form.vehicleDeviceId || !isControlling"
              @click="handleStopControl"
            >
              <template #icon>
                <AIcon type="StopOutlined" />
              </template>
              {{ $t('parallel-driving.control-panel.stop-control') }}
            </a-button>
            <a-popover title="" trigger="click" placement="bottomRight">
              <template #content>
                <a-button size="small" @click="handleCheckPermission">
                  {{ $t('parallel-driving.control-panel.check-permission') }}
                </a-button>
              </template>
              <a-button type="text">
                <template #icon>
                  <AIcon type="MoreOutlined" />
                </template>
              </a-button>
            </a-popover>
          </a-space>
        </a-col>
      </a-row>
      <a-row :gutter="24" style="margin-top: 16px">
        <a-col :span="24">
          <a-space>
            <a-tag :color="getSessionStateColor(sessionState)">
              {{ getSessionStateText(sessionState) }}
            </a-tag>
            <a-tag :color="wsConnected ? 'green' : 'default'">
              <template #icon>
                <AIcon :type="wsConnected ? 'CheckCircleOutlined' : 'CloseCircleOutlined'" />
              </template>
              {{ wsConnected ? $t('parallel-driving.control-panel.ws-connected') : $t('parallel-driving.control-panel.ws-disconnected') }}
            </a-tag>
            <a-tag v-if="permissionStatus" :color="hasPermission ? 'green' : 'red'">
              {{ permissionStatus }}
            </a-tag>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- B. 实时状态卡 -->
    <a-card :title="$t('parallel-driving.control-panel.live-status')" :bordered="false" style="margin-bottom: 16px">
      <div v-if="Object.keys(briefStatus).length === 0" style="text-align: center; padding: 40px; color: #999">
        {{ $t('parallel-driving.control-panel.no-status-data') }}
      </div>
      <div v-else>
        <a-row :gutter="16">
          <a-col :span="6" v-for="(value, key) in briefStatus" :key="key">
            <a-statistic
              :title="key"
              :value="formatStatusValue(value)"
              :value-style="{ fontSize: '18px' }"
            />
          </a-col>
        </a-row>
        <a-collapse style="margin-top: 16px" ghost>
          <a-collapse-panel :header="$t('parallel-driving.control-panel.view-all-status')" key="1">
            <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; max-height: 300px; overflow: auto">{{ JSON.stringify(vehicleStatus, null, 2) }}</pre>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-card>

    <!-- C. 控车操作区 -->
    <ControlPad
      :cockpit-device-id="form.cockpitDeviceId"
      :vehicle-device-id="form.vehicleDeviceId"
      :disabled="!isControlling"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import { checkPermission, getCockpitDevices, queryBindList, getBoundVehicle, takeover, release } from '../api/parallel-driving'
import { initParallelDrivingWebSocket, closeParallelDrivingWebSocket } from '../utils/websocket'
import ControlPad from './ControlPad.vue'

const { t: $t } = useI18n()
const controlling = ref(false)
const stopping = ref(false)
const cockpitLoading = ref(false)
const vehicleLoading = ref(false)

const form = reactive({
  cockpitDeviceId: '',
  vehicleDeviceId: '',
})

const cockpitDevices = ref<Array<{ label: string; value: string; name?: string; productId?: string }>>([])
const vehicleDevices = ref<Array<{ label: string; value: string; name?: string }>>([])
const hasPermission = ref(false)
const permissionStatus = ref('')
const isControlling = ref(false)
const sessionState = ref<string>('')

// 车辆状态（从 WebSocket 接收）
const vehicleStatus = ref<Record<string, any>>({})

// 关键状态字段映射（可根据实际车辆属性调整）
const STATUS_KEY_MAP: Record<string, string> = {
  speed: $t('parallel-driving.control-panel.status-speed'),
  gear: $t('parallel-driving.control-panel.status-gear'),
  steering: $t('parallel-driving.control-panel.status-steering'),
  accelerator: $t('parallel-driving.control-panel.status-accelerator'),
  brake: $t('parallel-driving.control-panel.status-brake'),
  online: $t('parallel-driving.control-panel.status-online'),
}

// 提取关键状态
const briefStatus = computed(() => {
  const result: Record<string, any> = {}
  Object.keys(STATUS_KEY_MAP).forEach(key => {
    if (vehicleStatus.value[key] !== undefined) {
      result[STATUS_KEY_MAP[key]] = vehicleStatus.value[key]
    }
  })
  return result
})

const formatStatusValue = (value: any): string => {
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

// 加载驾驶舱设备列表
const loadCockpitDevices = async (keyword?: string) => {
  cockpitLoading.value = true
  try {
    const result = await getCockpitDevices({
      terms: keyword
        ? [
            {
              column: 'name',
              termType: 'like',
              value: `*${keyword}*`,
            },
          ]
        : [],
    })
    const data = result?.result || []
    cockpitDevices.value = data.map((item: any) => {
      const name = (item.name || '').trim()
      const id = (item.id || '').trim()
      const label = name ? `${name}(${id})` : id
      return {
        label,
        value: id,
        name: name || id,
        productId: item.productId, // 保存产品ID用于区分类型
      }
    })
  } catch (error) {
    console.error('加载驾驶舱设备失败:', error)
    onlyMessage($t('parallel-driving.control-panel.load-cockpit-devices-failed'), 'error')
  } finally {
    cockpitLoading.value = false
  }
}

// 加载车端设备列表（只显示已绑定授权车辆）
const loadVehicleDevices = async (keyword?: string) => {
  vehicleLoading.value = true
  try {
    if (!form.cockpitDeviceId) {
      vehicleDevices.value = []
      return
    }
    
    // 只展示该驾驶舱“已绑定（授权）”的车辆
    const result = await queryBindList({
      paging: false,
      terms: [
        {
          column: 'cockpitDeviceId',
          termType: 'eq',
          value: form.cockpitDeviceId,
        },
        ...(keyword
          ? [
              {
                column: 'vehicleDeviceName',
                termType: 'like',
                value: `*${keyword}*`,
              },
            ]
          : []),
      ],
      sorts: [{ name: 'bindTime', order: 'desc' }],
    })
    const data = result?.result?.data || []
    vehicleDevices.value = data.map((item: any) => {
      const name = (item.vehicleDeviceName || '').trim()
      const id = (item.vehicleDeviceId || '').trim()
      const label = name ? `${name}(${id})` : id
      return { label, value: id, name: name || id }
    })
  } catch (error) {
    console.error('加载车端设备失败:', error)
    onlyMessage($t('parallel-driving.control-panel.load-bound-vehicle-failed'), 'error')
  } finally {
    vehicleLoading.value = false
  }
}

const handleCockpitSearch = (value: string) => {
  loadCockpitDevices(value)
}

const handleVehicleSearch = (value: string) => {
  loadVehicleDevices(value)
}

const getDictValue = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.value || val.getValue?.() || ''
}

const normalizeState = (val: any) => getDictValue(val).toString().toLowerCase()

const isActiveState = (val: any) => normalizeState(val) === 'active'

const getSessionStateText = (state: any) => {
  let s = normalizeState(state)
  if (!s) return $t('parallel-driving.control-panel.session-not-bound')
  if (s.includes(',')) {
    s = s.split(',').map((x: string) => x.trim()).filter(Boolean).pop() || s
  }
  const stateMap: Record<string, string> = {
    binding: $t('parallel-driving.control-panel.session-binding'),
    active: $t('parallel-driving.control-panel.session-active'),
    releasing: $t('parallel-driving.control-panel.session-releasing'),
    released: $t('parallel-driving.control-panel.session-released'),
  }
  return stateMap[s] || s
}

const getSessionStateColor = (state: any) => {
  let s = normalizeState(state)
  if (s?.includes(',')) {
    s = s.split(',').map((x: string) => x.trim()).filter(Boolean).pop() || s
  }
  const colorMap: Record<string, string> = {
    binding: 'orange',
    active: 'green',
    releasing: 'orange',
    released: 'default',
  }
  return colorMap[s] || 'default'
}

// 驾驶舱设备变化时，自动加载绑定的车辆并检查会话
const handleCockpitChange = async (value: any) => {
  const deviceId = typeof value === 'string' ? value : String(value || '')
  if (!deviceId) {
    form.vehicleDeviceId = ''
    vehicleDevices.value = []
    hasPermission.value = false
    permissionStatus.value = ''
    isControlling.value = false
    sessionState.value = ''
    closeWebSocket()
    return
  }

  // 切换驾驶舱时，刷新“已绑定车辆列表”
  await loadVehicleDevices()

  vehicleLoading.value = true
  try {
    const result = await getBoundVehicle(deviceId)
    if (result?.result && result.result.vehicleDeviceId) {
      const boundVehicle = result.result
      const vehicleId = boundVehicle.vehicleDeviceId
      const vehicleName = boundVehicle.vehicleDeviceName || ''
      const sessionStateValue = boundVehicle.sessionState || ''
      
      const name = vehicleName.trim()
      const id = vehicleId.trim()
      const label = name ? `${name}(${id})` : id
      
      const existingIndex = vehicleDevices.value.findIndex(device => device.value === id)
      if (existingIndex === -1) {
        vehicleDevices.value.unshift({
          label,
          value: id,
          name: name || id,
        })
      }
      
      await nextTick()
      form.vehicleDeviceId = id
      isControlling.value = isActiveState(sessionStateValue)
      sessionState.value = sessionStateValue
      
      // 自动检查权限
      await autoCheckPermission()
      
      // 如果已接管，自动连接 WebSocket
      if (isControlling.value) {
        initWebSocket()
      }
    } else {
      form.vehicleDeviceId = ''
      isControlling.value = false
      sessionState.value = ''
      onlyMessage($t('parallel-driving.control-panel.no-bound-vehicle'), 'warning')
    }
  } catch (error: any) {
    console.error('获取绑定车辆失败:', error)
    form.vehicleDeviceId = ''
    isControlling.value = false
    sessionState.value = ''
    onlyMessage(error.message || $t('parallel-driving.control-panel.load-bound-vehicle-failed'), 'error')
  } finally {
    vehicleLoading.value = false
  }
}

// 自动检查权限
const autoCheckPermission = async () => {
  if (!form.cockpitDeviceId || !form.vehicleDeviceId) {
    hasPermission.value = false
    permissionStatus.value = ''
    return
  }

  try {
    const result = await checkPermission({
      cockpitDeviceId: form.cockpitDeviceId,
      vehicleDeviceId: form.vehicleDeviceId,
    })
    if (result.success) {
      hasPermission.value = typeof result?.result === 'boolean' ? result.result : !!result?.result?.hasPermission
      permissionStatus.value = hasPermission.value
        ? $t('parallel-driving.control-panel.permission-granted')
        : $t('parallel-driving.control-panel.permission-denied')
    }
  } catch (error: any) {
    console.error('自动检查权限失败:', error)
    hasPermission.value = false
    permissionStatus.value = ''
  }
}

// 手动检查权限
const handleCheckPermission = async () => {
  if (!form.cockpitDeviceId || !form.vehicleDeviceId) {
    onlyMessage($t('parallel-driving.control-panel.select-both-devices'), 'error')
    return
  }

  try {
    await autoCheckPermission()
    onlyMessage($t('parallel-driving.control-panel.check-permission-completed'), 'success')
  } catch (error: any) {
    onlyMessage($t('parallel-driving.control-panel.check-failed'), 'error')
  }
}

// 开始控制（远程接管）
const handleControl = async () => {
  if (!form.cockpitDeviceId || !form.vehicleDeviceId) {
    onlyMessage($t('parallel-driving.control-panel.select-both-devices'), 'error')
    return
  }
  if (!hasPermission.value) {
    onlyMessage($t('parallel-driving.control-panel.check-permission-first'), 'warning')
    return
  }
  if (isControlling.value) {
    onlyMessage($t('parallel-driving.control-panel.already-controlling'), 'warning')
    return
  }

  controlling.value = true
  try {
    const result = await takeover({
      cockpitDeviceId: form.cockpitDeviceId,
      vehicleDeviceId: form.vehicleDeviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.control-panel.control-started'), 'success')
      isControlling.value = true
      sessionState.value = 'active'
      // 刷新绑定车辆信息
      await handleCockpitChange(form.cockpitDeviceId)
      // 启动 WebSocket
      initWebSocket()
    } else {
      onlyMessage($t('parallel-driving.control-panel.control-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-panel.control-failed'), 'error')
  } finally {
    controlling.value = false
  }
}

// 停止控制（释放）
const handleStopControl = async () => {
  if (!form.cockpitDeviceId || !form.vehicleDeviceId) {
    onlyMessage($t('parallel-driving.control-panel.select-both-devices'), 'error')
    return
  }
  if (!isControlling.value) {
    onlyMessage($t('parallel-driving.control-panel.not-controlling'), 'warning')
    return
  }

  stopping.value = true
  try {
    const result = await release({
      cockpitDeviceId: form.cockpitDeviceId,
      vehicleDeviceId: form.vehicleDeviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.control-panel.control-stopped'), 'success')
      isControlling.value = false
      sessionState.value = 'released'
      // 关闭 WebSocket
      closeWebSocket()
      // 刷新绑定车辆信息
      await handleCockpitChange(form.cockpitDeviceId)
    } else {
      onlyMessage($t('parallel-driving.control-panel.stop-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-panel.stop-failed'), 'error')
  } finally {
    stopping.value = false
  }
}

// WebSocket 连接状态
const wsConnected = ref(false)

// 初始化 WebSocket 连接
const initWebSocket = () => {
  if (!form.cockpitDeviceId || !form.vehicleDeviceId || !isControlling.value) {
    closeWebSocket()
    wsConnected.value = false
    vehicleStatus.value = {}
    return
  }

  closeParallelDrivingWebSocket()

  wsConnected.value = false
  initParallelDrivingWebSocket(
    form.vehicleDeviceId,
    form.cockpitDeviceId,
    (data) => {
      if (data.type === 'vehicle-status' && data.properties) {
        vehicleStatus.value = {
          ...vehicleStatus.value,
          ...data.properties,
          timestamp: data.timestamp,
        }
      }
    },
    (error) => {
      console.error('WebSocket 错误:', error)
      wsConnected.value = false
    },
    () => {
      wsConnected.value = false
    },
    () => {
      wsConnected.value = true
    }
  )
}

const closeWebSocket = () => {
  closeParallelDrivingWebSocket()
  wsConnected.value = false
  vehicleStatus.value = {}
}

// 监听车辆选择变化，自动检查权限
watch(
  () => form.vehicleDeviceId,
  () => {
    if (form.cockpitDeviceId && form.vehicleDeviceId) {
      autoCheckPermission()
    } else {
      hasPermission.value = false
      permissionStatus.value = ''
    }
  }
)

onMounted(() => {
  loadCockpitDevices()
  // 恢复上次选择的驾驶舱
  try {
    const savedCockpitId = localStorage.getItem('parallelDriving.cockpitDeviceId')
    if (savedCockpitId) {
      form.cockpitDeviceId = savedCockpitId
      handleCockpitChange(savedCockpitId)
    }
  } catch (e) {
    // ignore
  }
})

onBeforeUnmount(() => {
  closeWebSocket()
})
</script>

<style scoped lang="less">
.control-panel-container {
  padding: 16px;
}
</style>
