<template>
  <a-config-provider :get-popup-container="getJcPopupContainer">
  <div ref="jcPageRef" class="jc-page">
    <!-- 左侧配置面板 -->
    <aside class="jc-left">
      <!-- 品牌 + 车辆选择 -->
      <div class="jc-left-header">
        <div class="jc-brand">
          <span class="jc-brand-logo">Z</span>
          <span class="jc-brand-name">ZERON</span>
        </div>
        <a-select
          v-model:value="selectedVehicle"
          placeholder="选择车辆"
          show-search
          allow-clear
          :loading="vehicleLoading"
          :filter-option="false"
          class="jc-vehicle-select"
          @search="handleVehicleSearch"
          @change="handleVehicleChange"
        >
          <a-select-option v-for="v in vehicleList" :key="v.id" :value="v.id">
            {{ v.name }}
          </a-select-option>
        </a-select>
        <div class="jc-header-actions">
          <a-button class="jc-icon-btn" title="刷新" @click="handleReset">
            <ReloadOutlined />
          </a-button>
          <a-button class="jc-icon-btn" title="设置" @click="showSettings = !showSettings">
            <SettingOutlined />
          </a-button>
        </div>
      </div>
      <div v-if="selectedVehicleName" class="jc-vehicle-badge">
        <span class="jc-vb-dot" />
        <span class="jc-vb-name">{{ selectedVehicleName }}</span>
        <span class="jc-vb-tag">在线</span>
      </div>

      <div class="jc-left-body">
        <!-- 作业信息（WDS 接口） -->
        <section class="jc-section">
          <div class="jc-section-title">
            <span>作业</span>
            <a-spin v-if="metricsLoading" :indicator="null" size="small" style="margin-left:6px" />
            <ReloadOutlined class="jc-section-icon" style="cursor:pointer" @click="fetchVehicleMetrics()" />
          </div>
          <dl class="jc-info-dl">
            <div class="jc-dl-pair"><dt>车牌号</dt><dd class="jc-mono">{{ vehicleMetrics.vehicleNo }}</dd></div>
            <div class="jc-dl-pair">
              <dt>状态</dt>
              <dd><span class="jc-status-dot" :class="metricsStatusClass" />{{ metricsStatusLabel }}</dd>
            </div>
            <div class="jc-dl-pair"><dt>内部编号</dt><dd class="jc-mono">{{ vehicleMetrics.internalCode }}</dd></div>
            <div class="jc-dl-pair"><dt>当前位置</dt><dd>{{ formatLoadPoint(vehicleMetrics.currentLoadPoint) }}</dd></div>
            <div class="jc-dl-pair jc-dl-full"><dt>指派位置</dt><dd>{{ formatLoadPoint(vehicleMetrics.assignedLoadPoints) }}</dd></div>
            <div class="jc-dl-pair jc-dl-full"><dt>卸载位置</dt><dd>{{ formatLoadPoint(vehicleMetrics.assignedUnloadPoints) }}</dd></div>
          </dl>
        </section>

        <!-- 目标点选择（按类型分组） -->
        <section class="jc-section">
          <div class="jc-section-title">
            <span>目标点</span>
            <a-spin v-if="pointsLoading" :indicator="null" size="small" style="margin-left:6px" />
            <ReloadOutlined class="jc-section-icon" style="cursor:pointer" @click="fetchLoadingPoints()" />
          </div>
          <div class="jc-param-row">
            <a-select
              v-model:value="selectedPointCode"
              placeholder="选择目标点"
              show-search
              allow-clear
              :filter-option="filterPointOption"
              class="jc-param-select jc-param-select-grow"
              :loading="pointsLoading"
              option-label-prop="label"
            >
              <a-select-opt-group v-for="g in pointGroups" :key="g.type" :label="g.typeDesc">
                <a-select-option
                  v-for="p in g.items"
                  :key="p.pointCode"
                  :value="p.pointCode"
                  :label="`${p.pointName} (${p.pointCode})`"
                >
                  <div class="jc-point-option">
                    <span>{{ p.pointName }}</span>
                    <span class="jc-point-code">{{ p.pointCode }}</span>
                    <span class="jc-point-status" :class="p.status === 'IDLE' ? 'is-idle' : 'is-busy'">{{ p.statusDesc }}</span>
                  </div>
                </a-select-option>
              </a-select-opt-group>
            </a-select>
          </div>
          <div v-if="selectedPoint" class="jc-point-detail">
            <span class="jc-point-detail-name">{{ selectedPoint.pointName }}</span>
            <a-tag :color="isChargingPoint ? '#52c41a' : '#1890ff'" size="small">{{ selectedPoint.pointTypeDesc }}</a-tag>
            <span class="jc-point-detail-status" :class="selectedPoint.status === 'IDLE' ? 'is-idle' : 'is-busy'">{{ selectedPoint.statusDesc }}</span>
          </div>
          <div class="jc-param-row" style="margin-top: 4px;">
            <a-button
              class="jc-cmd-btn-sm"
              :class="isChargingPoint ? 'jc-cmd-btn-charge' : 'jc-cmd-btn-park'"
              :loading="moveLoading"
              :disabled="!selectedPointCode"
              @click="handleMoveToPoint"
            >
              {{ isChargingPoint ? '⚡ 去充电' : '🅿️ 去停车' }}
            </a-button>
          </div>
        </section>

        <!-- 其他操作参数 
        <section class="jc-section">
          <div class="jc-param-row">
            <span class="jc-param-label">车辆对位</span>
            <a-input-number v-model:value="form.alignmentThreshold" :min="1" :max="100" class="jc-param-input" />
            <span class="jc-param-unit">cm</span>
            <CheckCircleFilled v-if="form.alignmentThreshold > 0" class="jc-check-icon" />
          </div>
          <div class="jc-param-row">
            <span class="jc-param-label">选位行驶</span>
            <a-select v-model:value="form.driveSide" class="jc-param-select">
              <a-select-option value="warehouse">库区侧</a-select-option>
              <a-select-option value="road">道路侧</a-select-option>
            </a-select>
          </div>
        </section>  -->

        <!-- 功能指令按钮（分组） -->
        <section v-for="group in commandGroups" :key="group.title" class="jc-section jc-cmd-section">
          <div class="jc-cmd-group-title">{{ group.title }}</div>
          <div class="jc-cmd-grid">
            <button
              v-for="cmd in group.items"
              :key="cmd.key"
              class="jc-cmd-btn"
              :class="[cmd.variant ? `jc-cmd-btn--${cmd.variant}` : '']"
              :title="cmd.label"
              @click="handleCommand(cmd.key)"
            >
              {{ cmd.label }}
            </button>
          </div>
        </section>

        <!-- 作业状态 & 行车灯 -->
        <section class="jc-section jc-status-bar">
          <div class="jc-status-item">
            <span class="jc-status-label">作业状态:</span>
            <span class="jc-status-dot" :class="jobStatusClass" />
            <span class="jc-status-text">{{ form.jobStatus }}</span>
          </div>
          <div class="jc-status-item">
            <span class="jc-status-label">行车灯:</span>
            <span class="jc-status-dot" :class="headlightClass" />
            <span class="jc-status-text">{{ form.headlightStatus }}</span>
          </div>
        </section>

        <!-- PNC 实时状态 -->
        <section class="jc-section jc-pnc">
          <div class="jc-section-title"><span>PNC</span></div>

          <!-- 管理器 + Planner 状态指示 -->
          <div class="jc-pnc-states">
            <div class="jc-pnc-state-card">
              <span class="jc-pnc-state-label">Manager</span>
              <span class="jc-pnc-state-badge" :class="`is-${pncManagerStateClass}`">{{ pncState.manager }}</span>
            </div>
            <div class="jc-pnc-state-card">
              <span class="jc-pnc-state-label">Planner</span>
              <span class="jc-pnc-state-badge" :class="`is-${pncPlannerStateClass}`">{{ pncState.localPlanner }}</span>
            </div>
            <div class="jc-pnc-state-card">
              <span class="jc-pnc-state-label">任务类型</span>
              <span class="jc-pnc-state-val">{{ pncTaskTypeLabel }}</span>
            </div>
          </div>

          <!-- 当前任务详情 -->
          <dl class="jc-info-dl" style="margin-bottom:4px">
            <div class="jc-dl-pair"><dt>Task ID</dt><dd class="jc-mono">{{ pncState.taskId || '--' }}</dd></div>
            <div class="jc-dl-pair"><dt>opt_mode</dt><dd class="jc-mono">{{ pncState.optMode || '--' }}</dd></div>
            <div class="jc-dl-pair"><dt>目标点</dt><dd>{{ pncState.goalName || '--' }}</dd></div>
            <div class="jc-dl-pair"><dt>Gate</dt><dd class="jc-mono">{{ pncState.gateName || '--' }} {{ pncState.side || '' }}</dd></div>
          </dl>

          <!-- 规划 Pipeline 进度 -->
          <div class="jc-pnc-pipeline">
            <div class="jc-pnc-pipe-step" :class="{ active: pncPipeStep >= 1, done: pncPipeStep > 1 }">
              <span class="jc-pipe-dot" />
              <span class="jc-pipe-text">任务接收</span>
            </div>
            <div class="jc-pnc-pipe-line" :class="{ active: pncPipeStep >= 2 }" />
            <div class="jc-pnc-pipe-step" :class="{ active: pncPipeStep >= 2, done: pncPipeStep > 2 }">
              <span class="jc-pipe-dot" />
              <span class="jc-pipe-text">全局规划</span>
            </div>
            <div class="jc-pnc-pipe-line" :class="{ active: pncPipeStep >= 3 }" />
            <div class="jc-pnc-pipe-step" :class="{ active: pncPipeStep >= 3, done: pncPipeStep > 3 }">
              <span class="jc-pipe-dot" />
              <span class="jc-pipe-text">局部执行</span>
            </div>
            <div class="jc-pnc-pipe-line" :class="{ active: pncPipeStep >= 4 }" />
            <div class="jc-pnc-pipe-step" :class="{ active: pncPipeStep >= 4 }">
              <span class="jc-pipe-dot" />
              <span class="jc-pipe-text">完成</span>
            </div>
          </div>

          <!-- PNC 日志流 -->
          <div class="jc-pnc-logs-title">执行日志</div>
          <div class="jc-pnc-logs-scroll">
            <div v-for="log in pncState.logs" :key="log.id" class="jc-pnc-log">
              <span class="jc-pnc-log-name">{{ log.name }}</span>
              <span class="jc-pnc-log-status" :class="log.ok ? 'is-ok' : 'is-warn'">{{ log.statusText }}</span>
              <span class="jc-pnc-log-desc">{{ log.desc }}</span>
              <span class="jc-pnc-log-time jc-mono">{{ log.time }}</span>
            </div>
            <div v-if="!pncState.logs.length" class="jc-pnc-empty">暂无日志</div>
          </div>
        </section>
      </div>

      <!-- 底部搜索 -->
      <div class="jc-left-footer">
        <a-input v-model:value="searchText" placeholder="搜索" class="jc-search-input" allow-clear>
          <template #prefix><SearchOutlined /></template>
        </a-input>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="jc-right">
      <!-- 顶部 Tab 导航 -->
      <nav class="jc-nav">
        <button
          v-for="tab in navTabs"
          :key="tab.key"
          class="jc-nav-tab"
          :class="{ 'is-active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" class="jc-nav-tab-icon" />
          {{ tab.label }}
        </button>
      </nav>

      <!-- ====== Tab: 节点控制 — 视频网格 ====== -->
      <template v-if="activeTab === 'nodeControl'">
        <div class="jc-video-grid">
          <div
            v-for="cam in cameras"
            :key="cam.id"
            class="jc-video-cell"
            :class="{ 'is-selected': cam.selected }"
            @click="handleCameraClick(cam.id)"
          >
            <div class="jc-video-placeholder">
              <VideoCameraOutlined class="jc-video-camera-icon" />
            </div>
            <div class="jc-video-bottom">
              <span class="jc-video-id">{{ cam.name }}</span>
              <span v-if="cam.selected" class="jc-video-selected-tag">当前</span>
            </div>
          </div>
        </div>
        <div v-if="vehicleLoading" class="jc-video-grid jc-skeleton-grid">
          <div v-for="i in 4" :key="i" class="jc-video-cell jc-skeleton-cell">
            <div class="jc-skeleton-pulse" />
          </div>
        </div>
        <div v-else-if="!cameras.length" class="jc-video-empty">
          <VideoCameraOutlined style="font-size:32px;opacity:0.2" />
          <span>暂无车辆</span>
        </div>
      </template>

      <!-- ====== Tab: 作业功能配置 ====== -->
      <div v-if="activeTab === 'jobConfig'" class="jcfg">
        <div class="jcfg-scroll">

          <!-- 两列布局 -->
          <div class="jcfg-cols">
            <!-- 左列 -->
            <div class="jcfg-col">

              <!-- 作业参数 -->
              <div class="jcfg-card">
                <div class="jcfg-card-title">
                  <ScheduleOutlined class="jcfg-card-icon" />
                  <span>作业参数配置</span>
                </div>
                <div class="jcfg-form">
                  <div class="jcfg-field">
                    <span class="jcfg-label">指令来源</span>
                    <a-select v-model:value="jobCfg.commandSource" class="jcfg-select">
                      <a-select-option value="dispatch">调度中心</a-select-option>
                      <a-select-option value="cloud">云端</a-select-option>
                      <a-select-option value="manual">手动</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">默认目标库</span>
                    <a-select v-model:value="jobCfg.defaultTarget" class="jcfg-select">
                      <a-select-option value="heipiku">黑皮库</a-select-option>
                      <a-select-option value="tuixiku">退洗库</a-select-option>
                      <a-select-option value="chengpinku">成品库</a-select-option>
                      <a-select-option value="yuanliaoku">原料库</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">车道</span>
                    <a-input-number v-model:value="jobCfg.lane" :min="1" :max="99" class="jcfg-input-num" />
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">停车/充电位</span>
                    <a-select
                      v-model:value="selectedPointCode"
                      placeholder="选择目的点"
                      show-search
                      allow-clear
                      :filter-option="filterPointOption"
                      class="jcfg-select"
                      :loading="pointsLoading"
                      option-label-prop="label"
                    >
                      <a-select-opt-group v-for="g in pointGroups" :key="g.type" :label="g.typeDesc">
                        <a-select-option
                          v-for="p in g.items"
                          :key="p.pointCode"
                          :value="p.pointCode"
                          :label="`${p.pointName} (${p.pointCode})`"
                        >
                          <div class="jc-point-option">
                            <span>{{ p.pointName }}</span>
                            <span class="jc-point-code">{{ p.pointCode }}</span>
                            <span class="jc-point-status" :class="p.status === 'IDLE' ? 'is-idle' : 'is-busy'">{{ p.statusDesc }}</span>
                          </div>
                        </a-select-option>
                      </a-select-opt-group>
                    </a-select>
                  </div>
                </div>
              </div>

              <!-- 路径配置 -->
              <div class="jcfg-card">
                <div class="jcfg-card-title">
                  <NodeIndexOutlined class="jcfg-card-icon" />
                  <span>路径配置</span>
                </div>
                <div class="jcfg-form">
                  <div class="jcfg-field">
                    <span class="jcfg-label">路径行驶模式</span>
                    <a-select v-model:value="jobCfg.pathMode" class="jcfg-select">
                      <a-select-option value="follow">跟头器</a-select-option>
                      <a-select-option value="free">自由路径</a-select-option>
                      <a-select-option value="fixed">固定路线</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">路径编号</span>
                    <a-input v-model:value="jobCfg.pathId" placeholder="例：3 WH-A01" class="jcfg-input" />
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">车辆对位阈值</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.alignThreshold" :min="1" :max="100" class="jcfg-input-num" />
                      <span class="jcfg-unit">CM</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 安全参数 -->
              <div class="jcfg-card">
                <div class="jcfg-card-title">
                  <SafetyCertificateOutlined class="jcfg-card-icon" />
                  <span>安全参数配置</span>
                </div>
                <div class="jcfg-form">
                  <div class="jcfg-field jcfg-field--full">
                    <span class="jcfg-label">最大速度限制</span>
                    <div class="jcfg-slider-row">
                      <a-slider v-model:value="jobCfg.maxSpeed" :min="0" :max="60" class="jcfg-slider" />
                      <span class="jcfg-slider-val jc-mono">{{ jobCfg.maxSpeed }} km/h</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">障碍物检测距离</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.obstacleDistance" :min="0.5" :max="50" :step="0.5" class="jcfg-input-num" />
                      <span class="jcfg-unit">m</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">停车区域距离阈值</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.parkDistThreshold" :min="0.1" :max="10" :step="0.1" class="jcfg-input-num" />
                      <span class="jcfg-unit">m</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">紧急制动阈值</span>
                    <a-input-number v-model:value="jobCfg.emergencyBrakeThreshold" :min="0" :max="100" class="jcfg-input-num" />
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">行车灯控制</span>
                    <a-switch v-model:checked="jobCfg.headlightEnabled" size="small" />
                  </div>
                </div>
              </div>
            </div>

            <!-- 右列 -->
            <div class="jcfg-col">

              <!-- 功能开关 -->
              <div class="jcfg-card">
                <div class="jcfg-card-title">
                  <ControlOutlined class="jcfg-card-icon" />
                  <span>功能开关配置</span>
                </div>
                <div class="jcfg-toggle-grid">
                  <div v-for="item in featureToggles" :key="item.key" class="jcfg-toggle-item">
                    <span class="jcfg-toggle-label">{{ item.label }}</span>
                    <a-switch v-model:checked="jobCfg.features[item.key]" size="small" />
                  </div>
                </div>
              </div>

              <!-- PNC 参数 -->
              <div class="jcfg-card">
                <div class="jcfg-card-title">
                  <RobotOutlined class="jcfg-card-icon" />
                  <span>PNC 参数配置</span>
                </div>
                <div class="jcfg-form">
                  <div class="jcfg-field">
                    <span class="jcfg-label">PNC 模式</span>
                    <a-select v-model:value="jobCfg.pncMode" class="jcfg-select">
                      <a-select-option value="auto">自动</a-select-option>
                      <a-select-option value="manual">手动</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">OPT 模式</span>
                    <a-select v-model:value="jobCfg.optMode" class="jcfg-select">
                      <a-select-option value="Default">Default</a-select-option>
                      <a-select-option value="Forward">Forward</a-select-option>
                      <a-select-option value="Backward">Backward</a-select-option>
                      <a-select-option value="FreeAngle">FreeAngle</a-select-option>
                      <a-select-option value="Amble">Amble</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field jcfg-field--full">
                    <span class="jcfg-label">TAKEOVER 触发条件</span>
                    <div class="jcfg-check-row">
                      <a-checkbox v-for="c in takeoverOptions" :key="c.value" v-model:checked="jobCfg.takeoverMap[c.value]">
                        {{ c.label }}
                      </a-checkbox>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">规划超时</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.planningTimeout" :min="1" :max="120" class="jcfg-input-num" />
                      <span class="jcfg-unit">s</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">执行超时</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.executionTimeout" :min="10" :max="600" class="jcfg-input-num" />
                      <span class="jcfg-unit">s</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">目标位置容差</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.goalTolerance" :min="0.05" :max="5" :step="0.05" :precision="2" class="jcfg-input-num" />
                      <span class="jcfg-unit">m</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">目标角度容差</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.goalAngleTolerance" :min="0.5" :max="45" :step="0.5" :precision="1" class="jcfg-input-num" />
                      <span class="jcfg-unit">°</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">停车速度容差</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.stoppingVelocityTolerance" :min="0.01" :max="2" :step="0.01" :precision="2" class="jcfg-input-num" />
                      <span class="jcfg-unit">m/s</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">DEAD_LOCK 超时</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.deadlockTimeout" :min="5" :max="300" class="jcfg-input-num" />
                      <span class="jcfg-unit">s</span>
                    </div>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">自动恢复策略</span>
                    <a-select v-model:value="jobCfg.recoveryStrategy" class="jcfg-select">
                      <a-select-option value="retry">重试当前任务</a-select-option>
                      <a-select-option value="reroute">重新规划路径</a-select-option>
                      <a-select-option value="park">就近停车</a-select-option>
                      <a-select-option value="manual">等待人工介入</a-select-option>
                    </a-select>
                  </div>
                  <div class="jcfg-field">
                    <span class="jcfg-label">轮询频率</span>
                    <div class="jcfg-inline">
                      <a-input-number v-model:value="jobCfg.loopRate" :min="1" :max="100" class="jcfg-input-num" />
                      <span class="jcfg-unit">Hz</span>
                    </div>
                  </div>
                  <div class="jcfg-field jcfg-field--full">
                    <span class="jcfg-label">Gate Keeper 参数</span>
                    <div class="jcfg-sub-row">
                      <div class="jcfg-sub-field">
                        <span class="jcfg-sub-label">跳变阈值</span>
                        <a-input-number v-model:value="jobCfg.gkJumpThreshold" :min="0" :max="100" :step="1" class="jcfg-input-num" size="small" />
                      </div>
                      <div class="jcfg-sub-field">
                        <span class="jcfg-sub-label">丢失超时</span>
                        <div class="jcfg-inline">
                          <a-input-number v-model:value="jobCfg.gkLossTimeout" :min="0.1" :max="30" :step="0.1" :precision="1" class="jcfg-input-num" size="small" />
                          <span class="jcfg-unit">s</span>
                        </div>
                      </div>
                      <div class="jcfg-sub-field">
                        <span class="jcfg-sub-label">异常阈值</span>
                        <a-input-number v-model:value="jobCfg.gkAnomalyThreshold" :min="0" :max="50" :step="1" class="jcfg-input-num" size="small" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="jcfg-actions">
                <a-button class="jcfg-action-btn jcfg-action-btn--ghost" @click="handleJobCfgReset">
                  <template #icon><ReloadOutlined /></template>
                  重置默认
                </a-button>
                <a-button type="primary" class="jcfg-action-btn jcfg-action-btn--primary" :loading="jobCfgSaving" @click="handleJobCfgSave">
                  <template #icon><SaveOutlined /></template>
                  保存配置
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ====== Tab: 电源管理 ====== -->
      <div v-if="activeTab === 'powerMgmt'" class="pwr">
        <div class="pwr-scroll">

          <!-- 整车高压系统 -->
          <div class="pwr-section">
            <div class="pwr-section-title">
              <ThunderboltOutlined class="pwr-section-icon" />
              <span>高压系统</span>
              <span class="pwr-hv-indicator" :class="powerSys.hvActive ? 'is-on' : 'is-off'">
                {{ powerSys.hvActive ? '已上电' : '未上电' }}
              </span>
            </div>
            <div class="pwr-cards">
              <div class="pwr-card">
                <span class="pwr-card-label">高压总开关</span>
                <span class="pwr-card-status" :class="powerSys.hvContactor ? 'is-on' : 'is-off'">
                  {{ powerSys.hvContactor ? 'ON' : 'OFF' }}
                </span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">预充状态</span>
                <span class="pwr-card-status" :class="prechargeClass">{{ prechargeLabel }}</span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">高压互锁</span>
                <span class="pwr-card-status" :class="powerSys.hvInterlock ? 'is-on' : 'is-off'">
                  {{ powerSys.hvInterlock ? '正常' : '断开' }}
                </span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">绝缘监测</span>
                <span class="pwr-card-val jc-mono" :class="{ 'is-warn': powerSys.insulationR < 500 }">
                  {{ powerSys.insulationR }} MΩ
                </span>
              </div>
            </div>
          </div>

          <!-- 低压系统 (12V/24V) -->
          <div class="pwr-section">
            <div class="pwr-section-title">
              <DashboardOutlined class="pwr-section-icon" />
              <span>低压系统</span>
            </div>
            <div class="pwr-cards">
              <div class="pwr-card">
                <span class="pwr-card-label">DCDC 状态</span>
                <span class="pwr-card-status" :class="powerSys.dcdcActive ? 'is-on' : 'is-off'">
                  {{ powerSys.dcdcActive ? '工作中' : '停止' }}
                </span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">DCDC 输出</span>
                <span class="pwr-card-val jc-mono">{{ powerSys.dcdcOutputV.toFixed(1) }}V</span>
                <span class="pwr-card-sub jc-mono">{{ powerSys.dcdcOutputA.toFixed(1) }}A</span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">蓄电池电压</span>
                <span class="pwr-card-val jc-mono" :class="{ 'is-warn': powerSys.auxBatteryV < 22 }">
                  {{ powerSys.auxBatteryV.toFixed(1) }}V
                </span>
              </div>
              <div class="pwr-card">
                <span class="pwr-card-label">KL15 (ACC)</span>
                <span class="pwr-card-status" :class="powerSys.kl15 ? 'is-on' : 'is-off'">
                  {{ powerSys.kl15 ? 'ON' : 'OFF' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 域控 & 传感器供电 -->
          <div class="pwr-section">
            <div class="pwr-section-title">
              <ApiOutlined class="pwr-section-icon" />
              <span>域控 & 传感器供电</span>
            </div>
            <div class="pwr-rail-grid">
              <div
                v-for="rail in powerSys.rails"
                :key="rail.name"
                class="pwr-rail"
                :class="rail.on ? 'is-on' : 'is-off'"
              >
                <div class="pwr-rail-dot" />
                <span class="pwr-rail-name">{{ rail.name }}</span>
                <span v-if="rail.on" class="pwr-rail-info jc-mono">{{ rail.voltage.toFixed(1) }}V / {{ rail.current.toFixed(1) }}A</span>
                <span v-else class="pwr-rail-info is-off">断电</span>
              </div>
            </div>
          </div>

          <!-- 通信链路 -->
          <div class="pwr-section">
            <div class="pwr-section-title">
              <WifiOutlined class="pwr-section-icon" />
              <span>通信链路</span>
            </div>
            <div class="pwr-cards">
              <div v-for="link in powerSys.commLinks" :key="link.name" class="pwr-card pwr-card--wide">
                <div class="pwr-link-row">
                  <span class="pwr-card-label">{{ link.name }}</span>
                  <span class="pwr-link-status" :class="link.ok ? 'is-on' : 'is-off'">
                    {{ link.ok ? '正常' : '中断' }}
                  </span>
                </div>
                <div v-if="link.latency !== undefined" class="pwr-link-detail">
                  <span class="pwr-link-metric jc-mono">延迟 {{ link.latency }}ms</span>
                  <span v-if="link.signal !== undefined" class="pwr-link-metric jc-mono">信号 {{ link.signal }}dBm</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 功率分布 -->
          <div class="pwr-section">
            <div class="pwr-section-title">
              <ControlOutlined class="pwr-section-icon" />
              <span>功率分布</span>
            </div>
            <div class="pwr-power-bars">
              <div v-for="item in powerDistribution" :key="item.name" class="pwr-power-row">
                <span class="pwr-power-label">{{ item.name }}</span>
                <div class="pwr-power-bar-track">
                  <div
                    class="pwr-power-bar-fill"
                    :style="{ width: item.percent + '%', background: item.color }"
                  />
                </div>
                <span class="pwr-power-val jc-mono">{{ item.power }}W</span>
              </div>
            </div>
          </div>

          <!-- 告警 -->
          <div class="pwr-section" v-if="powerSys.alerts.length">
            <div class="pwr-section-title">
              <AlertOutlined class="pwr-section-icon" style="color:#ef4444" />
              <span>电源告警</span>
              <span class="pwr-alert-count">{{ powerSys.alerts.length }}</span>
            </div>
            <div class="pwr-alert-list">
              <div v-for="a in powerSys.alerts" :key="a.id" class="pwr-alert-item" :class="`is-${a.level}`">
                <span class="pwr-alert-level">{{ a.level === 'error' ? '故障' : '警告' }}</span>
                <span class="pwr-alert-msg">{{ a.message }}</span>
                <span class="pwr-alert-time jc-mono">{{ a.time }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- ====== Tab: 电池管理 ====== -->
      <div v-if="activeTab === 'batteryMgmt'" class="bms">
        <div class="bms-scroll">

          <!-- 顶部核心指标 -->
          <div class="bms-metrics">
            <!-- SOC 仪表 -->
            <div class="bms-card bms-card--soc">
              <div class="bms-gauge">
                <svg viewBox="0 0 120 120" class="bms-gauge-svg">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8" />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    :stroke="socColor"
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${bms.soc * 3.267} 326.7`"
                    transform="rotate(-90 60 60)"
                    style="transition: stroke-dasharray 0.6s ease"
                  />
                </svg>
                <div class="bms-gauge-inner">
                  <span class="bms-gauge-value jc-mono">{{ bms.soc }}</span>
                  <span class="bms-gauge-unit">%</span>
                </div>
              </div>
              <span class="bms-card-label">SOC 电量</span>
            </div>

            <!-- SOH -->
            <div class="bms-card">
              <div class="bms-metric-big">
                <span class="bms-metric-val jc-mono" :style="{ color: sohColor }">{{ bms.soh }}</span>
                <span class="bms-metric-unit">%</span>
              </div>
              <span class="bms-card-label">SOH 健康度</span>
              <div class="bms-metric-bar">
                <div class="bms-metric-bar-fill" :style="{ width: bms.soh + '%', background: sohColor }" />
              </div>
            </div>

            <!-- 总电压 -->
            <div class="bms-card">
              <div class="bms-metric-big">
                <span class="bms-metric-val jc-mono">{{ bms.voltage.toFixed(1) }}</span>
                <span class="bms-metric-unit">V</span>
              </div>
              <span class="bms-card-label">总电压</span>
              <span class="bms-card-sub">额定 {{ bms.ratedVoltage }}V</span>
            </div>

            <!-- 总电流 -->
            <div class="bms-card">
              <div class="bms-metric-big">
                <span class="bms-metric-val jc-mono" :class="bms.current > 0 ? 'is-charge' : 'is-discharge'">
                  {{ bms.current > 0 ? '+' : '' }}{{ bms.current.toFixed(1) }}
                </span>
                <span class="bms-metric-unit">A</span>
              </div>
              <span class="bms-card-label">{{ bms.current > 0 ? '充电电流' : '放电电流' }}</span>
              <span class="bms-card-sub">功率 {{ Math.abs(bms.voltage * bms.current / 1000).toFixed(1) }} kW</span>
            </div>

            <!-- 温度 -->
            <div class="bms-card">
              <div class="bms-temp-row">
                <div class="bms-temp-item">
                  <span class="bms-temp-label">最低</span>
                  <span class="bms-temp-val jc-mono">{{ bms.tempMin }}°</span>
                </div>
                <div class="bms-temp-item">
                  <span class="bms-temp-label">平均</span>
                  <span class="bms-temp-val jc-mono bms-temp-avg">{{ bms.tempAvg }}°</span>
                </div>
                <div class="bms-temp-item">
                  <span class="bms-temp-label">最高</span>
                  <span class="bms-temp-val jc-mono" :class="{ 'is-hot': bms.tempMax > 45 }">{{ bms.tempMax }}°</span>
                </div>
              </div>
              <span class="bms-card-label">电池温度 (°C)</span>
            </div>

            <!-- 续航里程 -->
            <div class="bms-card">
              <div class="bms-metric-big">
                <span class="bms-metric-val jc-mono">{{ bms.rangeKm }}</span>
                <span class="bms-metric-unit">km</span>
              </div>
              <span class="bms-card-label">预估续航</span>
              <span class="bms-card-sub">能耗 {{ bms.consumptionPer100km }} kWh/100km</span>
            </div>
          </div>

          <!-- 中部：电池包 + 充电状态 -->
          <div class="bms-middle">
            <!-- 电芯矩阵 -->
            <div class="bms-pack-card">
              <div class="bms-pack-header">
                <span class="bms-pack-title">电芯电压分布</span>
                <div class="bms-pack-legend">
                  <span class="bms-legend-item"><i class="bms-legend-dot" style="background:#22c55e" />正常</span>
                  <span class="bms-legend-item"><i class="bms-legend-dot" style="background:#eab308" />偏低</span>
                  <span class="bms-legend-item"><i class="bms-legend-dot" style="background:#ef4444" />异常</span>
                </div>
              </div>
              <div class="bms-cell-grid">
                <div
                  v-for="(cell, idx) in bms.cells"
                  :key="idx"
                  class="bms-cell"
                  :class="cellClass(cell)"
                  :title="`#${idx + 1}: ${cell.toFixed(3)}V`"
                >
                  <span class="bms-cell-idx">{{ idx + 1 }}</span>
                </div>
              </div>
              <div class="bms-pack-stats">
                <span>最高 <b class="jc-mono">{{ cellMax.toFixed(3) }}V</b></span>
                <span>最低 <b class="jc-mono">{{ cellMin.toFixed(3) }}V</b></span>
                <span>压差 <b class="jc-mono" :class="{ 'is-hot': cellDiff > 0.05 }">{{ (cellDiff * 1000).toFixed(0) }}mV</b></span>
              </div>
            </div>

            <!-- 充电信息 + 电池参数 -->
            <div class="bms-side-col">
              <!-- 充电状态 -->
              <div class="bms-charge-card">
                <div class="bms-charge-header">
                  <span class="bms-charge-status" :class="`is-${bms.chargeState}`">
                    {{ chargeStateLabel }}
                  </span>
                  <span v-if="bms.chargeState === 'charging'" class="bms-charge-mode">{{ bms.chargeMode }}</span>
                </div>
                <div v-if="bms.chargeState === 'charging'" class="bms-charge-detail">
                  <div class="bms-charge-row">
                    <span class="bms-charge-label">充电功率</span>
                    <span class="bms-charge-val jc-mono">{{ bms.chargePower.toFixed(1) }} kW</span>
                  </div>
                  <div class="bms-charge-row">
                    <span class="bms-charge-label">已充电量</span>
                    <span class="bms-charge-val jc-mono">{{ bms.chargedKwh.toFixed(1) }} kWh</span>
                  </div>
                  <div class="bms-charge-row">
                    <span class="bms-charge-label">预计充满</span>
                    <span class="bms-charge-val jc-mono">{{ bms.chargeEta }}</span>
                  </div>
                  <div class="bms-charge-progress">
                    <div class="bms-charge-progress-fill" :style="{ width: bms.soc + '%' }" />
                  </div>
                </div>
                <div v-else class="bms-charge-idle">
                  <span>累计充电 <b class="jc-mono">{{ bms.totalChargeCycles }}</b> 次</span>
                  <span>累计充电量 <b class="jc-mono">{{ bms.totalChargedKwh.toFixed(0) }}</b> kWh</span>
                </div>
              </div>

              <!-- 电池包参数 -->
              <div class="bms-params-card">
                <span class="bms-params-title">电池包参数</span>
                <div class="bms-params-list">
                  <div class="bms-params-row">
                    <span class="bms-params-label">额定容量</span>
                    <span class="bms-params-val jc-mono">{{ bms.ratedCapacity }} kWh</span>
                  </div>
                  <div class="bms-params-row">
                    <span class="bms-params-label">可用容量</span>
                    <span class="bms-params-val jc-mono">{{ bms.availableCapacity.toFixed(1) }} kWh</span>
                  </div>
                  <div class="bms-params-row">
                    <span class="bms-params-label">电芯数量</span>
                    <span class="bms-params-val jc-mono">{{ bms.cells.length }} 节</span>
                  </div>
                  <div class="bms-params-row">
                    <span class="bms-params-label">绝缘电阻</span>
                    <span class="bms-params-val jc-mono">{{ bms.insulationResistance }} MΩ</span>
                  </div>
                  <div class="bms-params-row">
                    <span class="bms-params-label">冷却系统</span>
                    <span class="bms-params-val" :class="bms.coolingActive ? 'jc-text-ok' : ''">
                      {{ bms.coolingActive ? '运行中' : '待机' }}
                    </span>
                  </div>
                  <div class="bms-params-row">
                    <span class="bms-params-label">均衡状态</span>
                    <span class="bms-params-val" :class="bms.balancing ? 'jc-text-ok' : ''">
                      {{ bms.balancing ? '均衡中' : '正常' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部：告警列表 -->
          <div class="bms-alerts-card">
            <div class="bms-alerts-header">
              <span class="bms-alerts-title">告警信息</span>
              <span class="bms-alerts-count" :class="{ 'is-warn': bms.alerts.length > 0 }">
                {{ bms.alerts.length }} 条
              </span>
            </div>
            <div v-if="bms.alerts.length" class="bms-alerts-list">
              <div v-for="a in bms.alerts" :key="a.id" class="bms-alert-item" :class="`is-${a.level}`">
                <span class="bms-alert-level">{{ a.level === 'error' ? '故障' : '警告' }}</span>
                <span class="bms-alert-msg">{{ a.message }}</span>
                <span class="bms-alert-time jc-mono">{{ a.time }}</span>
              </div>
            </div>
            <div v-else class="bms-alerts-empty">
              <CheckCircleFilled style="color:#22c55e;font-size:16px" />
              <span>系统正常，无告警</span>
            </div>
          </div>

        </div>
      </div>

      <!-- ====== Tab: 仿真设置 ====== -->
      <div v-if="activeTab === 'simulation'" class="sim">
        <div class="sim-scroll">

          <!-- 场景选择 -->
          <div class="sim-row">
            <div class="sim-card sim-card--wide">
              <div class="sim-card-header">
                <span class="sim-card-title">场景选择</span>
                <a-button class="jc-cmd-btn-sm" @click="handleSimAction('loadScene')">加载场景</a-button>
              </div>
              <div class="sim-scene-grid">
                <div
                  v-for="scene in sim.scenes"
                  :key="scene.id"
                  class="sim-scene-item"
                  :class="{ 'is-active': sim.activeScene === scene.id }"
                  @click="sim.activeScene = scene.id"
                >
                  <div class="sim-scene-icon">
                    <component :is="scene.icon" />
                  </div>
                  <span class="sim-scene-name">{{ scene.name }}</span>
                  <span class="sim-scene-desc">{{ scene.desc }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 环境参数 + 车辆动力学 -->
          <div class="sim-row sim-row--2col">
            <!-- 环境参数 -->
            <div class="sim-card">
              <span class="sim-card-title">环境参数</span>
              <div class="sim-form">
                <div class="sim-field">
                  <span class="sim-field-label">天气</span>
                  <a-select v-model:value="sim.env.weather" class="sim-select">
                    <a-select-option value="clear">晴天</a-select-option>
                    <a-select-option value="cloudy">多云</a-select-option>
                    <a-select-option value="rain">小雨</a-select-option>
                    <a-select-option value="heavy_rain">大雨</a-select-option>
                    <a-select-option value="fog">雾天</a-select-option>
                    <a-select-option value="snow">雪天</a-select-option>
                  </a-select>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">时间段</span>
                  <a-select v-model:value="sim.env.timeOfDay" class="sim-select">
                    <a-select-option value="day">白天</a-select-option>
                    <a-select-option value="dusk">黄昏</a-select-option>
                    <a-select-option value="night">夜间</a-select-option>
                  </a-select>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">能见度</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.env.visibility" :min="50" :max="2000" :step="50" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.env.visibility }}m</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">风速</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.env.windSpeed" :min="0" :max="30" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.env.windSpeed }}m/s</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">路面状况</span>
                  <a-select v-model:value="sim.env.roadCondition" class="sim-select">
                    <a-select-option value="dry">干燥</a-select-option>
                    <a-select-option value="wet">湿滑</a-select-option>
                    <a-select-option value="icy">结冰</a-select-option>
                    <a-select-option value="muddy">泥泞</a-select-option>
                  </a-select>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">环境温度</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.env.temperature" :min="-20" :max="50" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.env.temperature }}°C</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 车辆动力学 -->
            <div class="sim-card">
              <span class="sim-card-title">车辆动力学</span>
              <div class="sim-form">
                <div class="sim-field">
                  <span class="sim-field-label">载重</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.vehicle.loadTon" :min="0" :max="40" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.vehicle.loadTon }}t</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">初始 SOC</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.vehicle.initSoc" :min="5" :max="100" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.vehicle.initSoc }}%</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">轮胎摩擦系数</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.vehicle.tireFriction" :min="30" :max="100" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ (sim.vehicle.tireFriction / 100).toFixed(2) }}</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">最大速度限制</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.vehicle.maxSpeed" :min="5" :max="60" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.vehicle.maxSpeed }}km/h</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">制动响应延迟</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.vehicle.brakeDelay" :min="50" :max="500" :step="10" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.vehicle.brakeDelay }}ms</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">转向响应</span>
                  <a-select v-model:value="sim.vehicle.steeringMode" class="sim-select">
                    <a-select-option value="normal">标准</a-select-option>
                    <a-select-option value="heavy">重载模式</a-select-option>
                    <a-select-option value="degraded">降级模式</a-select-option>
                  </a-select>
                </div>
              </div>
            </div>
          </div>

          <!-- 传感器模拟 + 故障注入 -->
          <div class="sim-row sim-row--2col">
            <!-- 传感器模拟 -->
            <div class="sim-card">
              <span class="sim-card-title">传感器模拟</span>
              <div class="sim-sensor-list">
                <div v-for="s in sim.sensors" :key="s.key" class="sim-sensor-item">
                  <div class="sim-sensor-left">
                    <a-switch v-model:checked="s.enabled" size="small" />
                    <span class="sim-sensor-name" :class="{ 'is-off': !s.enabled }">{{ s.name }}</span>
                  </div>
                  <div v-if="s.enabled && s.noise !== undefined" class="sim-sensor-right">
                    <span class="sim-sensor-noise-label">噪声</span>
                    <a-slider v-model:value="s.noise" :min="0" :max="100" :step="5" class="sim-slider sim-slider--sm" />
                    <span class="sim-sensor-noise-val jc-mono">{{ s.noise }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 故障注入 -->
            <div class="sim-card">
              <div class="sim-card-header">
                <span class="sim-card-title">故障注入</span>
                <span class="sim-fault-count" :class="{ 'is-active': activeFaultCount > 0 }">
                  {{ activeFaultCount }} 项激活
                </span>
              </div>
              <div class="sim-fault-list">
                <div v-for="f in sim.faults" :key="f.key" class="sim-fault-item">
                  <a-switch v-model:checked="f.active" size="small" />
                  <span class="sim-fault-name" :class="{ 'is-active': f.active }">{{ f.name }}</span>
                  <span class="sim-fault-desc">{{ f.desc }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 通信模拟 + 操作按钮 -->
          <div class="sim-row sim-row--2col">
            <div class="sim-card">
              <span class="sim-card-title">通信模拟</span>
              <div class="sim-form">
                <div class="sim-field">
                  <span class="sim-field-label">网络延迟</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.network.latency" :min="0" :max="500" :step="5" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.network.latency }}ms</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">丢包率</span>
                  <div class="sim-slider-row">
                    <a-slider v-model:value="sim.network.packetLoss" :min="0" :max="50" class="sim-slider" />
                    <span class="sim-slider-val jc-mono">{{ sim.network.packetLoss }}%</span>
                  </div>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">信号强度</span>
                  <a-select v-model:value="sim.network.signalStrength" class="sim-select">
                    <a-select-option value="strong">强 (-50dBm)</a-select-option>
                    <a-select-option value="medium">中 (-70dBm)</a-select-option>
                    <a-select-option value="weak">弱 (-85dBm)</a-select-option>
                    <a-select-option value="lost">断连</a-select-option>
                  </a-select>
                </div>
                <div class="sim-field">
                  <span class="sim-field-label">V2X 通信</span>
                  <a-switch v-model:checked="sim.network.v2xEnabled" size="small" />
                </div>
              </div>
            </div>

            <!-- 操作 -->
            <div class="sim-card sim-actions-card">
              <span class="sim-card-title">仿真控制</span>
              <div class="sim-actions">
                <a-button type="primary" class="sim-action-btn sim-action-btn--start" :loading="sim.running" @click="handleSimAction('start')">
                  <template #icon><CaretRightOutlined /></template>
                  {{ sim.running ? '运行中...' : '启动仿真' }}
                </a-button>
                <a-button class="sim-action-btn" :disabled="!sim.running" @click="handleSimAction('pause')">
                  <template #icon><PauseOutlined /></template>
                  暂停
                </a-button>
                <a-button class="sim-action-btn" :disabled="!sim.running" danger @click="handleSimAction('stop')">
                  <template #icon><StopOutlined /></template>
                  停止
                </a-button>
                <a-button class="sim-action-btn" @click="handleSimAction('reset')">
                  <template #icon><ReloadOutlined /></template>
                  重置参数
                </a-button>
                <a-button class="sim-action-btn" @click="handleSimAction('save')">
                  <template #icon><SaveOutlined /></template>
                  保存方案
                </a-button>
              </div>
              <div v-if="sim.running" class="sim-running-info">
                <span class="sim-running-dot" />
                <span>仿真运行中 — 场景: {{ activeSceneName }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </main>
  </div>
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  SettingOutlined,
  CheckCircleFilled,
  SearchOutlined,
  VideoCameraOutlined,
  CaretRightOutlined,
  PauseOutlined,
  StopOutlined,
  SaveOutlined,
  CloudOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  AlertOutlined,
  ExperimentOutlined,
  ScheduleOutlined,
  ControlOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
  RobotOutlined,
  ApiOutlined,
  PoweroffOutlined,
  DashboardOutlined,
  WifiOutlined,
} from '@ant-design/icons-vue'
import { queryVehicles } from '../../api/parallel-driving'

const route = useRoute()
const router = useRouter()
const selectedVehicle = ref<string | undefined>(undefined)
const vehicleLoading = ref(false)
const showSettings = ref(false)
const searchText = ref('')
const activeTab = ref('nodeControl')

const vehicleList = ref<Array<{ id: string; name: string }>>([])

const fetchVehicles = async (keyword?: string) => {
  vehicleLoading.value = true
  try {
    const params: any = {
      pageSize: 100,
      pageIndex: 0,
      sorts: [{ name: 'createTime', order: 'desc' }],
    }
    if (keyword) {
      params.terms = [{ terms: [{ column: 'name', termType: 'like', value: `%${keyword}%` }] }]
    }
    const resp = await queryVehicles(params)
    if (resp.success && resp.result?.data) {
      vehicleList.value = resp.result.data.map((item: any) => ({
        id: item.deviceId || item.id,
        name: item.name || item.deviceId || item.id,
      }))
    }
  } finally {
    vehicleLoading.value = false
  }
}

const navTabs = [
  { key: 'nodeControl', label: '节点控制', icon: VideoCameraOutlined },
  { key: 'jobConfig', label: '作业功能配置', icon: SettingOutlined },
  { key: 'powerMgmt', label: '电源管理', icon: ApiOutlined },
  // { key: 'batteryMgmt', label: '电池管理', icon: ThunderboltOutlined },
  { key: 'simulation', label: '仿真设置', icon: ExperimentOutlined },
]


interface PncLog {
  id: string
  name: string
  statusText: string
  ok: boolean
  desc: string
  time: string
}

// ── 车辆作业指标（WDS API）──
interface VehicleMetrics {
  vehicleNo: string
  internalCode: string
  status: string
  assignedLoadPoints: string
  currentLoadPoint: string
  assignedUnloadPoints: string
}

const vehicleMetrics = reactive<VehicleMetrics>({
  vehicleNo: '--',
  internalCode: '--',
  status: '--',
  assignedLoadPoints: '--',
  currentLoadPoint: '--',
  assignedUnloadPoints: '--',
})
const metricsLoading = ref(false)

const WDS_BASE = '/wds-api'
const WDS_API_URL = `${WDS_BASE}/api/metrics/vehicles`
const WDS_APP_KEY = 'RemoteControl'
const WDS_APP_SECRET = 'WaDFr3UfYertP8RFmQQB'
const WDS_DEFAULT_VEHICLE_NO = '粤QWL001'

const statusMap: Record<string, string> = {
  LOADING: '装载中',
  UNLOADING: '卸载中',
  IDLE: '空闲',
  RUNNING: '行驶中',
  PAUSED: '暂停',
  ERROR: '异常',
}

const metricsStatusLabel = computed(() => statusMap[vehicleMetrics.status] || vehicleMetrics.status)
const metricsStatusClass = computed(() => {
  const s = vehicleMetrics.status
  if (s === 'LOADING' || s === 'UNLOADING' || s === 'RUNNING') return 'is-green'
  if (s === 'ERROR') return 'is-red'
  if (s === 'PAUSED') return 'is-yellow'
  return 'is-gray'
})

const formatLoadPoint = (raw: string) => {
  if (!raw || raw === '--') return '--'
  return raw.split(',').map(p => {
    const parts = p.trim().split('-')
    if (parts.length === 3) return `${parts[0]}号门${parts[1]}跨${parts[2] === 'R' ? '右' : '左'}道`
    return p
  }).join('、')
}

const fetchVehicleMetrics = async (vehicleNo?: string) => {
  metricsLoading.value = true
  try {
    const resp = await fetch(WDS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-App-Key': WDS_APP_KEY,
        'x-App-Secret': WDS_APP_SECRET,
      },
      body: JSON.stringify({ vehicleNo: vehicleNo || WDS_DEFAULT_VEHICLE_NO }),
    })
    const json = await resp.json()
    if (json.code === 200 && json.data?.length > 0) {
      const d = json.data[0]
      vehicleMetrics.vehicleNo = d.vehicleNo || '--'
      vehicleMetrics.internalCode = d.internalCode || '--'
      vehicleMetrics.status = d.status || '--'
      vehicleMetrics.assignedLoadPoints = d.assignedLoadPoints || '--'
      vehicleMetrics.currentLoadPoint = d.currentLoadPoint || '--'
      vehicleMetrics.assignedUnloadPoints = d.assignedUnloadPoints || '--'
    }
  } catch (e: any) {
    console.warn('[job-config] fetchVehicleMetrics failed:', e?.message)
  } finally {
    metricsLoading.value = false
  }
}

