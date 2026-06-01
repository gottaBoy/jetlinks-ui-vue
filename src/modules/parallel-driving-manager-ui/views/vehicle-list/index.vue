<template>
  <j-page-container>
    <j-advanced-search
      :columns="columns"
      target="vehicle-list"
      @search="handleSearch"
    />
    <FullPage>
      <j-pro-table
        ref="tableRef"
        :columns="columns"
        :request="queryVehicles"
        :params="params"
        :defaultParams="{
          sorts: [{ name: 'createTime', order: 'desc' }],
        }"
        :mode="viewMode"
      >
        <template #headerLeftRender>
          <a-space>
            <a-select
              v-model:value="selectedCockpitId"
              :placeholder="$t('parallel-driving.vehicle-list.select-cockpit')"
              :loading="cockpitLoading"
              :filter-option="false"
              show-search
              allow-clear
              style="width: 250px"
              option-label-prop="label"
              @search="handleCockpitSearch"
              @change="handleCockpitChange"
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
            <a-button type="primary" @click="refresh">
              <template #icon>
                <AIcon type="ReloadOutlined" />
              </template>
              {{ $t('parallel-driving.vehicle-list.refresh') }}
            </a-button>
          </a-space>
        </template>
        <template #headerRightRender>
          <a-radio-group
            v-model:value="viewMode"
            button-style="solid"
            @change="handleViewModeChange"
          >
            <a-radio-button value="TABLE">
              {{ $t('parallel-driving.vehicle-list.view-list') }}
            </a-radio-button>
            <a-radio-button value="CARD">
              {{ $t('parallel-driving.vehicle-list.view-card') }}
            </a-radio-button>
          </a-radio-group>
        </template>
        <template #deviceName="slotProps">
          <a class="link-name" @click="goToDetail(slotProps)">
            {{ slotProps.deviceName || slotProps.deviceId }}
          </a>
        </template>
        <template #card="slotProps">
          <CardBox
            :value="slotProps"
            :status="slotProps.state?.value"
            :statusText="slotProps.state?.text"
            :statusNames="{
              online: 'processing',
              offline: 'error',
              notActive: 'warning',
            }"
            :showStatus="true"
          >
            <template #content>
              <div style="padding: 16px">
                <j-ellipsis style="margin-bottom: 12px">
                  <h3
                    class="card-title-link"
                    style="font-weight: 600; font-size: 16px; margin: 0; cursor: pointer"
                    @click="goToDetail(slotProps)"
                  >
                    {{ slotProps.deviceName || slotProps.deviceId }}
                  </h3>
                </j-ellipsis>
                <a-row :gutter="16">
                  <a-col :span="12">
                    <div class="card-item-content-text">
                      {{ $t('parallel-driving.vehicle-list.device-id') }}
                    </div>
                    <j-ellipsis style="width: calc(100% - 20px)">
                      <div>{{ slotProps.deviceId }}</div>
                    </j-ellipsis>
                  </a-col>
                  <a-col :span="12">
                    <div class="card-item-content-text">
                      {{ $t('parallel-driving.vehicle-list.online-status') }}
                    </div>
                    <j-badge-status
                      :status="slotProps.state?.value"
                      :text="slotProps.state?.text"
                      :statusNames="{
                        online: 'processing',
                        offline: 'error',
                        notActive: 'warning',
                      }"
                    />
                  </a-col>
                </a-row>
                <a-row :gutter="16" style="margin-top: 12px">
                  <a-col :span="12">
                    <div class="card-item-content-text">
                      {{ $t('parallel-driving.vehicle-list.internal-code') }}
                    </div>
                    <j-ellipsis style="width: calc(100% - 20px)">
                      <div>{{ slotProps.internalCode || '—' }}</div>
                    </j-ellipsis>
                  </a-col>
                  <a-col :span="12">
                    <div class="card-item-content-text">
                      {{ $t('parallel-driving.vehicle-list.session-state') }}
                    </div>
                    <j-ellipsis style="width: calc(100% - 20px)">
                      <div>
                        <a-tag
                          :color="getSessionStateColor(slotProps.sessionState)"
                        >
                          {{ getSessionStateText(slotProps.sessionState) }}
                        </a-tag>
                      </div>
                    </j-ellipsis>
                  </a-col>
                </a-row>
                <a-row :gutter="16" style="margin-top: 12px" v-if="slotProps.boundCockpitId">
                  <a-col :span="24">
                    <div class="card-item-content-text">
                      {{ $t('parallel-driving.vehicle-list.bound-cockpit') }}
                    </div>
                    <j-ellipsis style="width: calc(100% - 20px)">
                      <div>{{ slotProps.boundCockpitId }}</div>
                    </j-ellipsis>
                  </a-col>
                </a-row>
                <!-- <a-row style="margin-top: 12px">
                  <a-col :span="24">
                    <a-space>
                      <a-button
                        type="primary"
                        :loading="slotProps.takingOver"
                        :disabled="
                          !selectedCockpitId ||
                          slotProps.state?.value !== 'online' ||
                          (isActiveState(slotProps.sessionState) && slotProps.boundCockpitId !== selectedCockpitId)
                        "
                        @click="handleTakeover(slotProps)"
                      >
                        <template #icon>
                          <AIcon type="PlayCircleOutlined" />
                        </template>
                        {{ $t('parallel-driving.vehicle-list.takeover') }}
                      </a-button>
                      <a-button
                        danger
                        :loading="slotProps.releasing"
                        :disabled="!isActiveState(slotProps.sessionState) || slotProps.boundCockpitId !== selectedCockpitId"
                        @click="handleRelease(slotProps)"
                      >
                        <template #icon>
                          <AIcon type="StopOutlined" />
                        </template>
                        {{ $t('parallel-driving.vehicle-list.release') }}
                      </a-button>
                    </a-space>
                  </a-col>
                </a-row> -->
              </div>
            </template>
          </CardBox>
        </template>
        <template #state="slotProps">
          <j-badge-status
            :status="slotProps.state?.value"
            :text="slotProps.state?.text"
            :statusNames="{
              online: 'processing',
              offline: 'error',
              notActive: 'warning',
            }"
          />
        </template>
        <template #sessionState="slotProps">
          <a-tag :color="getSessionStateColor(slotProps.sessionState)">
            {{ getSessionStateText(slotProps.sessionState) }}
          </a-tag>
        </template>
        <template #action="slotProps">
          <a-space>
            <a-button type="link" class="pd-action-link" @click="goToDetail(slotProps)">
              <template #icon>
                <AIcon type="EyeOutlined" />
              </template>
              {{ $t('parallel-driving.vehicle-list.view-detail') }}
            </a-button>
            <a-button type="link" class="pd-action-link" @click="goToRemoteFocus(slotProps)">
              <template #icon>
                <AIcon type="ControlOutlined" />
              </template>
              {{ $t('parallel-driving.vehicle-list.remote-focus') }}
            </a-button>
            <a-button type="link" class="pd-action-link" @click="goToUltrawide(slotProps)" title="32:9 曲面屏三栏沉浸式工作台">
              <template #icon>
                <AIcon type="DesktopOutlined" />
              </template>
              曲面屏
            </a-button>
            <a-button type="link" class="pd-action-link" @click="goToJobConfig(slotProps)">
              <template #icon>
                <AIcon type="SettingOutlined" />
              </template>
              任务运营
            </a-button>
            <!-- <a-button
              type="link"
              :loading="slotProps.takingOver"
              :disabled="
                !selectedCockpitId ||
                slotProps.state?.value !== 'online' ||
                (isActiveState(slotProps.sessionState) && slotProps.boundCockpitId !== selectedCockpitId)
              "
              @click="handleTakeover(slotProps)"
            >
              <template #icon>
                <AIcon type="PlayCircleOutlined" />
              </template>
              {{ $t('parallel-driving.vehicle-list.takeover') }}
            </a-button>
            <a-button
              type="link"
              danger
              :loading="slotProps.releasing"
              :disabled="!isActiveState(slotProps.sessionState) || slotProps.boundCockpitId !== selectedCockpitId"
              @click="handleRelease(slotProps)"
            >
              <template #icon>
                <AIcon type="StopOutlined" />
              </template>
              {{ $t('parallel-driving.vehicle-list.release') }}
            </a-button> -->
          </a-space>
        </template>
      </j-pro-table>
    </FullPage>
  </j-page-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { cloneDeep } from 'lodash-es'
