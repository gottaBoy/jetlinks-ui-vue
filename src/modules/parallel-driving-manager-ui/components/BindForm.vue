<template>
  <a-form ref="formRef" :model="form" layout="vertical" @finish="handleSubmit">
    <a-form-item
      :label="$t('parallel-driving.bind-form.cockpit-device')"
      name="cockpitDeviceId"
      :rules="[{ required: true, message: $t('parallel-driving.bind-form.cockpit-device-required') }]"
    >
      <a-select
        v-model:value="form.cockpitDeviceId"
        :placeholder="$t('parallel-driving.bind-form.select-cockpit')"
        :loading="cockpitLoading"
        :filter-option="false"
        show-search
        allow-clear
        option-label-prop="label"
        @search="handleCockpitSearch"
      >
        <a-select-option
          v-for="device in cockpitDevices"
          :key="device.value"
          :value="device.value"
          :label="device.label"
        >
          {{ device.label }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item
      :label="$t('parallel-driving.bind-form.vehicle-device')"
      name="vehicleDeviceId"
      :rules="[{ required: true, message: $t('parallel-driving.bind-form.vehicle-device-required') }]"
    >
      <a-select
        v-model:value="form.vehicleDeviceId"
        :placeholder="$t('parallel-driving.bind-form.select-vehicle')"
        :loading="vehicleLoading"
        :filter-option="false"
        show-search
        allow-clear
        option-label-prop="label"
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
  </a-form>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import { bind, getCockpitDevices, getVehicleDevices } from '../api/parallel-driving'

const { t: $t } = useI18n()
const emit = defineEmits(['success'])

const formRef = ref()
const loading = ref(false)
const cockpitLoading = ref(false)
const vehicleLoading = ref(false)

const form = reactive({
  cockpitDeviceId: '',
  vehicleDeviceId: '',
})

const cockpitDevices = ref<Array<{ label: string; value: string; name?: string }>>([])
const vehicleDevices = ref<Array<{ label: string; value: string; name?: string }>>([])

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
    
    // 处理返回的数据结构
    const data = result?.result || []
    cockpitDevices.value = data.map((item: any) => {
      const name = (item.name || '').trim()
      const id = (item.id || '').trim()
      // 显示格式：name(id)，例如：粤QWL001(L584C4VC2SD001335)
      // 如果名称为空，则只显示ID
      const label = name ? `${name}(${id})` : id
      return {
        label,
        value: id,
        name: name || id, // 保存原始名称用于搜索，如果名称为空则使用ID
      }
    })
    
    console.log('驾驶舱设备列表:', cockpitDevices.value)
    console.log('原始数据示例:', data[0])
  } catch (error: any) {
    console.error('加载驾驶舱设备失败:', error)
    onlyMessage($t('parallel-driving.bind-form.load-cockpit-devices-failed'), 'error')
    cockpitDevices.value = []
  } finally {
    cockpitLoading.value = false
  }
}

// 加载车端设备列表
const loadVehicleDevices = async (keyword?: string) => {
  vehicleLoading.value = true
  try {
    const result = await getVehicleDevices({
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
    
    // 处理返回的数据结构
    const data = result?.result || []
    vehicleDevices.value = data.map((item: any) => {
      const name = (item.name || '').trim()
      const id = (item.id || '').trim()
      // 显示格式：name(id)，例如：粤QWL001(L584C4VC2SD001335)
      // 如果名称为空，则只显示ID
      const label = name ? `${name}(${id})` : id
      return {
        label,
        value: id,
        name: name || id, // 保存原始名称用于搜索，如果名称为空则使用ID
      }
    })
    
    console.log('车端设备列表:', vehicleDevices.value)
    console.log('原始数据示例:', data[0])
  } catch (error: any) {
    console.error('加载车端设备失败:', error)
    onlyMessage($t('parallel-driving.bind-form.load-vehicle-devices-failed'), 'error')
    vehicleDevices.value = []
  } finally {
    vehicleLoading.value = false
  }
}

// 搜索驾驶舱设备
const handleCockpitSearch = (value: string) => {
  loadCockpitDevices(value)
}

// 搜索车端设备
const handleVehicleSearch = (value: string) => {
  loadVehicleDevices(value)
}

// 提交绑定
const handleSubmit = async (values: any) => {
  loading.value = true
  try {
    const result = await bind({
      cockpitDeviceId: values?.cockpitDeviceId || form.cockpitDeviceId,
      vehicleDeviceId: values?.vehicleDeviceId || form.vehicleDeviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.bind-form.bind-success'))
      emit('success')
      reset()
    } else {
      onlyMessage($t('parallel-driving.bind-form.bind-failed'), 'error')
      throw new Error('绑定失败')
    }
  } catch (error: any) {
    onlyMessage($t('parallel-driving.bind-form.bind-failed'), 'error')
    throw error
  } finally {
    loading.value = false
  }
}

// 重置表单
const reset = () => {
  form.cockpitDeviceId = ''
  form.vehicleDeviceId = ''
  formRef.value?.resetFields()
}

// 提交表单（供外部调用）
const submit = async () => {
  return new Promise<void>((resolve, reject) => {
    formRef.value?.validate().then(async () => {
      try {
        await handleSubmit(form)
        resolve()
      } catch (error) {
        reject(error)
      }
    }).catch((error: any) => {
      reject(error)
    })
  })
}

// 暴露方法供外部调用
defineExpose({
  reset,
  submit,
})

onMounted(() => {
  loadCockpitDevices()
  loadVehicleDevices()
})
</script>

<style scoped lang="less">
</style>