// ── 位置点列表（WDS loading-points API）──
const WDS_POINTS_URL = `${WDS_BASE}/loading-points/by-type`
const WDS_MOVE_URL = `${WDS_BASE}/api/autonomous-driving/move-by-vin`
const WDS_DEFAULT_VIN = 'L584C4VC5SD001331'

interface LoadingPoint {
  pointCode: string
  pointName: string
  pointType: string
  pointTypeDesc: string
  status: string
  statusDesc: string
}

const allPoints = ref<LoadingPoint[]>([])
const pointsLoading = ref(false)
const selectedPointCode = ref<string | undefined>(undefined)
const moveLoading = ref(false)

const pointGroups = computed(() => {
  const map = new Map<string, { typeDesc: string; type: string; items: LoadingPoint[] }>()
  for (const p of allPoints.value) {
    if (!map.has(p.pointType)) {
      map.set(p.pointType, { typeDesc: p.pointTypeDesc, type: p.pointType, items: [] })
    }
    map.get(p.pointType)!.items.push(p)
  }
  return Array.from(map.values())
})

const selectedPoint = computed(() =>
  allPoints.value.find(p => p.pointCode === selectedPointCode.value)
)
const isChargingPoint = computed(() => selectedPoint.value?.pointType === 'CHARGING')