import { onlyMessage } from '@/utils/comm'
import {
  getCockpitDevices,
  queryVehicles as queryVehiclesApi,
  release,
  takeover,
} from '../../api/parallel-driving'

const { t: $t } = useI18n()
const router = useRouter()
const tableRef = ref()
const params = ref<Record<string, any>>({})
const selectedCockpitId = ref<string>('')
const cockpitLoading = ref(false)
const cockpitDevices = ref<Array<{ label: string; value: string; name?: string }>>([])

// 列表/卡片视图切换（默认列表）
const VIEW_MODE_STORAGE_KEY = 'parallelDriving.vehicleListViewMode'
const viewMode = ref<'TABLE' | 'CARD'>('TABLE')

const handleViewModeChange = () => {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode.value)
  } catch (e) {
    // ignore
  }
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
    const mapped = data.map((item: any) => {
      const name = (item.name || '').trim()
      const id = (item.id || '').trim()
      const label = name ? `${name}(${id})` : id
      return { label, value: id, name: name || id }
    })
    // 搜索会替换 options，若当前选中项不在新结果中，a-select 会清空 v-model，导致列表筛选失效
    const id = (selectedCockpitId.value || '').trim()
    if (id && !mapped.some((d: { value: string }) => d.value === id)) {
      cockpitDevices.value = [{ label: id, value: id, name: id }, ...mapped]
    } else {
      cockpitDevices.value = mapped
    }
  } catch (e) {
    console.error('加载驾驶舱设备失败:', e)
  } finally {
    cockpitLoading.value = false
  }
}

