<template>
  <a-card :title="$t('parallel-driving.control-pad.title')" :bordered="false">
    <a-space direction="vertical" style="width: 100%" size="large">
      <!-- 方向控制 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <span>{{ $t('parallel-driving.control-pad.steering') }}</span>
          <a-space>
            <span>{{ steeringValue > 0 ? '+' : '' }}{{ steeringValue }}°</span>
            <a-button size="small" @click="resetSteering">{{ $t('parallel-driving.control-pad.reset') }}</a-button>
          </a-space>
        </div>
        <a-slider
          v-model:value="steeringValue"
          :min="-100"
          :max="100"
          :step="1"
          :disabled="disabled"
          :tooltip-formatter="(val: number) => `${val > 0 ? '+' : ''}${val}°`"
          @change="handleSteeringChange"
        />
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-top: 4px">
          <span>{{ $t('parallel-driving.control-pad.left') }}</span>
          <span>{{ $t('parallel-driving.control-pad.right') }}</span>
        </div>
      </div>

      <!-- 油门控制 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <span>{{ $t('parallel-driving.control-pad.accelerator') }}</span>
          <span>{{ Math.round(acceleratorValue * 100) }}%</span>
        </div>
        <a-slider
          v-model:value="acceleratorValue"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="disabled"
          :tooltip-formatter="(val: number) => `${Math.round(val * 100)}%`"
          @change="handleAcceleratorChange"
        />
      </div>

      <!-- 刹车控制 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <span>{{ $t('parallel-driving.control-pad.brake') }}</span>
          <span>{{ Math.round(brakeValue * 100) }}%</span>
        </div>
        <a-slider
          v-model:value="brakeValue"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="disabled"
          :tooltip-formatter="(val: number) => `${Math.round(val * 100)}%`"
          @change="handleBrakeChange"
        />
      </div>

      <!-- 档位控制 -->
      <div>
        <div style="margin-bottom: 8px">{{ $t('parallel-driving.control-pad.gear') }}</div>
        <a-radio-group
          v-model:value="gearValue"
          :disabled="disabled"
          @change="handleGearChange"
        >
          <a-radio-button :value="0">P</a-radio-button>
          <a-radio-button :value="1">R</a-radio-button>
          <a-radio-button :value="2">N</a-radio-button>
          <a-radio-button :value="3">D</a-radio-button>
        </a-radio-group>
      </div>

      <!-- 急停按钮 -->
      <div>
        <a-button
          type="primary"
          danger
          size="large"
          block
          :disabled="disabled"
          :loading="emergencyStopping"
          @click="handleEmergencyStop"
        >
          <template #icon>
            <AIcon type="WarningOutlined" />
          </template>
          {{ $t('parallel-driving.control-pad.emergency-stop') }}
        </a-button>
      </div>
    </a-space>
  </a-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import { steering, accelerator, brake, gear, emergencyStop } from '../api/parallel-driving'
import { useThrottleFn } from '@vueuse/core'

const props = defineProps<{
  cockpitDeviceId: string
  vehicleDeviceId: string
  disabled: boolean
}>()

const { t: $t } = useI18n()

const steeringValue = ref(0)
const acceleratorValue = ref(0)
const brakeValue = ref(0)
const gearValue = ref(2) // 默认 N 档
const emergencyStopping = ref(false)

// 限频发送：200ms
const throttledSteering = useThrottleFn(async (angle: number) => {
  if (!props.cockpitDeviceId || !props.vehicleDeviceId) return
  try {
    await steering({
      cockpitDeviceId: props.cockpitDeviceId,
      vehicleDeviceId: props.vehicleDeviceId,
      angle,
    })
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.steering-failed'), 'error')
  }
}, 200)

const throttledAccelerator = useThrottleFn(async (value: number) => {
  if (!props.cockpitDeviceId || !props.vehicleDeviceId) return
  try {
    await accelerator({
      cockpitDeviceId: props.cockpitDeviceId,
      vehicleDeviceId: props.vehicleDeviceId,
      value,
    })
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.accelerator-failed'), 'error')
  }
}, 200)

const throttledBrake = useThrottleFn(async (value: number) => {
  if (!props.cockpitDeviceId || !props.vehicleDeviceId) return
  try {
    await brake({
      cockpitDeviceId: props.cockpitDeviceId,
      vehicleDeviceId: props.vehicleDeviceId,
      value,
    })
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.brake-failed'), 'error')
  }
}, 200)

const handleSteeringChange = (value: number | [number, number]) => {
  const val = Array.isArray(value) ? value[0] : value
  throttledSteering(val)
}

const handleAcceleratorChange = (value: number | [number, number]) => {
  const val = Array.isArray(value) ? value[0] : value
  throttledAccelerator(val)
}

const handleBrakeChange = (value: number | [number, number]) => {
  const val = Array.isArray(value) ? value[0] : value
  throttledBrake(val)
}

const handleGearChange = async () => {
  if (!props.cockpitDeviceId || !props.vehicleDeviceId) return
  try {
    await gear({
      cockpitDeviceId: props.cockpitDeviceId,
      vehicleDeviceId: props.vehicleDeviceId,
      gear: gearValue.value,
    })
    onlyMessage($t('parallel-driving.control-pad.gear-success'), 'success')
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.gear-failed'), 'error')
  }
}

const resetSteering = () => {
  steeringValue.value = 0
  handleSteeringChange(0)
}

const handleEmergencyStop = async () => {
  if (!props.cockpitDeviceId || !props.vehicleDeviceId) return
  
  // 二次确认
  const confirmed = confirm($t('parallel-driving.control-pad.emergency-stop-confirm'))
  if (!confirmed) return

  emergencyStopping.value = true
  try {
    await emergencyStop({
      cockpitDeviceId: props.cockpitDeviceId,
      vehicleDeviceId: props.vehicleDeviceId,
    })
    onlyMessage($t('parallel-driving.control-pad.emergency-stop-success'), 'success')
    // 急停后重置所有控制值
    resetSteering()
    acceleratorValue.value = 0
    brakeValue.value = 0
    gearValue.value = 2
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.emergency-stop-failed'), 'error')
  } finally {
    emergencyStopping.value = false
  }
}

// 当设备变化时重置控制值
watch(
  () => [props.cockpitDeviceId, props.vehicleDeviceId],
  () => {
    resetSteering()
    acceleratorValue.value = 0
    brakeValue.value = 0
    gearValue.value = 2
  }
)
</script>

<style scoped lang="less">
</style>