const fetchLoadingPoints = async () => {
  pointsLoading.value = true
  try {
    const resp = await fetch(WDS_POINTS_URL, {
      method: 'GET',
      headers: { 'x-App-Key': WDS_APP_KEY, 'x-App-Secret': WDS_APP_SECRET },
    })
    const json = await resp.json()
    if (json.code === 200 && Array.isArray(json.data)) {
      allPoints.value = json.data.filter((p: any) => p.isEnabled)
    }
  } catch (e: any) {
    console.warn('[job-config] fetchLoadingPoints failed:', e?.message)
  } finally {
    pointsLoading.value = false
  }
}

const handleMoveToPoint = async () => {
  if (!selectedPointCode.value) {
    message.warning('请先选择目标点')
    return
  }
  moveLoading.value = true
  try {
    const resp = await fetch(WDS_MOVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-App-Key': WDS_APP_KEY,
        'x-App-Secret': WDS_APP_SECRET,
      },
      body: JSON.stringify({
        vin: WDS_DEFAULT_VIN,
        targetPointCode: selectedPointCode.value,
      }),
    })
    const json = await resp.json()
    if (json.code === 200 && json.data?.success) {
      message.success(`指令发送成功 → ${selectedPoint.value?.pointName || selectedPointCode.value}`)
    } else {
      message.error(`指令失败: ${json.msg || json.data?.message || '未知错误'}`)
    }
  } catch (e: any) {
    message.error(`请求异常: ${e?.message}`)
  } finally {
    moveLoading.value = false
  }
}