const handleCockpitSearch = (value: string) => {
  loadCockpitDevices(value)
}

const handleCockpitChange = (value: any) => {
  const id = typeof value === 'string' ? value : String(value || '')
  selectedCockpitId.value = id
  try {
    if (id) localStorage.setItem('parallelDriving.cockpitDeviceId', id)
    else localStorage.removeItem('parallelDriving.cockpitDeviceId')
  } catch (e) {
    // ignore
  }
  refresh()
}

// 跳转详情
const goToDetail = (record: any) => {
  // j-pro-table 的 slotProps 可能是 record 本身，也可能是 { record, text, index } 结构
  const raw = record?.record || record
  const id = raw?.deviceId || raw?.id
  if (!id) return
  // 这里不要用 name+params：该模块路由由菜单动态生成，name 可能不稳定，导致 params 不生效
  router.push({ path: `/parallel-driving/vehicles/detail/${id}` })
}

/** 远控工作台：新标签打开；顶栏关闭会 window.close()（同 goToJobConfig） */
const goToRemoteFocus = (record: any) => {
  const raw = record?.record || record
  const id = raw?.deviceId || raw?.id
  if (!id) return
  const url = router.resolve({
    path: `/parallel-driving/vehicles/remote-focus/${id}`,
    query: { layout: 'false' },
  })
  window.open(url.href, '_blank')
}

/** 曲面屏沉浸台：新标签打开，三栏全屏，专为 32:9 曲面屏设计 */
const goToUltrawide = (record: any) => {
  const raw = record?.record || record
  const id = raw?.deviceId || raw?.id
  if (!id) return
  const url = router.resolve({
    path: `/parallel-driving/vehicles/ultrawide/${id}`,
    query: { layout: 'false' },
  })
  window.open(url.href, '_blank')
}

// 跳转作业配置（新窗口打开）
const goToJobConfig = (record: any) => {
  const raw = record?.record || record
  const id = raw?.deviceId || raw?.id
  if (!id) return
  const url = router.resolve({ path: '/parallel-driving/vehicles/job-config', query: { vehicleId: id, layout: 'false' } })
  window.open(url.href, '_blank')
}

// 表格列配置
const columns = [
  {
    title: $t('parallel-driving.vehicle-list.device-name'),
    dataIndex: 'deviceName',
    key: 'deviceName',
    width: 200,
    search: {
      type: 'string',
    },
    scopedSlots: true,
  },
  {
    title: $t('parallel-driving.vehicle-list.device-id'),
    dataIndex: 'deviceId',
    key: 'deviceId',
    width: 200,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('parallel-driving.vehicle-list.internal-code'),
    dataIndex: 'internalCode',
    key: 'internalCode',
    width: 160,
    ellipsis: true,
    search: {
      type: 'string',
    },
  },
  {
    title: $t('parallel-driving.vehicle-list.online-status'),
    dataIndex: 'state',
    key: 'state',
    width: 120,
    scopedSlots: true,
  },
  {
    title: $t('parallel-driving.vehicle-list.session-state'),
    dataIndex: 'sessionState',
    key: 'sessionState',
    width: 120,
    scopedSlots: true,
  },
  {
    title: $t('parallel-driving.vehicle-list.bound-cockpit'),
    dataIndex: 'boundCockpitId',
    key: 'boundCockpitId',
    width: 200,
  },
  {
    title: $t('parallel-driving.vehicle-list.action'),
    key: 'action',
    width: 340,
    fixed: 'right',
    scopedSlots: true,
  },
]

// 查询车辆列表（后端按 cockpitId 过滤「绑定到该驾驶舱」的车辆；见 ParallelDrivingVehicleService）
const queryVehicles = async (queryParams: any) => {
  const qp = cloneDeep(queryParams)
  const terms = Array.isArray(qp.terms) ? qp.terms : []
  qp.terms = terms.filter((t: any) => t?.column !== 'cockpitId')
  if (selectedCockpitId.value) {
    qp.terms.push({
      column: 'cockpitId',
      termType: 'eq',
      value: selectedCockpitId.value,
    })
  }
  const result = await queryVehiclesApi(qp)
  if (result.success && result.result?.data) {
    // 为每条记录添加 loading 状态
    result.result.data = result.result.data.map((item: any) => ({
      ...item,
      takingOver: false,
      releasing: false,
    }))
  }
  return result
}

