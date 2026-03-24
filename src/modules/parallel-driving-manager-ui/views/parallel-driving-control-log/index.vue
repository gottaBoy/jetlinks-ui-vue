<template>
  <j-page-container>
    <j-advanced-search
      :columns="columns"
      target="parallel-driving-control-log"
      @search="handleSearch"
    />
    <FullPage>
      <j-pro-table
        ref="tableRef"
        :columns="columns"
        :request="queryLogs"
        :params="params"
        :defaultParams="{
          sorts: [{ name: 'timestamp', order: 'desc' }],
        }"
      >
        <template #headerLeftRender>
          <a-space>
            <a-button type="primary" @click="refresh">
              <template #icon>
                <AIcon type="ReloadOutlined" />
              </template>
              {{ $t('parallel-driving.control-log.refresh') }}
            </a-button>
          </a-space>
        </template>
      </j-pro-table>
    </FullPage>
  </j-page-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getControlLogs } from '../../api/parallel-driving'

const { t: $t } = useI18n()
const tableRef = ref()
const params = ref<Record<string, any>>({})

const columns = [
  {
    title: $t('parallel-driving.control-log.cockpit-id'),
    dataIndex: 'cockpitDeviceId',
    key: 'cockpitDeviceId',
    width: 200,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('parallel-driving.control-log.vehicle-id'),
    dataIndex: 'vehicleDeviceId',
    key: 'vehicleDeviceId',
    width: 200,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('parallel-driving.control-log.control-type'),
    dataIndex: 'controlType',
    key: 'controlType',
    width: 160,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('parallel-driving.control-log.success'),
    dataIndex: 'success',
    key: 'success',
    width: 100,
    scopedSlots: true,
  },
  {
    title: $t('parallel-driving.control-log.message'),
    dataIndex: 'message',
    key: 'message',
    width: 260,
  },
  {
    title: $t('parallel-driving.control-log.timestamp'),
    dataIndex: 'timestamp',
    key: 'timestamp',
    width: 200,
    scopedSlots: true,
  },
]

const queryLogs = async (queryParam: any) => {
  const params: any = {}
  if (queryParam?.terms) {
    queryParam.terms.forEach((term: any) => {
      if (term.termType === 'eq') {
        params[term.column] = term.value
      }
    })
  }
  const result = await getControlLogs(params)
  // getControlLogs 返回非分页列表，这里适配 j-pro-table 的分页结构
  if (result && Array.isArray(result.result)) {
    return {
      success: true,
      result: {
        data: result.result,
        pageIndex: 0,
        pageSize: result.result.length,
        total: result.result.length,
      },
    }
  }
  return result
}

const handleSearch = (p: Record<string, any>) => {
  params.value = p
  refresh()
}

const refresh = () => {
  tableRef.value?.reload()
}
</script>

<style scoped lang="less">
</style>