const form = reactive({
  commandSource: 'dispatch',
  commandType: '入库-转运',
  startTime: '13:41:59',
  cargoSlot: '库位',
  targetWarehouse: '黑皮库',
  storageSlot: 'HP-01',
  batchNo: 'BP20260325001',
  sizeSpec: '20',
  field: '库',
  ignoreDevice: 0,
  inventoryCount: 0,
  parkingSlot: 'R0_5',
  alignmentThreshold: 15,
  driveSide: 'warehouse',
  routeIndex: 3,
  targetPoint: 'WH-A01',
  loadSize: 40,
  jobStatus: '运行中',
  headlightStatus: '开启',
})

// ── PNC 实时状态 ──
type PNCManagerState = 'IDLE' | 'TASK_RECEIVED' | 'GLOBAL_PLANNING' | 'GLOBAL_PLANNED' | 'LOCAL_EXECUTING' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'PAUSED' | 'RECOVERING' | 'EMERGENCY_STOP'
type PNCTaskType = 'NAVIGATION' | 'LOADING' | 'UNLOADING' | 'PARKING' | 'CHARGING' | 'WAITING' | 'REVERSE' | '--'
type LocalPlannerState = 'IDLE' | 'EXECUTING' | 'EMERGENCY_STOP' | 'COMPLETED' | 'FAILED'

