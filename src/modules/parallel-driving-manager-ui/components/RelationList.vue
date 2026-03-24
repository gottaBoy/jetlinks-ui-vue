<template>
  <a-card :title="$t('parallel-driving.relation-list.title')" :bordered="false" style="margin-top: 16px">
    <j-pro-table
      ref="tableRef"
      :request="requestFun"
      :columns="columns"
      :params="queryParams"
      :rowSelection="{
        selectedRowKeys: selectedRowKeys,
        onSelect: onSelect,
        onSelectAll: onSelectAll,
      }"
    >
    <!-- :hasPermission="`parallel-driving-bind:add`" -->
      <template #headerLeftRender>
        <a-space>
          <j-permission-button
            type="primary"
            @click="handleAddRelation"
            
          >
            <template #icon>
              <AIcon type="PlusOutlined" />
            </template>
            {{ $t('parallel-driving.relation-list.add-relation') }}
          </j-permission-button>
          <j-permission-button
            type="primary"
            danger
            :disabled="selectedRowKeys.length === 0"
            :popConfirm="{
              title: $t('parallel-driving.relation-list.unbind-confirm'),
              onConfirm: handleBatchUnbind,
            }"
            
          >
          <!-- :hasPermission="`parallel-driving-bind:delete`" -->
            <template #icon>
              <AIcon type="DisconnectOutlined" />
            </template>
            {{ $t('parallel-driving.relation-list.batch-unbind') }}
          </j-permission-button>
        </a-space>
      </template>
      <!-- :hasPermission="`parallel-driving-bind:delete`" -->
      <template #action="slotProps">
        <a-space>
          <j-permission-button
            type="link"
            danger
            :popConfirm="{
              title: $t('parallel-driving.relation-list.unbind-confirm'),
              onConfirm: () => handleUnbind(slotProps),
            }"
          >
            <template #icon>
              <AIcon type="DisconnectOutlined" />
            </template>
            {{ $t('parallel-driving.relation-list.unbind') }}
          </j-permission-button>
        </a-space>
      </template>

      <template #card="slotProps">
        <CardBox
          :value="slotProps"
          :active="selectedRowKeys.includes(slotProps.id)"
          :status="slotProps.status"
          :statusText="slotProps.status"
          :statusNames="{
            '正常': 'processing',
            '异常': 'error',
          }"
          :showStatus="true"
          :showTool="false"
        >
          <template #content>
            <div style="padding: 16px">
              <j-ellipsis style="margin-bottom: 12px">
                <h3 style="font-weight: 600; font-size: 16px; margin: 0">
                  {{ $t('parallel-driving.relation-list.cockpit-device') }}: {{ slotProps.cockpitDeviceName || slotProps.cockpitDeviceId }}
                </h3>
              </j-ellipsis>
              <a-row :gutter="16">
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t('parallel-driving.relation-list.cockpit-device-id') }}
                  </div>
                  <j-ellipsis style="width: calc(100% - 20px)">
                    <div>{{ slotProps.cockpitDeviceId }}</div>
                  </j-ellipsis>
                </a-col>
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t('parallel-driving.relation-list.vehicle-device') }}
                  </div>
                  <j-ellipsis style="width: calc(100% - 20px)">
                    <div>{{ slotProps.vehicleDeviceName || slotProps.vehicleDeviceId }}</div>
                  </j-ellipsis>
                </a-col>
              </a-row>
              <a-row :gutter="16" style="margin-top: 12px">
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t('parallel-driving.relation-list.vehicle-device-id') }}
                  </div>
                  <j-ellipsis style="width: calc(100% - 20px)">
                    <div>{{ slotProps.vehicleDeviceId }}</div>
                  </j-ellipsis>
                </a-col>
                <a-col :span="12">
                  <div class="card-item-content-text">
                    {{ $t('parallel-driving.relation-list.bind-time') }}
                  </div>
                  <j-ellipsis style="width: calc(100% - 20px)">
                    <div>{{ slotProps.bindTime }}</div>
                  </j-ellipsis>
                </a-col>
              </a-row>
              <a-row style="margin-top: 12px">
                <a-col :span="24">
                  <div class="card-item-content-text">
                    {{ $t('parallel-driving.relation-list.action') }}
                  </div>
                  <a-space>
                    <j-permission-button
                      type="link"
                      danger
                      :popConfirm="{
                        title: $t('parallel-driving.relation-list.unbind-confirm'),
                        onConfirm: () => handleUnbind(slotProps),
                      }"
                    >
                      <template #icon>
                        <AIcon type="DisconnectOutlined" />
                      </template>
                      {{ $t('parallel-driving.relation-list.unbind') }}
                    </j-permission-button>
                  </a-space>
                </a-col>
              </a-row>
            </div>
          </template>
        </CardBox>
      </template>
    </j-pro-table>
  </a-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import { queryBindList, unbind } from '../api/parallel-driving'