// 获取会话状态文本
const getDictValue = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.value || val.getValue?.() || ''
}

const normalizeState = (val: any) => getDictValue(val).toString().toLowerCase()

const isActiveState = (val: any) => normalizeState(val) === 'active'

// 获取会话状态文本（仅显示单一状态，避免「控车中，已退出」等矛盾）
const getSessionStateText = (state: any) => {
  let s = normalizeState(state)
  if (!s) return $t('parallel-driving.vehicle-list.not-bound')
  if (s.includes(',')) {
    s = s.split(',').map((x: string) => x.trim()).filter(Boolean).pop() || s
  }
  const stateMap: Record<string, string> = {
    binding: $t('parallel-driving.vehicle-list.state-binding'),
    active: $t('parallel-driving.vehicle-list.state-active'),
    releasing: $t('parallel-driving.vehicle-list.state-releasing'),
    released: $t('parallel-driving.vehicle-list.state-released'),
  }
  return stateMap[s] || s
}

// 获取会话状态颜色
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

// 远程接管
const handleTakeover = async (record: any) => {
  // 使用当前选择的驾驶舱
  if (!selectedCockpitId.value) {
    onlyMessage($t('parallel-driving.vehicle-list.select-cockpit-first'), 'warning')
    return
  }

  // 检查车辆是否在线
  if (record.state?.value !== 'online') {
    onlyMessage($t('parallel-driving.vehicle-list.vehicle-offline'), 'error')
    return
  }

  // 检查车辆是否已被其他驾驶舱接管
  if (isActiveState(record.sessionState) && record.boundCockpitId !== selectedCockpitId.value) {
    onlyMessage($t('parallel-driving.vehicle-list.vehicle-already-taken-over'), 'error')
    return
  }

  // 检查驾驶舱是否已接管其他车辆
  // 这里可以通过查询当前驾驶舱的会话状态来判断
  // 暂时在前端提示，后端会验证

  record.takingOver = true
  try {
    const result = await takeover({
      cockpitDeviceId: selectedCockpitId.value,
      vehicleDeviceId: record.deviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.vehicle-list.takeover-success'))
      refresh()
    } else {
      const msg = (result as any)?.message
      onlyMessage(msg || $t('parallel-driving.vehicle-list.takeover-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.vehicle-list.takeover-failed'), 'error')
  } finally {
    record.takingOver = false
  }
}

// 释放控制
const handleRelease = async (record: any) => {
  // 使用当前选择的驾驶舱
  if (!selectedCockpitId.value) {
    onlyMessage($t('parallel-driving.vehicle-list.select-cockpit-first'), 'warning')
    return
  }

  // 检查是否是该驾驶舱接管的
  if (!isActiveState(record.sessionState) || record.boundCockpitId !== selectedCockpitId.value) {
    onlyMessage($t('parallel-driving.vehicle-list.not-taken-over-by-current-cockpit'), 'warning')
    return
  }

  record.releasing = true
  try {
    const result = await release({
      cockpitDeviceId: selectedCockpitId.value,
      vehicleDeviceId: record.deviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.vehicle-list.release-success'))
      refresh()
    } else {
      const msg = (result as any)?.message
      onlyMessage(msg || $t('parallel-driving.vehicle-list.release-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.vehicle-list.release-failed'), 'error')
  } finally {
    record.releasing = false
  }
}

// 搜索
const handleSearch = (p: Record<string, any>) => {
  params.value = p
}

// 刷新
const refresh = () => {
  tableRef.value?.reload()
}

// 初始化：加载驾驶舱列表，并恢复上次选择的驾驶舱
onMounted(() => {
  loadCockpitDevices()
  // 恢复视图模式（默认列表）
  try {
    const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY)
    if (savedMode === 'CARD' || savedMode === 'TABLE') {
      viewMode.value = savedMode
    }
  } catch (e) {
    // ignore
  }
  // 恢复上次选择的驾驶舱
  try {
    const savedCockpitId = localStorage.getItem('parallelDriving.cockpitDeviceId')
    if (savedCockpitId) {
      selectedCockpitId.value = savedCockpitId
      // 触发一次查询
      refresh()
    }
  } catch (e) {
    // ignore
  }
})
</script>

<style scoped lang="less">
.card-item-content-text {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.75);
  margin-bottom: 4px;
  opacity: 0.75;
}

.link-name {
  color: #1890ff;
  cursor: pointer;
}
.link-name:hover {
  text-decoration: underline;
}

.card-title-link:hover {
  color: #1890ff;
}

/* 表格操作列链接：明确可点 + 轻量过渡（ui-ux-pro-max 交互清单） */
.pd-action-link.ant-btn-link {
  cursor: pointer;
  padding-inline: 4px;
  transition: color 0.2s ease, opacity 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .pd-action-link.ant-btn-link {
    transition: none;
  }
}
</style>