const pncState = reactive({
  manager: 'IDLE' as PNCManagerState,
  localPlanner: 'IDLE' as LocalPlannerState,
  taskType: '--' as PNCTaskType,
  taskId: '' as string,
  optMode: 'Default' as string,
  goalName: '' as string,
  gateName: '' as string,
  side: '' as string,
  logs: [
    { id: '1', name: 'DOCK_PARK', statusText: '成功', ok: true, desc: '完成停车', time: '13:56:12' },
    { id: '2', name: 'DEAD_LOCK_PAI', statusText: '中断', ok: false, desc: '等待让行', time: '13:56:11' },
    { id: '3', name: 'NAV_START', statusText: '成功', ok: true, desc: '导航任务启动', time: '13:55:48' },
    { id: '4', name: 'GLOBAL_PLAN', statusText: '成功', ok: true, desc: '全局规划完成 (3段)', time: '13:55:47' },
    { id: '5', name: 'TASK_RECEIVED', statusText: '成功', ok: true, desc: 'LOADING → 2-3-R', time: '13:55:46' },
  ] as PncLog[],
})

const PNC_MANAGER_STATE_MAP: Record<PNCManagerState, string> = {
  IDLE: 'idle', TASK_RECEIVED: 'info', GLOBAL_PLANNING: 'info',
  GLOBAL_PLANNED: 'info', LOCAL_EXECUTING: 'active', TASK_COMPLETED: 'ok',
  TASK_FAILED: 'error', PAUSED: 'warn', RECOVERING: 'warn', EMERGENCY_STOP: 'error',
}
const PNC_PLANNER_STATE_MAP: Record<LocalPlannerState, string> = {
  IDLE: 'idle', EXECUTING: 'active', EMERGENCY_STOP: 'error', COMPLETED: 'ok', FAILED: 'error',
}
const PNC_TASK_TYPE_LABELS: Record<string, string> = {
  NAVIGATION: '导航', LOADING: '装载', UNLOADING: '卸载',
  PARKING: '停车', CHARGING: '充电', WAITING: '等待', REVERSE: '倒车', '--': '--',
}

const pncManagerStateClass = computed(() => PNC_MANAGER_STATE_MAP[pncState.manager] || 'idle')
const pncPlannerStateClass = computed(() => PNC_PLANNER_STATE_MAP[pncState.localPlanner] || 'idle')
const pncTaskTypeLabel = computed(() => PNC_TASK_TYPE_LABELS[pncState.taskType] || pncState.taskType)

const pncPipeStep = computed(() => {
  const s = pncState.manager
  if (s === 'IDLE') return 0
  if (s === 'TASK_RECEIVED') return 1
  if (s === 'GLOBAL_PLANNING' || s === 'GLOBAL_PLANNED') return 2
  if (s === 'LOCAL_EXECUTING' || s === 'PAUSED' || s === 'RECOVERING') return 3
  if (s === 'TASK_COMPLETED') return 4
  if (s === 'TASK_FAILED' || s === 'EMERGENCY_STOP') return 4
  return 0
})

const commandGroups = [
  {
    title: '指令控制',
    items: [
      { key: 'dispatchCmd', label: '调度指令重发' },
      { key: 'cloudCmd', label: '云控指令重发' },
      { key: 'cancelTask', label: '取消任务', variant: 'danger' },
      { key: 'backendCmd', label: '后端指令' },
    ],
  },
  {
    title: '行车操作',
    items: [
      { key: 'replan', label: '重新规划' },
      { key: 'realign', label: '重新对位' },
      { key: 'vehicleStart', label: '车辆起步' },
      { key: 'laneLeft', label: '向左变道' },
      { key: 'laneRight', label: '向右变道' },
      { key: 'turnFace', label: '调转朝向' },
    ],
  },
  {
    title: '安全制动',
    items: [
      { key: 'emergencyBrake', label: '紧急制动', variant: 'danger' },
      { key: 'slowBrake', label: '缓慢制动', variant: 'warn' },
      { key: 'vehicleLock', label: '车辆锁定' },
      { key: 'vehicleRelease', label: '车辆解锁' },
    ],
  },
  {
    title: '作业辅助',
    items: [
      { key: 'forkliftLoad', label: '天车装载' },
      { key: 'manualHook', label: '手动上档' },
      { key: 'horn', label: '喇叭提醒' },
      { key: 'ignoreObstacle', label: '忽略前方障碍' },
      { key: 'ignoreMonitor', label: '忽略设备监控' },
      { key: 'ignoreDeadlock', label: '忽略死锁让行' },
    ],
  },
  {
    title: '系统设置',
    items: [
      { key: 'sleep', label: '休眠' },
      { key: 'shield', label: '唤醒' },
      { key: 'chassisReset', label: '底盘重置' },
      { key: 'parkZone', label: '停车区配置' },
      { key: 'prodReset', label: '产量重置' },
      { key: 'freqLimit', label: '调频调限' },
      { key: 'dataLimit', label: '数据制限' },
    ],
  },
]

const cameras = computed(() =>
  vehicleList.value.map(v => ({
    id: v.id,
    name: v.name,
    selected: v.id === selectedVehicle.value,
  }))
)

const selectedVehicleName = computed(() => {
  if (!selectedVehicle.value) return ''
  return vehicleList.value.find(v => v.id === selectedVehicle.value)?.name ?? ''
})

const sourceLabel = computed(() => {
  const map: Record<string, string> = { dispatch: '调度中心', cloud: '云端', manual: '手动' }
  return map[form.commandSource] || form.commandSource
})
// sourceLabel kept for jobConfig tab usage

const jobStatusClass = computed(() => form.jobStatus === '运行中' ? 'is-green' : 'is-gray')
const headlightClass = computed(() => form.headlightStatus === '开启' ? 'is-green' : 'is-gray')

let searchTimer: ReturnType<typeof setTimeout> | null = null
const handleVehicleSearch = (val: string) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchVehicles(val || undefined), 300)
}
const handleVehicleChange = (_val: string | undefined) => { /* future: load vehicle config */ }

const handleCameraClick = (vehicleId: string) => {
  selectedVehicle.value = vehicleId
}

const jcPageRef = ref<HTMLElement | null>(null)
const getJcPopupContainer = (triggerNode: HTMLElement) =>
  jcPageRef.value || triggerNode.parentElement || document.body

const handleReset = () => {
  message.info('配置已刷新')
}

const handleCommand = (key: string) => {
  message.info(`指令已发送: ${key}`)
}

// ═══════════ 电源管理 ═══════════
interface PowerRail {
  name: string
  on: boolean
  voltage: number
  current: number
}
interface CommLink {
  name: string
  ok: boolean
  latency?: number
  signal?: number
}
interface PowerAlert {
  id: string
  level: 'warn' | 'error'
  message: string
  time: string
}

const powerSys = reactive({
  hvActive: true,
  hvContactor: true,
  prechargeState: 'done' as 'idle' | 'charging' | 'done' | 'fault',
  hvInterlock: true,
  insulationR: 520,

  dcdcActive: true,
  dcdcOutputV: 27.2,
  dcdcOutputA: 18.5,
  auxBatteryV: 26.8,
  kl15: true,

  rails: [
    { name: '域控主板 (Orin)', on: true, voltage: 12.1, current: 8.2 },
    { name: '激光雷达', on: true, voltage: 12.0, current: 3.5 },
    { name: '前摄像头', on: true, voltage: 12.1, current: 1.2 },
    { name: '后摄像头', on: true, voltage: 12.0, current: 1.1 },
    { name: '左摄像头', on: true, voltage: 12.1, current: 1.0 },
    { name: '右摄像头', on: true, voltage: 12.0, current: 1.1 },
    { name: '毫米波雷达', on: true, voltage: 12.0, current: 2.3 },
    { name: 'IMU/GNSS', on: true, voltage: 5.0, current: 0.8 },
    { name: '4G/5G 模块', on: true, voltage: 5.1, current: 1.5 },
    { name: 'V2X 模块', on: false, voltage: 0, current: 0 },
    { name: 'CAN 网关', on: true, voltage: 12.0, current: 0.6 },
    { name: 'EPS 电控助力', on: true, voltage: 12.1, current: 5.2 },
  ] as PowerRail[],

  commLinks: [
    { name: '4G/5G 上行', ok: true, latency: 28, signal: -68 },
    { name: 'V2X 通信', ok: false },
    { name: 'CAN 总线', ok: true, latency: 2 },
    { name: '域控 → 云端 WS', ok: true, latency: 35 },
  ] as CommLink[],

  alerts: [
    { id: '1', level: 'warn', message: 'V2X 模块未上电', time: '14:15:33' },
  ] as PowerAlert[],
})

const prechargeLabel = computed(() => {
  const m: Record<string, string> = { idle: '未预充', charging: '预充中', done: '预充完成', fault: '预充故障' }
  return m[powerSys.prechargeState] || '--'
})
const prechargeClass = computed(() => {
  const m: Record<string, string> = { idle: 'is-off', charging: 'is-warn', done: 'is-on', fault: 'is-error' }
  return m[powerSys.prechargeState] || ''
})

const powerDistribution = computed(() => {
  const items = [
    { name: '域控平台', power: Math.round(powerSys.rails[0].voltage * powerSys.rails[0].current), color: '#5b8cff' },
    { name: '感知传感器', power: Math.round(powerSys.rails.slice(1, 7).reduce((s, r) => s + r.voltage * r.current, 0)), color: '#22c55e' },
    { name: '通信模块', power: Math.round(powerSys.rails.slice(7, 10).reduce((s, r) => s + r.voltage * r.current, 0)), color: '#a78bfa' },
    { name: '底盘执行器', power: Math.round(powerSys.rails.slice(10).reduce((s, r) => s + r.voltage * r.current, 0)), color: '#f59e0b' },
  ]
  const maxP = Math.max(...items.map(i => i.power), 1)
  return items.map(i => ({ ...i, percent: Math.round((i.power / maxP) * 100) }))
})

// ═══════════ 电池管理 (BMS) ═══════════
const generateCells = (count: number): number[] => {
  const base = 3.32
  return Array.from({ length: count }, () => base + Math.random() * 0.06 - 0.01)
}

interface BmsAlert {
  id: string
  level: 'warn' | 'error'
  message: string
  time: string
}

const bms = reactive({
  soc: 72,
  soh: 94,
  voltage: 614.2,
  ratedVoltage: 650,
  current: -85.3,
  tempMin: 24,
  tempAvg: 28,
  tempMax: 33,
  rangeKm: 138,
  consumptionPer100km: 128,
  ratedCapacity: 282,
  availableCapacity: 265.1,
  insulationResistance: 520,
  coolingActive: true,
  balancing: false,
  chargeState: 'idle' as 'idle' | 'charging' | 'full',
  chargeMode: '直流快充',
  chargePower: 0,
  chargedKwh: 0,
  chargeEta: '--:--',
  totalChargeCycles: 847,
  totalChargedKwh: 198450,
  cells: generateCells(96),
  alerts: [
    { id: '1', level: 'warn', message: '#38 电芯温度偏高 (36°C)', time: '14:22:05' },
  ] as BmsAlert[],
})

const socColor = computed(() => {
  if (bms.soc > 60) return '#22c55e'
  if (bms.soc > 20) return '#eab308'
  return '#ef4444'
})

const sohColor = computed(() => {
  if (bms.soh > 80) return '#22c55e'
  if (bms.soh > 60) return '#eab308'
  return '#ef4444'
})

const cellMax = computed(() => Math.max(...bms.cells))
const cellMin = computed(() => Math.min(...bms.cells))
const cellDiff = computed(() => cellMax.value - cellMin.value)

const cellClass = (voltage: number) => {
  if (voltage < 3.0 || voltage > 3.45) return 'is-error'
  if (voltage < 3.15 || voltage > 3.40) return 'is-warn'
  return 'is-ok'
}

const chargeStateLabel = computed(() => {
  const map: Record<string, string> = { idle: '未充电', charging: '充电中', full: '已充满' }
  return map[bms.chargeState] || '--'
})

// ═══════════ 作业功能配置 ═══════════
const jobCfgSaving = ref(false)

const featureToggles = [
  { key: 'headControl', label: '四方车头管控' },
  { key: 'cloudCommand', label: '云端指令接受' },
  { key: 'pathDefault', label: '路径默认位' },
  { key: 'obstacleDetect', label: '障碍物检测' },
  { key: 'pathReport', label: '路径上报' },
  { key: 'parkZone', label: '停车区域停车' },
  { key: 'parkDistance', label: '停车区域距离控制' },
]

const takeoverOptions = [
  { value: 'obstacle', label: '障碍物' },
  { value: 'timeout', label: '超时' },
  { value: 'commLost', label: '通信丢失' },
  { value: 'deviation', label: '路径偏离' },
]