const emit = defineEmits(['add-relation'])

const { t: $t } = useI18n()
const tableRef = ref()
const selectedRowKeys = ref<string[]>([])
const queryParams = reactive({})

// 处理新增关系按钮点击
const handleAddRelation = () => {
  emit('add-relation')
}

// 表格列配置
const columns = [
  {
    title: $t('parallel-driving.relation-list.cockpit-device'),
    dataIndex: 'cockpitDeviceName',
    key: 'cockpitDeviceName',
    width: 200,
  },
  {
    title: $t('parallel-driving.relation-list.cockpit-device-id'),
    dataIndex: 'cockpitDeviceId',
    key: 'cockpitDeviceId',
    width: 200,
  },
  {
    title: $t('parallel-driving.relation-list.vehicle-device'),
    dataIndex: 'vehicleDeviceName',
    key: 'vehicleDeviceName',
    width: 200,
  },
  {
    title: $t('parallel-driving.relation-list.vehicle-device-id'),
    dataIndex: 'vehicleDeviceId',
    key: 'vehicleDeviceId',
    width: 200,
  },
  {
    title: $t('parallel-driving.relation-list.bind-time'),
    dataIndex: 'bindTime',
    key: 'bindTime',
    width: 180,
  },
  {
    title: $t('parallel-driving.relation-list.status'),
    dataIndex: 'status',
    key: 'status',
    width: 100,
  },
  {
    title: $t('parallel-driving.relation-list.action'),
    key: 'action',
    width: 150,
    fixed: 'right',
    scopedSlots: true,
  },
]

// 请求函数
const requestFun = async (params: any) => {
  const result = await queryBindList(params)
  if (result.success && result.result?.data) {
    // 返回结构：ParallelDrivingBinding（绑定关系/授权关系）
    // 字段：cockpitDeviceId/vehicleDeviceId/bindTime...
    result.result.data = result.result.data.map((item: any) => {
      return {
        id: item.id,
        cockpitDeviceId: item.cockpitDeviceId,
        cockpitDeviceName: item.cockpitDeviceName || '',
        vehicleDeviceId: item.vehicleDeviceId,
        vehicleDeviceName: item.vehicleDeviceName || '',
        bindTime: item.bindTime ? new Date(item.bindTime).toLocaleString('zh-CN') : '',
        status: '已绑定', // 绑定关系状态固定为"已绑定"
      }
    })
  }
  return result
}

// 选择行
const onSelect = (row: any, checked: boolean) => {
  if (checked) {
    selectedRowKeys.value.push(row.id)
  } else {
    const index = selectedRowKeys.value.indexOf(row.id)
    if (index > -1) {
      selectedRowKeys.value.splice(index, 1)
    }
  }
}

// 全选
const onSelectAll = (checked: boolean, rows: any[]) => {
  if (checked) {
    selectedRowKeys.value = rows.map((row) => row.id)
  } else {
    selectedRowKeys.value = []
  }
}

// 解绑
const handleUnbind = async (row: any) => {
  try {
    const result = await unbind({
      cockpitDeviceId: row.cockpitDeviceId,
      vehicleDeviceId: row.vehicleDeviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.relation-list.unbind-success'))
      refresh()
    } else {
      onlyMessage($t('parallel-driving.relation-list.unbind-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage($t('parallel-driving.relation-list.unbind-failed'), 'error')
  }
}

// 批量解绑
const handleBatchUnbind = async () => {
  if (selectedRowKeys.value.length === 0) {
    return
  }

  try {
    // 获取选中的行数据
    const selectedRows = tableRef.value?.getSelectedRows() || []
    const promises = selectedRows.map((row: any) =>
      unbind({
        cockpitDeviceId: row.cockpitDeviceId,
        vehicleDeviceId: row.vehicleDeviceId,
      })
    )
    const results = await Promise.all(promises)
    const hasError = results.some((r) => !r.success)
    if (hasError) {
      onlyMessage($t('parallel-driving.relation-list.batch-unbind-failed'), 'error')
    } else {
      onlyMessage($t('parallel-driving.relation-list.batch-unbind-success'))
      selectedRowKeys.value = []
      refresh()
    }
  } catch (error: any) {
    onlyMessage($t('parallel-driving.relation-list.batch-unbind-failed'), 'error')
  }
}

// 刷新表格
const refresh = () => {
  tableRef.value?.reload()
}

// 暴露刷新方法
defineExpose({
  refresh,
})
</script>

<style scoped lang="less">
.card-item-content-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.75);
  margin-bottom: 4px;
  opacity: 0.75;
}
</style>