const jobCfg = reactive({
  commandSource: 'dispatch',
  defaultTarget: 'heipiku',
  lane: 20,
  parkingSlot: 'R0_5',
  parkingPosition: '',
  pathMode: 'follow',
  pathId: '',
  alignThreshold: 15,
  maxSpeed: 25,
  obstacleDistance: 5,
  parkDistThreshold: 1.5,
  emergencyBrakeThreshold: 30,
  headlightEnabled: true,
  features: {
    headControl: true,
    cloudCommand: true,
    pathDefault: true,
    obstacleDetect: true,
    pathReport: true,
    parkZone: true,
    parkDistance: false,
  } as Record<string, boolean>,
  pncMode: 'auto',
  optMode: 'Default',
  takeoverMap: {
    obstacle: true,
    timeout: false,
    commLost: true,
    deviation: false,
  } as Record<string, boolean>,
  planningTimeout: 30,
  executionTimeout: 120,
  goalTolerance: 0.3,
  goalAngleTolerance: 5.0,
  stoppingVelocityTolerance: 0.05,
  deadlockTimeout: 60,
  recoveryStrategy: 'reroute',
  loopRate: 10,
  gkJumpThreshold: 10,
  gkLossTimeout: 3.0,
  gkAnomalyThreshold: 5,
})

const handleJobCfgReset = () => {
  jobCfg.commandSource = 'dispatch'
  jobCfg.defaultTarget = 'heipiku'
  jobCfg.lane = 20
  jobCfg.maxSpeed = 25
  jobCfg.obstacleDistance = 5
  jobCfg.pncMode = 'auto'
  jobCfg.optMode = 'Default'
  jobCfg.recoveryStrategy = 'reroute'
  jobCfg.deadlockTimeout = 60
  jobCfg.planningTimeout = 30
  jobCfg.executionTimeout = 120
  jobCfg.goalTolerance = 0.3
  jobCfg.goalAngleTolerance = 5.0
  jobCfg.stoppingVelocityTolerance = 0.05
  jobCfg.loopRate = 10
  jobCfg.gkJumpThreshold = 10
  jobCfg.gkLossTimeout = 3.0
  jobCfg.gkAnomalyThreshold = 5
  Object.keys(jobCfg.features).forEach(k => (jobCfg.features[k] = true))
  jobCfg.features.parkDistance = false
  message.info('已重置为默认配置')
}

const handleJobCfgSave = async () => {
  jobCfgSaving.value = true
  try {
    await new Promise(r => setTimeout(r, 600))
    message.success('配置已保存')
  } finally {
    jobCfgSaving.value = false
  }
}

// ═══════════ 仿真设置 ═══════════
const sim = reactive({
  activeScene: 'warehouse_normal',
  scenes: [
    { id: 'warehouse_normal', name: '常规库区作业', desc: '标准入库/出库流程', icon: EnvironmentOutlined },
    { id: 'heavy_traffic', name: '高密度交通', desc: '多车交汇、会车场景', icon: AlertOutlined },
    { id: 'extreme_weather', name: '极端天气', desc: '暴雨/大雾/结冰路面', icon: CloudOutlined },
    { id: 'sensor_degrade', name: '传感器降级', desc: '部分传感器失效', icon: ExperimentOutlined },
    { id: 'emergency', name: '紧急制动测试', desc: '突发障碍物/行人', icon: ThunderboltOutlined },
  ],
  env: {
    weather: 'clear',
    timeOfDay: 'day',
    visibility: 1000,
    windSpeed: 3,
    roadCondition: 'dry',
    temperature: 25,
  },
  vehicle: {
    loadTon: 20,
    initSoc: 80,
    tireFriction: 75,
    maxSpeed: 25,
    brakeDelay: 150,
    steeringMode: 'normal',
  },
  sensors: [
    { key: 'lidar_front', name: '前向激光雷达', enabled: true, noise: 5 },
    { key: 'lidar_rear', name: '后向激光雷达', enabled: true, noise: 5 },
    { key: 'camera_front', name: '前视摄像头', enabled: true, noise: 10 },
    { key: 'camera_rear', name: '后视摄像头', enabled: true, noise: 10 },
    { key: 'camera_left', name: '左侧摄像头', enabled: true, noise: 10 },
    { key: 'camera_right', name: '右侧摄像头', enabled: true, noise: 10 },
    { key: 'radar', name: '毫米波雷达', enabled: true, noise: 8 },
    { key: 'gps_rtk', name: 'GPS/RTK 定位', enabled: true, noise: 3 },
    { key: 'imu', name: 'IMU 惯导', enabled: true, noise: 2 },
    { key: 'ultrasonic', name: '超声波传感器', enabled: true, noise: 15 },
  ],
  faults: [
    { key: 'lidar_fail', name: '激光雷达失效', desc: '前向 LiDAR 完全无数据', active: false },
    { key: 'camera_blur', name: '摄像头遮挡', desc: '前视镜头被污渍/雨水遮挡', active: false },
    { key: 'gps_drift', name: 'GPS 漂移', desc: '定位偏差 >2m', active: false },
    { key: 'brake_degrade', name: '制动降级', desc: '制动力下降 40%', active: false },
    { key: 'steering_lag', name: '转向延迟', desc: '转向响应延迟 500ms', active: false },
    { key: 'battery_drop', name: '电池骤降', desc: 'SOC 突降至 10%', active: false },
    { key: 'comm_lost', name: '通信中断', desc: '与云端失联 30s', active: false },
    { key: 'wheel_slip', name: '车轮打滑', desc: '驱动轮附着力不足', active: false },
  ],
  network: {
    latency: 20,
    packetLoss: 0,
    signalStrength: 'strong',
    v2xEnabled: true,
  },
  running: false,
})

const activeFaultCount = computed(() => sim.faults.filter(f => f.active).length)
const activeSceneName = computed(() => sim.scenes.find(s => s.id === sim.activeScene)?.name || '--')

const handleSimAction = (action: string) => {
  switch (action) {
    case 'start':
      sim.running = true
      message.success(`仿真已启动 — ${activeSceneName.value}`)
      break
    case 'pause':
      message.info('仿真已暂停')
      break
    case 'stop':
      sim.running = false
      message.info('仿真已停止')
      break
    case 'reset':
      sim.env = { weather: 'clear', timeOfDay: 'day', visibility: 1000, windSpeed: 3, roadCondition: 'dry', temperature: 25 }
      sim.vehicle = { loadTon: 20, initSoc: 80, tireFriction: 75, maxSpeed: 25, brakeDelay: 150, steeringMode: 'normal' }
      sim.network = { latency: 20, packetLoss: 0, signalStrength: 'strong', v2xEnabled: true }
      sim.faults.forEach(f => (f.active = false))
      sim.sensors.forEach(s => { s.enabled = true; if (s.noise !== undefined) s.noise = 5 })
      message.info('参数已重置')
      break
    case 'save':
      message.success('仿真方案已保存')
      break
    case 'loadScene':
      message.info(`已加载场景: ${activeSceneName.value}`)
      break
  }
}

const filterPointOption = (input: string, option: any) => {
  const label = (option?.label || '').toLowerCase()
  return label.includes(input.toLowerCase())
}

let metricsTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (route.query.layout !== 'false') {
    router.replace({ path: route.path, query: { ...route.query, layout: 'false' } })
    return
  }
  await Promise.all([fetchVehicles(), fetchVehicleMetrics(), fetchLoadingPoints()])
  const vid = route.query.vehicleId as string | undefined
  if (vid) selectedVehicle.value = vid
  metricsTimer = setInterval(() => fetchVehicleMetrics(), 5000)
})

onBeforeUnmount(() => {
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null }
})
</script>

<style scoped lang="less">
@bg-page:      #0a0c10;
@bg-panel:     #0f1118;
@bg-section:   rgba(255, 255, 255, 0.03);
@bg-hover:     rgba(255, 255, 255, 0.06);
@accent:       #5b8cff;
@accent-glow:  rgba(91, 140, 255, 0.15);
@green:        #22c55e;
@green-dim:    rgba(34, 197, 94, 0.2);
@red:          #ef4444;
@red-dim:      rgba(239, 68, 68, 0.15);
@orange:       #f59e0b;
@yellow:       #eab308;
@yellow-dim:   rgba(234, 179, 8, 0.15);
@text:         rgba(255, 255, 255, 0.88);
@text-dim:     rgba(255, 255, 255, 0.50);
@text-muted:   rgba(255, 255, 255, 0.32);
@border:       rgba(255, 255, 255, 0.06);
@border-light: rgba(255, 255, 255, 0.10);

.jc-mono { font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; }
.jc-text-ok   { color: @green !important; }
.jc-text-warn { color: @yellow !important; }

.jc-page {
  position: absolute;
  inset: 0;
  display: flex;
  background: @bg-page;
  color: @text;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}

/* ═══════════ 左侧面板 ═══════════ */
.jc-left {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: @bg-panel;
  border-right: 1px solid @border;
}

.jc-left-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid @border;
  flex-wrap: wrap;
}

.jc-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
}

.jc-brand-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: @accent;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}

.jc-brand-name {
  font-size: 13px;
  font-weight: 700;
  color: @text;
  letter-spacing: 1px;
}

.jc-vehicle-select { flex: 1; min-width: 100px; }

.jc-header-actions {
  display: flex;
  gap: 4px;
}

.jc-vehicle-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: fade(@accent, 8%);
  border-bottom: 1px solid @border;
}

.jc-vb-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: @green;
  box-shadow: 0 0 4px fade(@green, 50%);
}

.jc-vb-name {
  font-size: 12px;
  color: @text;
  font-weight: 500;
}

.jc-vb-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: fade(@green, 15%);
  color: @green;
  font-weight: 500;
}

.jc-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid @border;
  border-radius: 6px;
  background: transparent;
  color: @text-dim;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: @text;
    border-color: @border-light;
    background: @bg-hover;
  }
}

.jc-left-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
}

.jc-left-footer {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid @border;
}

/* ── Section ── */
.jc-section {
  padding: 10px 12px;
  border-bottom: 1px solid @border;
}

.jc-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: @text;
}

.jc-section-icon {
  font-size: 14px;
  color: @text-dim;
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: @text; }
}

/* ── Info Grid (definition list) ── */
.jc-info-dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}

.jc-dl-pair {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid fade(@border, 30%);
  dt {
    font-size: 11px;
    color: @text-muted;
    white-space: nowrap;
    flex-shrink: 0;
    min-width: 48px;
  }
  dd {
    font-size: 12px;
    color: @text;
    font-weight: 500;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &.jc-dl-full {
    grid-column: 1 / -1;
    dd { white-space: normal; line-height: 1.4; }
  }
}

.jc-info-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  flex-wrap: wrap;
}

.jc-info-label {
  font-size: 12px;
  color: @text-dim;
  white-space: nowrap;
  flex-shrink: 0;
}

.jc-info-value {
  font-size: 12px;
  color: @text;
  font-weight: 500;
}

/* ── Param Rows ── */
.jc-param-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  min-height: 30px;
}

.jc-param-label {
  font-size: 12px;
  color: @text-dim;
  white-space: nowrap;
  min-width: 60px;
  flex-shrink: 0;
}

.jc-param-select { width: 110px !important; }
.jc-param-select-grow { flex: 1; width: auto !important; }
.jc-param-select-sm { width: 65px !important; }
.jc-param-input { width: 70px !important; }

.jc-param-unit {
  font-size: 12px;
  color: @text-dim;
}

.jc-check-icon {
  color: @green;
  font-size: 16px;
}

/* ── Point Option in Select ── */
.jc-point-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.jc-point-code {
  color: @text-dim;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
}
.jc-point-status {
  margin-left: auto;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
}
.jc-point-status.is-idle { color: @green; }
.jc-point-status.is-busy { color: @orange; }

.jc-point-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 2px;
  font-size: 12px;
}
.jc-point-detail-name {
  color: @text;
  font-weight: 500;
}
.jc-point-detail-status {
  margin-left: auto;
  font-size: 11px;
}
.jc-point-detail-status.is-idle { color: @green; }
.jc-point-detail-status.is-busy { color: @orange; }

.jc-cmd-btn-charge {
  background: rgba(82, 196, 26, 0.12) !important;
  color: #52c41a !important;
  border-color: rgba(82, 196, 26, 0.3) !important;
  &:hover { background: rgba(82, 196, 26, 0.22) !important; }
}
.jc-cmd-btn-park {
  background: rgba(24, 144, 255, 0.12) !important;
  color: #1890ff !important;
  border-color: rgba(24, 144, 255, 0.3) !important;
  &:hover { background: rgba(24, 144, 255, 0.22) !important; }
}

/* ── Command Buttons Grid ── */
.jc-cmd-section {
  padding-top: 2px !important;
  padding-bottom: 4px !important;
}

.jc-cmd-group-title {
  font-size: 10px;
  font-weight: 600;
  color: @text-muted;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
  padding-left: 2px;
}

.jc-cmd-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.jc-cmd-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  color: @text-dim;
  background: @bg-section;
  border: 1px solid @border;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.15s;

  &:hover {
    color: @text;
    background: @bg-hover;
    border-color: @border-light;
  }

  &:active {
    transform: scale(0.97);
  }
}

.jc-cmd-btn--danger {
  color: #fca5a5;
  border-color: @red-dim;
  &:hover { background: @red-dim; color: #fef2f2; border-color: fade(@red, 40%); }
}

.jc-cmd-btn--warn {
  color: #fde68a;
  border-color: @yellow-dim;
  &:hover { background: @yellow-dim; color: #fefce8; border-color: fade(@yellow, 40%); }
}

.jc-cmd-btn-sm {
  height: 26px;
  padding: 0 10px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
}

.jc-cmd-btn-accent {
  color: @accent !important;
  border-color: fade(@accent, 30%) !important;
  &:hover { background: @accent-glow !important; }
}

/* ── Status Bar ── */
.jc-status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
}

.jc-status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.jc-status-label {
  font-size: 12px;
  color: @text-dim;
}

.jc-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 4px;
  vertical-align: middle;

  &.is-green {
    background: @green;
    box-shadow: 0 0 6px @green;
  }
  &.is-red {
    background: #ff4d4f;
    box-shadow: 0 0 6px #ff4d4f;
  }
  &.is-yellow {
    background: #faad14;
    box-shadow: 0 0 6px #faad14;
  }
  &.is-gray {
    background: rgba(255, 255, 255, 0.25);
  }
}

.jc-status-text {
  font-size: 12px;
  color: @text;
}

/* ── PNC ── */

/* 状态卡片组 */
.jc-pnc-states {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.jc-pnc-state-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 4px;
  border-radius: 6px;
  background: @bg-section;
  border: 1px solid @border;
}
.jc-pnc-state-label {
  font-size: 10px;
  color: @text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.jc-pnc-state-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 3px;
  white-space: nowrap;

  &.is-idle   { background: rgba(255,255,255,0.06); color: @text-dim; }
  &.is-info   { background: fade(@accent, 12%); color: @accent; }
  &.is-active { background: @green-dim; color: @green; animation: pnc-pulse 1.5s ease-in-out infinite; }
  &.is-ok     { background: @green-dim; color: @green; }
  &.is-warn   { background: @yellow-dim; color: @yellow; }
  &.is-error  { background: @red-dim; color: #ff6b6b; }
}
.jc-pnc-state-val {
  font-size: 11px;
  color: @text;
  font-weight: 500;
}

@keyframes pnc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Pipeline 进度条 */
.jc-pnc-pipeline {
  display: flex;
  align-items: center;
  margin: 8px 0;
  padding: 6px 0;
}
.jc-pnc-pipe-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;

  .jc-pipe-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.15);
    transition: all 0.3s;
  }
  .jc-pipe-text {
    font-size: 9px;
    color: @text-muted;
    white-space: nowrap;
  }

  &.active .jc-pipe-dot {
    background: @accent;
    border-color: @accent;
    box-shadow: 0 0 6px fade(@accent, 50%);
  }
  &.active .jc-pipe-text { color: @text; }

  &.done .jc-pipe-dot {
    background: @green;
    border-color: @green;
    box-shadow: 0 0 4px fade(@green, 40%);
  }
  &.done .jc-pipe-text { color: @green; }
}
.jc-pnc-pipe-line {
  flex: 1;
  height: 2px;
  background: rgba(255,255,255,0.1);
  margin: 0 2px;
  margin-bottom: 14px;
  transition: background 0.3s;

  &.active { background: @accent; }
}

/* 日志标题 & 滚动容器 */
.jc-pnc-logs-title {
  font-size: 11px;
  color: @text-dim;
  font-weight: 600;
  margin-bottom: 4px;
  letter-spacing: 0.3px;
}
.jc-pnc-logs-scroll {
  max-height: 140px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}
.jc-pnc-empty {
  font-size: 11px;
  color: @text-muted;
  text-align: center;
  padding: 12px 0;
}

/* 日志行 */
.jc-pnc-log {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 11px;
  border-top: 1px solid @border;

  &:first-of-type { margin-top: 2px; border-top: none; }
}

.jc-pnc-log-name {
  color: @text-dim;
  min-width: 90px;
  font-weight: 500;
}

.jc-pnc-log-status {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;

  &.is-ok   { background: @green-dim; color: @green; }
  &.is-warn { background: @yellow-dim; color: @yellow; }
}

.jc-pnc-log-desc {
  color: @text-dim;
  flex: 1;
}

.jc-pnc-log-time {
  color: @text-muted;
  font-size: 11px;
}

/* ═══════════ 右侧内容区 ═══════════ */
.jc-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Nav Tabs ── */
.jc-nav {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0;
  height: 40px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid @border;
}

.jc-nav-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 18px;
  height: 40px;
  font-size: 13px;
  font-weight: 500;
  color: @text-dim;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  position: relative;
  outline: none;

  &:hover { color: @text; }
  &:focus-visible { box-shadow: inset 0 -2px 0 fade(@accent, 40%); }

  &.is-active {
    color: @text;
    .jc-nav-tab-icon { color: @accent; }
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 14px;
      right: 14px;
      height: 2px;
      background: @accent;
      border-radius: 1px;
    }
  }
}

.jc-nav-tab-icon {
  font-size: 14px;
  transition: color 0.15s;
}

/* ── Video Grid ── */
.jc-video-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 6px;
  padding: 8px;
  overflow-y: auto;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
}

.jc-video-cell {
  position: relative;
  aspect-ratio: 16 / 10;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover { border-color: @border-light; }

  &.is-selected {
    border-color: @accent;
    box-shadow: 0 0 12px @accent-glow, inset 0 0 20px rgba(91, 140, 255, 0.06);
  }
}

.jc-video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0f1a 0%, #111827 100%);
}

.jc-video-camera-icon {
  font-size: 28px;
  color: rgba(255, 255, 255, 0.08);
}

.jc-video-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
}

.jc-video-id {
  font-size: 13px;
  font-weight: 600;
  color: @text;
}

.jc-video-selected-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 3px;
  background: fade(@accent, 20%);
  color: @accent;
  border: 1px solid fade(@accent, 35%);
}

.jc-video-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: @text-muted;
  font-size: 13px;
}

.jc-skeleton-cell {
  background: fade(#fff, 3%) !important;
  border-color: transparent !important;
}

.jc-skeleton-pulse {
  width: 100%;
  height: 100%;
  min-height: 120px;
  border-radius: 6px;
  background: linear-gradient(90deg, fade(#fff, 3%) 25%, fade(#fff, 7%) 50%, fade(#fff, 3%) 75%);
  background-size: 200% 100%;
  animation: jc-shimmer 1.5s ease-in-out infinite;
}

@keyframes jc-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ═══════════ 作业功能配置 ═══════════ */
.jcfg {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.jcfg-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 12px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
}

.jcfg-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: start;
}

.jcfg-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.jcfg-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 14px;
}

.jcfg-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: @text;
}

.jcfg-card-icon {
  font-size: 15px;
  color: @accent;
}

.jcfg-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.jcfg-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.jcfg-field--full { flex-direction: column; align-items: stretch; gap: 6px; }

.jcfg-label {
  font-size: 12px;
  color: @text-dim;
  min-width: 100px;
  flex-shrink: 0;
}

.jcfg-select { flex: 1 !important; }
.jcfg-input-num { width: 90px !important; }
.jcfg-input { flex: 1 !important; }

.jcfg-inline {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.jcfg-unit {
  font-size: 12px;
  color: @text-dim;
}

.jcfg-slider-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.jcfg-slider { flex: 1; }

.jcfg-slider-val {
  font-size: 13px;
  font-weight: 600;
  color: @accent;
  min-width: 65px;
  text-align: right;
}

/* 功能开关 */
.jcfg-toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.jcfg-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: @bg-section;
  border: 1px solid @border;
  border-radius: 6px;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: @bg-hover; border-color: @border-light; }
}

.jcfg-toggle-label {
  font-size: 12px;
  color: @text;
  font-weight: 500;
}

/* Checkbox 行 */
.jcfg-check-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 子字段行 (Gate Keeper 等) */
.jcfg-sub-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.jcfg-sub-field {
  display: flex;
  align-items: center;
  gap: 4px;
}
.jcfg-sub-label {
  font-size: 11px;
  color: @text-dim;
  white-space: nowrap;
}

/* 按钮 */
.jcfg-actions {
  display: flex;
  gap: 8px;
}

.jcfg-action-btn {
  flex: 1;
  height: 36px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.jcfg-action-btn--primary {
  background: @accent !important;
  border-color: @accent !important;
  box-shadow: 0 2px 8px fade(@accent, 25%) !important;
  &:hover { background: #7aa3ff !important; }
}

.jcfg-action-btn--ghost {
  background: @bg-section !important;
  border: 1px solid @border !important;
  color: @text-dim !important;
  &:hover { color: @text !important; border-color: @border-light !important; }
}

/* ═══════════ 电源管理 ═══════════ */
.pwr {
  height: 100%;
  overflow: hidden;
}
.pwr-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}

.pwr-section {
  background: rgba(255,255,255,0.03);
  border: 1px solid @border;
  border-radius: 10px;
  padding: 14px;
}
.pwr-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: @text;
  margin-bottom: 12px;
}
.pwr-section-icon {
  font-size: 14px;
  color: @accent;
}
.pwr-hv-indicator {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 10px;

  &.is-on {
    background: @green-dim;
    color: @green;
  }
  &.is-off {
    background: @red-dim;
    color: #ff6b6b;
  }
}

/* 卡片网格 */
.pwr-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.pwr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 8px;
  background: @bg-section;
  border: 1px solid @border;
}
.pwr-card--wide {
  grid-column: span 2;
  align-items: stretch;
}
.pwr-card-label {
  font-size: 11px;
  color: @text-dim;
}
.pwr-card-status {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 10px;
  border-radius: 4px;

  &.is-on  { background: @green-dim; color: @green; }
  &.is-off { background: rgba(255,255,255,0.06); color: @text-muted; }
  &.is-warn { background: @yellow-dim; color: @yellow; }
  &.is-error { background: @red-dim; color: #ff6b6b; }
}
.pwr-card-val {
  font-size: 16px;
  font-weight: 600;
  color: @text;

  &.is-warn { color: @yellow; }
}
.pwr-card-sub {
  font-size: 11px;
  color: @text-muted;
}

/* 供电回路矩阵 */
.pwr-rail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
}
.pwr-rail {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  background: @bg-section;
  border: 1px solid @border;
  transition: background 0.15s;

  &.is-on .pwr-rail-dot {
    background: @green;
    box-shadow: 0 0 6px fade(@green, 50%);
  }
  &.is-off {
    opacity: 0.55;
    .pwr-rail-dot {
      background: rgba(255,255,255,0.2);
    }
  }
}
.pwr-rail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pwr-rail-name {
  font-size: 12px;
  color: @text;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pwr-rail-info {
  font-size: 11px;
  color: @text-dim;
  white-space: nowrap;

  &.is-off { color: @text-muted; font-style: italic; }
}

/* 通信链路 */
.pwr-link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pwr-link-status {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 3px;

  &.is-on  { background: @green-dim; color: @green; }
  &.is-off { background: @red-dim; color: #ff6b6b; }
}
.pwr-link-detail {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.pwr-link-metric {
  font-size: 11px;
  color: @text-muted;
}

/* 功率分布条形图 */
.pwr-power-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pwr-power-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pwr-power-label {
  font-size: 12px;
  color: @text-dim;
  min-width: 80px;
  text-align: right;
}
.pwr-power-bar-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.pwr-power-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.pwr-power-val {
  font-size: 11px;
  color: @text;
  min-width: 50px;
}

/* 告警 */
.pwr-alert-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  background: @red-dim;
  color: #ff6b6b;
  padding: 1px 8px;
  border-radius: 8px;
}
.pwr-alert-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pwr-alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;

  &.is-warn {
    background: @yellow-dim;
    border: 1px solid fade(@yellow, 18%);
  }
  &.is-error {
    background: @red-dim;
    border: 1px solid fade(@red, 18%);
  }
}
.pwr-alert-level {
  font-weight: 600;
  font-size: 11px;
  min-width: 32px;

  .is-warn & { color: @yellow; }
  .is-error & { color: #ff6b6b; }
}
.pwr-alert-msg {
  flex: 1;
  color: @text;
}
.pwr-alert-time {
  color: @text-muted;
  font-size: 11px;
}

/* ═══════════ BMS 电池管理 ═══════════ */
@cyan: #06b6d4;

.bms {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.bms-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
}

/* ── 顶部指标卡片 ── */
.bms-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.bms-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bms-card-label {
  font-size: 11px;
  color: @text-dim;
  font-weight: 500;
}

.bms-card-sub {
  font-size: 10px;
  color: @text-muted;
}

/* SOC 仪表 */
.bms-card--soc { grid-row: span 1; }

.bms-gauge {
  position: relative;
  width: 80px;
  height: 80px;
}

.bms-gauge-svg {
  width: 100%;
  height: 100%;
}

.bms-gauge-inner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.bms-gauge-value {
  font-size: 22px;
  font-weight: 700;
  color: @text;
}

.bms-gauge-unit {
  font-size: 11px;
  color: @text-dim;
  margin-top: 6px;
}

/* 大数字指标 */
.bms-metric-big {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.bms-metric-val {
  font-size: 24px;
  font-weight: 700;
  color: @text;
  line-height: 1;

  &.is-charge   { color: @green; }
  &.is-discharge { color: @cyan; }
}

.bms-metric-unit {
  font-size: 12px;
  color: @text-dim;
  font-weight: 500;
}

.bms-metric-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 2px;
}

.bms-metric-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;
}

/* 温度 */
.bms-temp-row {
  display: flex;
  gap: 12px;
}

.bms-temp-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.bms-temp-label {
  font-size: 10px;
  color: @text-muted;
}

.bms-temp-val {
  font-size: 18px;
  font-weight: 700;
  color: @text;
}

.bms-temp-avg { color: @accent; }
.is-hot { color: @red !important; }

/* ── 中部区域 ── */
.bms-middle {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 10px;
}

/* 电芯矩阵 */
.bms-pack-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 12px;
}

.bms-pack-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.bms-pack-title {
  font-size: 13px;
  font-weight: 600;
  color: @text;
}

.bms-pack-legend {
  display: flex;
  gap: 12px;
}

.bms-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: @text-dim;
}

.bms-legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.bms-cell-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
  gap: 3px;
}

.bms-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  cursor: default;
  transition: transform 0.1s;

  &:hover { transform: scale(1.3); z-index: 1; }

  &.is-ok {
    background: fade(@green, 18%);
    color: @green;
    border: 1px solid fade(@green, 25%);
  }
  &.is-warn {
    background: fade(@yellow, 18%);
    color: @yellow;
    border: 1px solid fade(@yellow, 25%);
  }
  &.is-error {
    background: fade(@red, 18%);
    color: @red;
    border: 1px solid fade(@red, 25%);
  }
}

.bms-cell-idx { font-variant-numeric: tabular-nums; }

.bms-pack-stats {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid @border;
  font-size: 11px;
  color: @text-dim;

  b { color: @text; font-weight: 600; }
}

/* 右侧列 */
.bms-side-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 充电状态卡 */
.bms-charge-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 12px;
}

.bms-charge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.bms-charge-status {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;

  &.is-idle     { background: @bg-section; color: @text-dim; border: 1px solid @border; }
  &.is-charging { background: fade(@green, 15%); color: @green; border: 1px solid fade(@green, 30%); }
  &.is-full     { background: fade(@accent, 15%); color: @accent; border: 1px solid fade(@accent, 30%); }
}

.bms-charge-mode {
  font-size: 11px;
  color: @text-dim;
}

.bms-charge-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bms-charge-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.bms-charge-label { color: @text-dim; }
.bms-charge-val { color: @text; font-weight: 500; }

.bms-charge-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 4px;
}

.bms-charge-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, @green, @accent);
  border-radius: 2px;
  transition: width 0.6s ease;
}

.bms-charge-idle {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: @text-dim;

  b { color: @text; }
}

/* 电池参数卡 */
.bms-params-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 12px;
  flex: 1;
}

.bms-params-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: @text;
  margin-bottom: 8px;
}

.bms-params-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bms-params-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.bms-params-label { color: @text-dim; }
.bms-params-val { color: @text; font-weight: 500; }

/* ── 告警区 ── */
.bms-alerts-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 12px;
}

.bms-alerts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.bms-alerts-title {
  font-size: 13px;
  font-weight: 600;
  color: @text;
}

.bms-alerts-count {
  font-size: 11px;
  color: @text-dim;
  font-weight: 500;

  &.is-warn { color: @yellow; }
}

.bms-alerts-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bms-alert-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12px;

  &.is-warn  { background: fade(@yellow, 8%); border: 1px solid fade(@yellow, 15%); }
  &.is-error { background: fade(@red, 8%); border: 1px solid fade(@red, 15%); }
}

.bms-alert-level {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;

  .is-warn &  { background: fade(@yellow, 20%); color: @yellow; }
  .is-error & { background: fade(@red, 20%); color: @red; }
}

.bms-alert-msg {
  flex: 1;
  color: @text;
}

.bms-alert-time {
  color: @text-muted;
  font-size: 11px;
  flex-shrink: 0;
}

.bms-alerts-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 12px;
  color: @text-dim;
}

/* ═══════════ 仿真设置 ═══════════ */
.sim {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sim-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
}

.sim-row { display: flex; gap: 10px; }
.sim-row--2col > .sim-card { flex: 1; min-width: 0; }

.sim-card {
  background: @bg-panel;
  border: 1px solid @border;
  border-radius: 8px;
  padding: 12px;
}

.sim-card--wide { flex: 1; }

.sim-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sim-card-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: @text;
  margin-bottom: 10px;

  .sim-card-header > & { margin-bottom: 0; }
}

/* ── 场景选择 ── */
.sim-scene-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.sim-scene-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 8px;
  border: 1px solid @border;
  background: @bg-section;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;

  &:hover {
    border-color: @border-light;
    background: @bg-hover;
  }

  &.is-active {
    border-color: fade(@accent, 45%);
    background: fade(@accent, 8%);
    box-shadow: 0 0 10px fade(@accent, 10%);
  }
}

.sim-scene-icon {
  font-size: 22px;
  color: @text-dim;
  transition: color 0.15s;

  .is-active & { color: @accent; }
}

.sim-scene-name {
  font-size: 12px;
  font-weight: 600;
  color: @text;
}

.sim-scene-desc {
  font-size: 10px;
  color: @text-muted;
  line-height: 1.3;
}

/* ── 表单 ── */
.sim-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sim-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-field-label {
  font-size: 12px;
  color: @text-dim;
  min-width: 80px;
  flex-shrink: 0;
}

.sim-select { flex: 1 !important; }

.sim-slider-row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-slider { flex: 1; }

.sim-slider-val {
  font-size: 12px;
  font-weight: 500;
  color: @text;
  min-width: 55px;
  text-align: right;
}

.sim-slider--sm { max-width: 100px; }

/* ── 传感器列表 ── */
.sim-sensor-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sim-sensor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  background: @bg-section;
  border: 1px solid @border;
}

.sim-sensor-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sim-sensor-name {
  font-size: 12px;
  color: @text;
  font-weight: 500;

  &.is-off { color: @text-muted; text-decoration: line-through; }
}

.sim-sensor-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sim-sensor-noise-label {
  font-size: 10px;
  color: @text-muted;
}

.sim-sensor-noise-val {
  font-size: 11px;
  color: @text-dim;
  min-width: 30px;
  text-align: right;
}

/* ── 故障注入 ── */
.sim-fault-count {
  font-size: 11px;
  color: @text-muted;
  &.is-active { color: @red; font-weight: 600; }
}

.sim-fault-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sim-fault-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: @bg-section;
  border: 1px solid @border;
  transition: all 0.15s;
}

.sim-fault-name {
  font-size: 12px;
  color: @text-dim;
  font-weight: 500;
  min-width: 90px;

  &.is-active { color: @red; }
}

.sim-fault-desc {
  font-size: 11px;
  color: @text-muted;
  flex: 1;
}

/* ── 操作按钮 ── */
.sim-actions-card {
  display: flex;
  flex-direction: column;
}

.sim-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sim-action-btn {
  width: 100%;
  height: 34px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.sim-action-btn--start {
  background: @accent !important;
  border-color: @accent !important;
  &:hover { background: #7aa3ff !important; }
}

.sim-running-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: fade(@green, 8%);
  border: 1px solid fade(@green, 20%);
  font-size: 12px;
  color: @green;
}

.sim-running-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @green;
  box-shadow: 0 0 6px @green;
  animation: sim-pulse 1.5s ease-in-out infinite;
}

@keyframes sim-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

<!-- Non-scoped: Ant Design dark theme overrides -->
<style lang="less">
@jc-bg-input:        rgba(255, 255, 255, 0.055);
@jc-bg-input-hover:  rgba(255, 255, 255, 0.09);
@jc-bg-input-focus:  rgba(255, 255, 255, 0.07);
@jc-accent:          #5b8cff;
@jc-accent-hover:    #7aa3ff;
@jc-accent-glow:     rgba(91, 140, 255, 0.18);
@jc-green:           #22c55e;
@jc-text:            rgba(255, 255, 255, 0.90);
@jc-text-dim:        rgba(255, 255, 255, 0.52);
@jc-text-muted:      rgba(255, 255, 255, 0.30);
@jc-border:          rgba(255, 255, 255, 0.08);
@jc-border-hover:    rgba(255, 255, 255, 0.16);

.jc-page {

  /* ── Select ── */
  .ant-select-selector {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    border-radius: 6px !important;
    color: @jc-text !important;
    box-shadow: none !important;
    font-size: 13px !important;
  }

  .jc-left .ant-select-selector {
    height: 28px !important;
    min-height: 28px !important;
    border-radius: 4px !important;
    font-size: 12px !important;
  }

  .ant-select-selection-item {
    color: #fff !important;
    font-size: 13px !important;
  }
  .jc-left .ant-select-selection-item {
    line-height: 26px !important;
    font-size: 12px !important;
  }

  .ant-select-selection-placeholder { color: @jc-text-dim !important; }
  .ant-select-selection-search-input { color: #fff !important; }
  .ant-select-arrow { color: @jc-text-dim; }
  .ant-select-clear { color: @jc-text-dim; background: transparent; }

  .ant-select:hover .ant-select-selector,
  .ant-select-focused .ant-select-selector {
    border-color: fade(@jc-accent, 50%) !important;
    background: @jc-bg-input-focus !important;
  }

  /* ── Input ── */
  .ant-input {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    border-radius: 6px !important;
    color: @jc-text !important;
    font-size: 13px;

    &:hover { border-color: @jc-border-hover !important; }
    &:focus { border-color: fade(@jc-accent, 50%) !important; background: @jc-bg-input-focus !important; box-shadow: 0 0 0 2px @jc-accent-glow !important; }
    &::placeholder { color: @jc-text-dim !important; }
  }

  /* ── InputNumber ── */
  .ant-input-number {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    border-radius: 6px !important;
    color: @jc-text !important;
    font-size: 13px;
    width: 100%;

    &:hover { border-color: @jc-border-hover !important; }
    &:focus-within { border-color: fade(@jc-accent, 50%) !important; box-shadow: 0 0 0 2px @jc-accent-glow !important; }

    .ant-input-number-input { color: @jc-text !important; font-size: 13px; }
    .ant-input-number-handler-wrap { background: @jc-bg-input; border-left: 1px solid @jc-border; }
    .ant-input-number-handler { border-color: @jc-border; color: @jc-text-dim; &:hover { color: @jc-accent; } }
    .ant-input-number-group-addon { background: @jc-bg-input !important; border-color: @jc-border !important; color: @jc-text-dim !important; }
  }

  .jc-left .ant-input-number {
    height: 28px;
    border-radius: 4px !important;
    font-size: 12px;
    .ant-input-number-input { height: 26px; font-size: 12px; }
  }

  /* ── Switch ── */
  .ant-switch {
    background: rgba(255, 255, 255, 0.15) !important;
    min-width: 36px;

    &.ant-switch-checked {
      background: @jc-accent !important;
    }
  }

  /* ── Slider ── */
  .ant-slider {
    .ant-slider-rail { background: rgba(255, 255, 255, 0.10) !important; }
    .ant-slider-track { background: @jc-accent !important; }
    .ant-slider-handle {
      border-color: @jc-accent !important;
      background: #fff !important;
      &:hover, &:focus { box-shadow: 0 0 0 4px @jc-accent-glow !important; }
    }
    .ant-slider-dot { background: rgba(255, 255, 255, 0.12) !important; border-color: rgba(255, 255, 255, 0.12) !important; }
  }

  /* ── Checkbox ── */
  .ant-checkbox-wrapper {
    color: @jc-text !important;
    font-size: 12px;

    .ant-checkbox-inner {
      background: @jc-bg-input !important;
      border-color: @jc-border-hover !important;
      border-radius: 4px;
    }

    &:hover .ant-checkbox-inner {
      border-color: fade(@jc-accent, 50%) !important;
    }

    .ant-checkbox-checked .ant-checkbox-inner {
      background: @jc-accent !important;
      border-color: @jc-accent !important;
    }

    .ant-checkbox-checked::after {
      border-color: @jc-accent !important;
    }
  }

  /* ── Button (通用) ── */
  .ant-btn-default {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    color: @jc-text-dim !important;
    &:hover { color: @jc-text !important; border-color: @jc-border-hover !important; background: @jc-bg-input-hover !important; }
  }

  .ant-btn-dangerous {
    color: #ef4444 !important;
    border-color: fade(#ef4444, 30%) !important;
    &:hover { border-color: fade(#ef4444, 50%) !important; background: fade(#ef4444, 8%) !important; }
  }

  /* ── 左侧紧凑按钮 ── */
  .jc-cmd-btn-sm.ant-btn {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    color: @jc-text-dim !important;
    font-size: 11px !important;
    border-radius: 4px !important;
    &:hover { color: @jc-text !important; border-color: @jc-border-hover !important; background: @jc-bg-input-hover !important; }
  }

  /* ── 搜索框 ── */
  .jc-search-input.ant-input-affix-wrapper {
    background: @jc-bg-input !important;
    border: 1px solid @jc-border !important;
    border-radius: 6px !important;
    color: @jc-text !important;
    height: 32px;

    .ant-input { background: transparent !important; color: @jc-text !important; border: none !important; &::placeholder { color: @jc-text-dim !important; } }
    .ant-input-prefix { color: @jc-text-dim; }
    .ant-input-clear-icon { color: @jc-text-dim; }
  }

  .ant-empty-description { color: @jc-text-dim; }

  /* ── Dropdown 弹层（通过 getPopupContainer 挂在 .jc-page 内） ── */
  .ant-select-dropdown {
    background: #14161e !important;
    border: 1px solid @jc-border !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65) !important;
    padding: 4px !important;
  }
  .ant-select-item {
    color: @jc-text !important;
    border-radius: 5px !important;
    font-size: 13px !important;
    padding: 5px 10px !important;
    min-height: 30px;
    transition: background 0.15s ease;
  }
  .ant-select-item-option-active {
    background: @jc-bg-input-hover !important;
  }
  .ant-select-item-option-selected {
    background: fade(@jc-accent, 14%) !important;
    font-weight: 500;
  }
  .ant-select-item-option-grouped {
    padding-left: 16px !important;
  }
  .ant-select-item-group {
    color: @jc-text-muted !important;
    font-size: 11px !important;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 6px 10px 2px !important;
    min-height: unset;
  }
  .ant-select-item-empty {
    color: @jc-text-dim !important;
  }
}
</style>
