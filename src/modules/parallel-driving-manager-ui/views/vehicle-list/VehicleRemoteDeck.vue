<template>
  <div
    class="pd-vehicle-detail-root"
    :class="{ 'pd-vehicle-detail-root--remote-focus': isRemoteFocusEntry }"
  >
    <header v-if="isRemoteFocusEntry" class="pd-remote-focus-app-bar" role="banner">
      <div class="pd-remote-focus-app-bar__center">
        <div class="pd-remote-focus-app-bar__title-row">
          <h1 class="pd-remote-focus-app-bar__title">
            {{ vehicle?.deviceName || vehicle?.deviceId || $t('parallel-driving.vehicle-detail.title') }}
          </h1>
          <div class="pd-remote-focus-app-bar__tags">
            <a-tag v-if="vehicle" :color="getStateColor(vehicle.state?.value)">
              {{ vehicle.state?.text || vehicle.state?.value || '—' }}
            </a-tag>
          </div>
        </div>
      </div>
      <button
        type="button"
        class="pd-remote-focus-app-bar__exit"
        :aria-label="$t('parallel-driving.vehicle-detail.remote-focus-close')"
        @click="handleBack"
      >
        <CloseOutlined aria-hidden="true" />
      </button>
    </header>

    <j-page-container
      :pure="isRemoteFocusEntry"
      :showBack="!isRemoteFocusEntry"
      @back="handleBack"
    >
      <template v-if="!isRemoteFocusEntry" #title>
        <span>{{ vehicle?.deviceName || vehicle?.deviceId || $t('parallel-driving.vehicle-detail.title') }}</span>
        <a-tag v-if="vehicle" :color="getStateColor(vehicle.state?.value)" style="margin-left: 12px">
          {{ vehicle.state?.text || vehicle.state?.value || '-' }}
        </a-tag>
      </template>

    <a-spin :spinning="loading">
      <div v-if="vehicle" class="vehicle-detail">
        <!-- 基本信息（远控专属入口隐藏，仅占位视频 + 顶栏） -->
        <a-card
          v-if="!isRemoteFocusEntry"
          :title="$t('parallel-driving.vehicle-detail.basic-info')"
          :bordered="false"
          style="margin-bottom: 16px"
        >
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.device-id')">
              {{ vehicle.deviceId }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.device-name')">
              {{ vehicle.deviceName || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.internal-code')">
              {{ vehicle.internalCode || '—' }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.online-status')">
              <j-badge-status
                :status="vehicle.state?.value"
                :text="vehicle.state?.text"
                :statusNames="{ online: 'processing', offline: 'error', notActive: 'warning' }"
              />
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.session-state')">
              <a-tag :color="getSessionStateColor(vehicle.sessionState)">
                {{ getSessionStateText(vehicle.sessionState) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.bound-cockpit')">
              {{ vehicle.boundCockpitId || $t('parallel-driving.vehicle-list.no-bound-cockpit') }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <!-- 远控操作区 -->
        <div class="remote-control-wrapper">
        <a-card
          :title="isRemoteFocusEntry ? undefined : $t('parallel-driving.vehicle-detail.remote-control')"
          :bordered="false"
          style="margin-bottom: 16px"
          :class="{ 'remote-control-card-fs': remoteFocusFullscreenUi, 'pd-rc-card--remote-focus': isRemoteFocusEntry }"
        >
          <!-- 全屏仅包含 card-body 内容：表单 + 视频 -->
          <div
            ref="fullscreenRef"
            class="pd-vehicle-detail-fs fullscreen-target card-body-fullscreen-wrapper"
            :class="{
              'fs-layout-dark': remoteFocusFullscreenUi,
              'pd-remote-focus-shell': isRemoteFocusEntry,
              'pd-remote-focus-deck': isRemoteFocusEntry,
            }"
          >
          <div class="remote-control-form" style="margin-bottom: 16px">
            <span v-if="remoteFocusFullscreenUi" class="rc-brand">ZERON</span>
            <span v-if="remoteFocusFullscreenUi" class="rc-divider" />
            <!-- 车牌号 + 在线状态：合并到工具栏同一行 -->
            <div v-if="remoteFocusFullscreenUi && vehicle" class="rc-group rc-group-vehicle-id">
              <span class="rc-vehicle-name">{{ vehicle.deviceName || vehicle.deviceId }}</span>
              <j-badge-status
                :status="vehicle.state?.value"
                :text="vehicle.state?.text || vehicle.state?.value"
                :statusNames="{ online: 'processing', offline: 'error', notActive: 'warning' }"
                class="rc-vehicle-badge"
              />
            </div>
            <span v-if="remoteFocusFullscreenUi && vehicle" class="rc-divider" />
            <!-- 组 1：驾驶舱 -->
            <div class="rc-group rc-group-cockpit">
              <span class="rc-label">驾驶仓</span>
              <a-select
                v-model:value="selectedCockpitId"
                :placeholder="$t('parallel-driving.vehicle-list.select-cockpit')"
                :loading="cockpitLoading"
                :filter-option="false"
                show-search
                allow-clear
                class="rc-select"
                option-label-prop="label"
                :get-popup-container="cockpitSelectGetPopupContainer"
                @search="handleCockpitSearch"
              >
                <a-select-option
                  v-for="d in cockpitDevices"
                  :key="d.value"
                  :value="d.value"
                  :label="d.label"
                >
                  {{ d.label }}
                </a-select-option>
              </a-select>
            </div>

            <span class="rc-divider" />

            <!-- 组 2：视频方向 -->
            <div class="rc-group rc-group-video">
              <span class="rc-label">{{ $t('parallel-driving.vehicle-detail.video-directions') }}</span>
              <div class="rc-video-toggles">
                <a-checkbox-group v-model:value="selectedVideoDirections" class="rc-checkbox-group">
                  <a-checkbox value="front">{{ $t('parallel-driving.vehicle-detail.video-front') }}</a-checkbox>
                  <a-checkbox value="back">{{ $t('parallel-driving.vehicle-detail.video-back') }}</a-checkbox>
                  <a-checkbox value="left">{{ $t('parallel-driving.vehicle-detail.video-left') }}</a-checkbox>
                  <a-checkbox value="right">{{ $t('parallel-driving.vehicle-detail.video-right') }}</a-checkbox>
                  <a-checkbox value="right">{{ $t('parallel-driving.vehicle-detail.video-right') }}</a-checkbox>
                </a-checkbox-group>
                <!-- <a-checkbox
                  v-model:checked="showRearHitchCams"
                  class="rc-checkbox-hitch"
                  :title="$t('parallel-driving.vehicle-detail.rear-hitch-hint')"
                >
                  {{ $t('parallel-driving.vehicle-detail.rear-hitch-cameras') }}
                </a-checkbox> -->
                <!-- <span class="rc-aux-guide-inline">
                  <span class="rc-aux-guide-prefix">{{ $t('parallel-driving.vehicle-detail.aux-guides-label') }}</span>
                  <a-checkbox v-model:checked="showFrontAuxGuide" class="rc-checkbox-guide">{{
                    $t('parallel-driving.vehicle-detail.aux-guide-front')
                  }}</a-checkbox>
                  <a-checkbox v-model:checked="showSideAuxGuide" class="rc-checkbox-guide">{{
                    $t('parallel-driving.vehicle-detail.aux-guide-sides')
                  }}</a-checkbox>
                </span> -->
              </div>
            </div>

            <!-- 组 3：布局（远控工作台固定左中右，不提供切换） -->
            <template v-if="!isRemoteFocusEntry">
              <span class="rc-divider" />
              <div class="rc-group rc-group-layout">
                <span class="rc-label">布局</span>
                <a-radio-group v-model:value="layoutMode" size="small" class="rc-layout-radio">
                  <a-radio-button value="d">驾驶</a-radio-button>
                  <a-radio-button value="e">左中右</a-radio-button>
                  <a-radio-button value="a">2×2</a-radio-button>
                  <a-radio-button value="c">前全宽</a-radio-button>
                </a-radio-group>
              </div>
              <span class="rc-divider" />
            </template>
              <div class="rc-group rc-group-preflight">
              <!-- 驾驶模式选项：仅作为下发偏好，不同步底盘实际值；实际值单独显示 -->
              <div class="rc-preflight-row rc-preflight-row-drive">
                <span class="rc-preflight-name rc-preflight-drive-title">{{ $t('parallel-driving.vehicle-detail.preflight-drive') }}</span>
                <!-- 底盘当前实际驾驶模式 -->
                <span class="rc-pref-dm-cur">{{ (['M','A','R'] as const)[Number(vehicleStatus.drivemode)] ?? '--' }}</span>
                <!-- 分段按钮：高亮=上次发送的偏好，点击触发下发；不跟随底盘实际值 -->
                <a-radio-group
                  :value="uiDriveMode"
                  size="small"
                  class="rc-preflight-drive-radio"
                  @change="handleDriveModeChange"
                >
                  <a-radio-button :value="0">{{ $t('parallel-driving.vehicle-detail.preflight-dm-m') }}</a-radio-button>
                  <a-radio-button :value="1">{{ $t('parallel-driving.vehicle-detail.preflight-dm-a') }}</a-radio-button>
                  <a-radio-button
                    :value="2"
                    :disabled="false && !canSelectRemoteC"
                    :title="!canSelectRemoteC ? remoteCModeDisabledReason : undefined"
                  >
                    {{ $t('parallel-driving.vehicle-detail.preflight-dm-c') }}
                  </a-radio-button>
                </a-radio-group>
              </div>
              <!-- MRC 紧急停车：M/A/R 任意模式均可触发，紧挨驾驶模式 -->
              <div class="rc-group rc-group-mrc">
                <span class="rc-label">MRC</span>
                <a-radio-group
                  :value="mrcStatus"
                  size="small"
                  class="rc-mrc-radio"
                  @change="handleMrcChange"
                >
                  <a-radio-button :value="0">正常</a-radio-button>
                  <a-radio-button :value="1">MRC0</a-radio-button>
                  <a-radio-button :value="2">MRC1</a-radio-button>
                  <a-radio-button :value="3" disabled>MRC2</a-radio-button>
                </a-radio-group>

              </div>
              <!-- 远控预置：仅在远控模式(R/2)下显示 -->
              <template v-if="Number(uiDriveMode) === 2">
                <span class="rc-label">{{ $t('parallel-driving.vehicle-detail.remote-preflight') }}</span>
                <div class="rc-preflight-inner">
                  <div class="rc-preflight-row">
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-epb') }}</span>
                      <a-switch v-model:checked="remotePrefEpb" size="small" @change="(v: boolean) => handlePrefSwitchChange('EPB', v)" />
                    </span>
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-horn') }}</span>
                      <a-switch v-model:checked="remotePrefHorn" size="small" @change="(v: boolean) => handlePrefSwitchChange('HORN', v)" />
                    </span>
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-low') }}</span>
                      <a-switch v-model:checked="remotePrefLowBeam" size="small" @change="(v: boolean) => handlePrefSwitchChange('LOW_BEAM', v)" />
                    </span>
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-high') }}</span>
                      <a-switch v-model:checked="remotePrefHighBeam" size="small" @change="(v: boolean) => handlePrefSwitchChange('HIGH_BEAM', v)" />
                    </span>
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-aux') }}</span>
                      <a-switch v-model:checked="remotePrefAuxLight" size="small" @change="(v: boolean) => handlePrefSwitchChange('AUX_LIGHT', v)" />
                    </span>
                    <span class="rc-preflight-field">
                      <span class="rc-preflight-name">{{ $t('parallel-driving.vehicle-detail.preflight-hazard') }}</span>
                      <a-switch v-model:checked="remotePrefHazard" size="small" @change="(v: boolean) => handlePrefSwitchChange('HAZARD_LIGHT', v)" />
                    </span>
                  </div>
                </div>
              </template>
            </div>

            <span class="rc-divider" />

            <!-- 组 4：操作按钮 -->
            <div class="rc-group rc-group-actions">
              <a-button
                type="primary"
                size="small"
                :loading="takingOver"
                :disabled="
                  isControlling ||
                  !selectedCockpitId ||
                  vehicle.state?.value !== 'online' ||
                  (isActiveState(vehicle.sessionState) && vehicle.boundCockpitId !== selectedCockpitId)
                "
                class="rc-btn rc-btn-start"
                @click="handleStartRemoteControl"
              >
                <template #icon>
                  <AIcon type="PlayCircleOutlined" />
                </template>
                {{ $t('parallel-driving.vehicle-detail.start-remote-control') }}
              </a-button>
              <a-button
                danger
                size="small"
                :loading="releasing"
                :disabled="!canCloudRelease"
                class="rc-btn rc-btn-stop"
                @click="handleExitRemoteControl"
              >
                <template #icon>
                  <AIcon type="StopOutlined" />
                </template>
                {{ canCloudRelease && !isControlling ? '云端释放控制' : $t('parallel-driving.vehicle-detail.exit-remote-control') }}
              </a-button>
              <a-popconfirm
                v-if="false"
                :title="$t('parallel-driving.control-pad.emergency-stop-confirm')"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleEmergencyStop"
              >
                <a-button type="primary" danger :loading="emergencyStopping" class="rc-btn">
                  <template #icon>
                    <AIcon type="WarningOutlined" />
                  </template>
                  紧急制动
                </a-button>
              </a-popconfirm>
            </div>

            <!-- 全屏按钮：接管中或车辆在线均可用 -->
            <div v-if="showVideoMonitoringSection" class="rc-group rc-group-fs">
              <!-- 有整页全屏能力时显示两个按钮，否则只显示当前页面全屏 -->
              <a-button v-if="props.onToggleShellFullscreen" size="small" class="rc-btn rc-btn-fs" @click="toggleFullscreen">
                <template #icon>
                  <AIcon :type="isFullscreen ? 'FullscreenExitOutlined' : 'FullscreenOutlined'" />
                </template>
                {{ isFullscreen ? '退出' : '当前页面' }}
              </a-button>
              <a-button v-if="props.onToggleShellFullscreen" size="small" class="rc-btn rc-btn-fs rc-btn-shell-fs" @click="props.onToggleShellFullscreen">
                <template #icon>
                  <AIcon :type="props.isShellFullscreen ? 'FullscreenExitOutlined' : 'FullscreenOutlined'" />
                </template>
                {{ props.isShellFullscreen ? '退出' : '整个页面' }}
              </a-button>
              <a-button v-if="!props.onToggleShellFullscreen" size="small" class="rc-btn rc-btn-fs" @click="toggleFullscreen">
                <template #icon>
                  <AIcon :type="isFullscreen ? 'FullscreenExitOutlined' : 'FullscreenOutlined'" />
                </template>
                {{ isFullscreen ? $t('parallel-driving.vehicle-detail.exit-fullscreen') : $t('parallel-driving.vehicle-detail.fullscreen') }}
              </a-button>
            </div>
          </div>

          <!-- 未在线且无接管：监控区占位说明（避免视频区整段消失后留白） -->
          <div
            v-if="vehicle && !isControlling && !isVehicleOnline && !isRemoteFocusEntry"
            class="vehicle-offline-monitor-placeholder"
            role="status"
            :aria-label="$t('parallel-driving.vehicle-detail.offline-monitor-title')"
          >
            <div class="offline-monitor-card">
              <div class="offline-monitor-icon-wrap" aria-hidden="true">
                <svg class="offline-monitor-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2.25" y="4.5" width="19.5" height="12" rx="1.75" stroke="currentColor" stroke-width="1.5" />
                  <path d="M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M12 16.5V21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <path d="M4.5 15.5L17 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </div>
              <p class="offline-monitor-title">{{ $t('parallel-driving.vehicle-detail.offline-monitor-title') }}</p>
              <p class="offline-monitor-hint">{{ $t('parallel-driving.vehicle-detail.offline-monitor-hint') }}</p>
              <a-button
                type="default"
                class="offline-monitor-refresh"
                :loading="loading"
                @click="loadVehicle(false)"
              >
                <template #icon>
                  <AIcon type="ReloadOutlined" />
                </template>
                {{ $t('parallel-driving.vehicle-detail.offline-monitor-refresh') }}
              </a-button>
            </div>
          </div>

          <!-- 视频区域：接管中或车辆在线均显示 -->
          <div v-if="showVideoMonitoringSection" ref="videoSectionRef" class="video-section" :class="layoutSectionClass">
            <!-- 方案 E：左中右 + PiP，倒车 CSS 交换位置（不重载视频） -->
            <template v-if="isRemoteFocusEntry || layoutMode === 'e'">
              <div class="layout-e" :class="{ 'layout-e--hitch-sides': showRearHitchCams }">
                <!-- 左列：挂后时在左视下方叠挂后左 cam_b_17 -->
                <div class="layout-e-left" :style="layoutESideColumnStyle">
                  <!-- 始终单层 stack + 左眼固定首槽：避免勾选挂后 v-if/else 换掉整棵树导致左眼/右眼 WebRtc 重挂载 -->
                  <div
                    class="layout-e-side-stack"
                    :class="{ 'layout-e-side-stack--solo': !showRearHitchCams }"
                    :role="showRearHitchCams ? 'group' : undefined"
                    :aria-label="showRearHitchCams ? $t('parallel-driving.vehicle-detail.rear-hitch-left-column') : undefined"
                  >
                    <div class="layout-e-side-half">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-left')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('left')"
                        :url="getVideoUrl('left')"
                      />
                    </div>
                    <div v-if="showRearHitchCams" class="layout-e-side-half">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-rear-left-hitch')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getHitchStream('rear_left')"
                        :url="getHitchVideoUrl('rear_left')"
                        :mirror="true"
                      />
                    </div>
                  </div>
                </div>
                <!-- 中列：front + back 各渲染一次，CSS 交换大小位置 -->
                <div class="layout-e-center" :style="{ flex: layoutECenterFlex }" :class="{ 'is-reverse': isReverse }">
                  <!-- 前视频层 — D主/R隐 -->
                  <div ref="frontVideoCalibHostRef" class="layout-e-layer layout-e-layer-front">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-front')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('front')"
                      :url="getVideoUrl('front')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('front')"
                      :show-distance-guide="false"
                      :front-calib-match-external="showFrontAuxGuideVisible"
                      :show-cloud-link-rtt="showFrontCloudLinkRtt"
                      :cloud-link-network-rtt-ms="vehicleStatus.cloudLinkNetworkRttMs"
                    />
                  </div>
                  <!-- 后视频层 — D隐/R主 -->
                  <div class="layout-e-layer layout-e-layer-back">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('back')"
                    />
                  </div>
                  <!-- 前视距离引导：须叠在视频层之上；layout-e 内前视在 z-index:1 子层，无法压过 HUD(5)，故在此单独挂一层 -->
                  <FrontCameraDistanceGuide
                    v-if="showFrontAuxGuideVisible"
                    class="layout-e-front-distance-guide"
                    :measure-within="frontVideoCalibHostRef"
                    :rows="DEFAULT_FRONT_GUIDE_ROWS"
                  />
                  <div
                    v-if="showFrontAuxGuideVisible"
                    class="layout-e-wheels-on-guide"
                    :style="frontVideoOverlayStyle"
                  >
                    <!-- 左中右：转向灯固定底栏；此处仅保留引导线端点上的前轮示意 -->
                    <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('left')">
                      <div class="hud-guide-anchor__wheel-center">
                        <HudTurnInnerWheel
                          side="left"
                          pivot-on-ground
                          :knuckle-deg="steerKnuckleDegSigned"
                        />
                      </div>
                    </div>
                    <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('right')">
                      <div class="hud-guide-anchor__wheel-center">
                        <HudTurnInnerWheel
                          side="right"
                          pivot-on-ground
                          :knuckle-deg="steerKnuckleDegSigned"
                        />
                      </div>
                    </div>
                  </div>
                  <!-- HUD 叠加层：左中右下转向灯始终在速度两侧底栏 -->
                  <div class="layout-e-hud-overlay">
                    <div class="status-hud status-hud-xiaomi layout-e-hud">
                      <div class="hud-left">
                        <div class="hud-left-cluster">
                        <div class="hud-soc-beam-row">
                        <div
                          class="hud-soc-strip"
                          :class="hudSocStripClass"
                          title="VCU SOC（vcu_soc）"
                          role="status"
                          :aria-label="hudSocAriaLabel"
                        >
                          <svg class="hud-soc-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect
                              x="3"
                              y="8"
                              height="8"
                              rx="1.25"
                              ry="1.25"
                              fill="currentColor"
                              fill-opacity="0.55"
                              :width="hudSocIconFillWidth"
                            />
                            <rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
                            <path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                          </svg>
                          <span class="hud-soc-value">
                            <span class="hud-soc-num">{{ formatNumber(vehicleStatus.soc, 0, '--') }}</span><span v-if="Number.isFinite(Number(vehicleStatus.soc))" class="hud-soc-pct">%</span>
                          </span>
                        </div>
                        <div class="hud-beam-row" role="group" :aria-label="hudBeamAriaLabel">
                          <span class="hud-beam-lamp" :class="hudBeamLampClass" :title="hudBeamTitle">
                            <HudHeadlightBeamIcon :high-beam="isHudHighBeamOn" />
                          </span>
                        </div>
                        <HudAuxStatusRow
                          :epb-on="hudEpbOn"
                          :horn-on="hudHornOn"
                        />
                        </div>
                        <div class="hud-gear-row">
                          <div class="hud-drivemode-pair" title="驾驶模式：M=手动(0)，A=自动(1)，R=远控(2)">
                            <span class="hud-dm-circle" :class="hudDriveModeClass(vehicleStatus.drivemode)">{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                          </div>
                          <div class="hud-gear-sep" aria-hidden="true"></div>
                          <span v-for="(ch, idx) in HUD_GEAR_LETTERS" :key="ch" class="hud-gear-char" :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }">{{ ch }}</span>
                        </div>
                        </div>
                      </div>
                      <div class="hud-turn-cluster hud-turn-cluster--bar hud-turn-cluster-left">
                        <div class="hud-ts-inline" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                        </div>
                        <HudTurnInnerWheel
                          v-if="!showFrontAuxGuideVisible"
                          side="left"
                          :knuckle-deg="steerKnuckleDegSigned"
                        />
                      </div>
                      <div class="hud-center">
                        <div class="hud-speed-block">
                          <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                          <span class="hud-speed-unit">km/h</span>
                        </div>
                        <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                      </div>
                      <div class="hud-turn-cluster hud-turn-cluster--bar hud-turn-cluster-right">
                        <HudTurnInnerWheel
                          v-if="!showFrontAuxGuideVisible"
                          side="right"
                          :knuckle-deg="steerKnuckleDegSigned"
                        />
                        <div class="hud-ts-inline" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                        </div>
                      </div>
                      <div class="hud-right">
                        <HudSteerStatBlock
                          :steer-dir="steerDir"
                          :steer-degree-text="steerDegreeText"
                          :steer-knuckle-degree-text="steerKnuckleDegreeText"
                          :steer-aria-label="steerAriaLabel"
                          :show-knuckle-row="false"
                        />
                        <span class="hud-stat-sep" />
                        <div class="hud-stat hud-stat-pedal">
                          <span class="hud-stat-label">油门</span>
                          <span
                            class="hud-pedal-lamp hud-pedal-lamp-accel"
                            :class="{ 'is-lit': vehicleStatus.hudAccelLit }"
                            title="点亮：vcu_vcu_pt_ctrl_auto_sts=1 且 adcu_spd_req&gt;0"
                          >
                            <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M12 4v8M8 9l4-4 4 4"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <rect x="7" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.45" />
                            </svg>
                          </span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat hud-stat-pedal">
                          <span class="hud-stat-label">制动</span>
                          <span
                            class="hud-pedal-lamp hud-pedal-lamp-brake"
                            :class="{ 'is-lit': vehicleStatus.hudBrakeLit }"
                            title="点亮：vcu_xbr_ctrl_auto_sts=1 且 adcu_ext_acc_demand&lt;-0.1"
                          >
                            <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
                              <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- cam_f_7 辅助前视 PiP：左缘对齐中列左缘 -->
                <div class="layout-e-layer layout-e-layer-f7">
                  <VideoCell
                    label="前辅 cam_f_7"
                    :base-url="VIDEO_CONFIG.baseUrl"
                    :app="videoStreamAppPlayback"
                    :protocol="VIDEO_CONFIG.protocol"
                    :stream="getVideoStream('right')"
                    :url="getVideoUrl('right')"
                    :show-distance-guide="false"
                  />
                </div>
                <!-- 右列：上=前后双层CSS交换（与中列方向相反），下=挂后右 -->
                <div class="layout-e-right" :style="layoutESideColumnStyle">
                  <!-- MRC1 可拖动按钮：常态=进入MRC1点击下发MRC1，激活后=退出MRC1点击下发MRC0 -->
                  <div
                    v-if="isControlling || isVehicleOnline"
                    class="layout-e-mrc1-badge"
                    :style="mrc1BtnStyle"
                    @mousedown.prevent="startDragMrc1"
                    @touchstart.prevent="startDragMrc1"
                  >
                    <button
                      ref="mrc1BtnRef"
                      class="mrc1-circle-btn"
                      :class="{ 'is-dragging': isDraggingMrc1, 'is-alarm': Number(vehicleStatus.mrcStatus) >= 2 }"
                      :title="Number(vehicleStatus.mrcStatus) >= 2 ? '退出MRC1' : '进入MRC1'"
                      :aria-label="Number(vehicleStatus.mrcStatus) >= 2 ? '退出MRC1' : '进入MRC1'"
                      @click="handleMrc1BadgeClick"
                    >
                      <span class="mrc1-circle-icon" aria-hidden="true">
                        {{ Number(vehicleStatus.mrcStatus) >= 2 ? '退出MRC1' : '进入MRC1' }}
                      </span>
                    </button>
                  </div>
                  <div
                    class="layout-e-side-stack"
                    :class="{ 'layout-e-side-stack--solo': !showRearHitchCams }"
                    :role="showRearHitchCams ? 'group' : undefined"
                    :aria-label="showRearHitchCams ? $t('parallel-driving.vehicle-detail.rear-hitch-right-column') : undefined"
                  >
                    <!-- 右列上层：前+后双层，CSS交换。D档=后主, R档=前主（与中列相反） -->
                    <div class="layout-e-side-half layout-e-right-dual-host" :class="{ 'is-reverse': isReverse }">
                      <div class="layout-e-layer layout-e-right-layer-front">
                        <VideoCell
                          :label="$t('parallel-driving.vehicle-detail.video-front')"
                          :base-url="VIDEO_CONFIG.baseUrl"
                          :app="videoStreamAppPlayback"
                          :protocol="VIDEO_CONFIG.protocol"
                          :stream="getVideoStream('front')"
                          :url="getVideoUrl('front')"
                        />
                      </div>
                      <div class="layout-e-layer layout-e-right-layer-back">
                        <VideoCell
                          :label="$t('parallel-driving.vehicle-detail.video-back')"
                          :base-url="VIDEO_CONFIG.baseUrl"
                          :app="videoStreamAppPlayback"
                          :protocol="VIDEO_CONFIG.protocol"
                          :stream="getVideoStream('back')"
                          :url="getVideoUrl('back')"
                        />
                      </div>
                    </div>
                    <div v-if="showRearHitchCams" class="layout-e-side-half">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-rear-right-hitch')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getHitchStream('rear_right')"
                        :url="getHitchVideoUrl('rear_right')"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('rear_right')"
                        :mirror="true"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <!-- 驾驶视图：前视自适应宽度 + 右侧三路，动态计算最优比例 -->
            <template v-else-if="layoutMode === 'd'">
              <div class="layout-d">
                <div class="layout-d-main" :style="{ flex: drivingFrontFlex }">
                  <div class="video-with-hud">
                    <div ref="frontVideoCalibHostRef" class="detail-front-calib-host">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-front')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('front')"
                        :url="getVideoUrl('front')"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('front')"
                        :show-cloud-link-rtt="showFrontCloudLinkRtt"
                        :cloud-link-network-rtt-ms="vehicleStatus.cloudLinkNetworkRttMs"
                      />
                    </div>
                    <div class="status-hud status-hud-xiaomi">
                      <div class="hud-left">
                        <div class="hud-left-cluster">
                        <div class="hud-soc-beam-row">
                        <div
                          class="hud-soc-strip"
                          :class="hudSocStripClass"
                          title="VCU SOC（vcu_soc）"
                          role="status"
                          :aria-label="hudSocAriaLabel"
                        >
                          <svg class="hud-soc-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <rect
                              x="3"
                              y="8"
                              height="8"
                              rx="1.25"
                              ry="1.25"
                              fill="currentColor"
                              fill-opacity="0.55"
                              :width="hudSocIconFillWidth"
                            />
                            <rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
                            <path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                          </svg>
                          <span class="hud-soc-value">
                            <span class="hud-soc-num">{{ formatNumber(vehicleStatus.soc, 0, '--') }}</span><span v-if="Number.isFinite(Number(vehicleStatus.soc))" class="hud-soc-pct">%</span>
                          </span>
                        </div>
                        <div class="hud-beam-row" role="group" :aria-label="hudBeamAriaLabel">
                          <span class="hud-beam-lamp" :class="hudBeamLampClass" :title="hudBeamTitle">
                            <HudHeadlightBeamIcon :high-beam="isHudHighBeamOn" />
                          </span>
                        </div>
                        <HudAuxStatusRow
                          :epb-on="hudEpbOn"
                          :horn-on="hudHornOn"
                        />
                        </div>
                        <div class="hud-gear-row">
                          <div class="hud-drivemode-pair" title="驾驶模式：M=手动(0)，A=自动(1)，R=远控(2)">
                            <span class="hud-dm-circle" :class="hudDriveModeClass(vehicleStatus.drivemode)">{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                          </div>
                          <div class="hud-gear-sep" aria-hidden="true"></div>
                          <span v-for="(ch, idx) in HUD_GEAR_LETTERS" :key="ch" class="hud-gear-char" :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }">{{ ch }}</span>
                        </div>
                        </div>
                      </div>
                      <div class="hud-center">
                        <div class="hud-speed-block">
                          <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                          <span class="hud-speed-unit">km/h</span>
                        </div>
                        <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                      </div>
                      <div class="hud-right">
                        <HudSteerStatBlock
                          :steer-dir="steerDir"
                          :steer-degree-text="steerDegreeText"
                          :steer-knuckle-degree-text="steerKnuckleDegreeText"
                          :steer-aria-label="steerAriaLabel"
                          :show-knuckle-row="false"
                        />
                        <span class="hud-stat-sep" />
                        <div class="hud-stat hud-stat-pedal">
                          <span class="hud-stat-label">油门</span>
                          <span
                            class="hud-pedal-lamp hud-pedal-lamp-accel"
                            :class="{ 'is-lit': vehicleStatus.hudAccelLit }"
                            title="点亮：vcu_vcu_pt_ctrl_auto_sts=1 且 adcu_spd_req&gt;0"
                          >
                            <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M12 4v8M8 9l4-4 4 4"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                              <rect x="7" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.45" />
                            </svg>
                          </span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat hud-stat-pedal">
                          <span class="hud-stat-label">制动</span>
                          <span
                            class="hud-pedal-lamp hud-pedal-lamp-brake"
                            :class="{ 'is-lit': vehicleStatus.hudBrakeLit }"
                            title="点亮：vcu_xbr_ctrl_auto_sts=1 且 adcu_ext_acc_demand&lt;-0.1"
                          >
                            <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
                              <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div
                      class="hud-turn-overlay"
                      :class="{ 'hud-turn-overlay--on-guide': showFrontAuxGuideVisible }"
                      :style="showFrontAuxGuideVisible ? frontVideoOverlayStyle : undefined"
                    >
                      <template v-if="showFrontAuxGuideVisible">
                        <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('left')">
                          <div class="hud-guide-anchor__turn-above">
                            <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                              <span class="hud-ts-label">LEFT</span>
                            </div>
                          </div>
                          <div class="hud-guide-anchor__wheel-center">
                            <HudTurnInnerWheel
                              side="left"
                              pivot-on-ground
                              :knuckle-deg="steerKnuckleDegSigned"
                            />
                          </div>
                        </div>
                        <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('right')">
                          <div class="hud-guide-anchor__turn-above">
                            <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                              <span class="hud-ts-label">RIGHT</span>
                            </div>
                          </div>
                          <div class="hud-guide-anchor__wheel-center">
                            <HudTurnInnerWheel
                              side="right"
                              pivot-on-ground
                              :knuckle-deg="steerKnuckleDegSigned"
                            />
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-left">
                          <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                            <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                            <span class="hud-ts-label">LEFT</span>
                          </div>
                          <HudTurnInnerWheel side="left" :knuckle-deg="steerKnuckleDegSigned" />
                        </div>
                        <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-right">
                          <HudTurnInnerWheel side="right" :knuckle-deg="steerKnuckleDegSigned" />
                          <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                            <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                            <span class="hud-ts-label">RIGHT</span>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
                <div class="layout-d-side" :style="{ flex: drivingSideFlex }">
                  <div class="layout-d-cell">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('back')"
                    />
                  </div>
                  <div class="layout-d-cell">
                    <VideoCell
                      camera-direction="left"
                      :label="$t('parallel-driving.vehicle-detail.video-left')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('left')"
                    />
                  </div>
                  <div class="layout-d-cell">
                    <VideoCell
                      camera-direction="right"
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('right')"
                    />
                  </div>
                </div>
              </div>
            </template>
            <!-- 方案 A：2×2，每行 50%，每格 960:768 -->
            <template v-else-if="layoutMode === 'a'">
              <div class="layout-a">
                <div class="layout-a-row1">
                  <div class="layout-a-col layout-a-col-front">
                    <div class="video-with-hud">
                      <div ref="frontVideoCalibHostRef" class="detail-front-calib-host">
                        <VideoCell
                          :label="$t('parallel-driving.vehicle-detail.video-front')"
                          :base-url="VIDEO_CONFIG.baseUrl"
                          :app="videoStreamAppPlayback"
                          :protocol="VIDEO_CONFIG.protocol"
                          :stream="getVideoStream('front')"
                          :url="getVideoUrl('front')"
                          :abr-layers="getAbrLayers()"
                          :abr-preset="getAbrPreset('front')"
                          :show-cloud-link-rtt="showFrontCloudLinkRtt"
                          :cloud-link-network-rtt-ms="vehicleStatus.cloudLinkNetworkRttMs"
                        />
                      </div>
                      <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-left-cluster">
                          <div class="hud-soc-beam-row">
                          <div
                            class="hud-soc-strip"
                            :class="hudSocStripClass"
                            title="VCU SOC（vcu_soc）"
                            role="status"
                            :aria-label="hudSocAriaLabel"
                          >
                            <svg class="hud-soc-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <rect
                                x="3"
                                y="8"
                                height="8"
                                rx="1.25"
                                ry="1.25"
                                fill="currentColor"
                                fill-opacity="0.55"
                                :width="hudSocIconFillWidth"
                              />
                              <rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
                              <path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                            <span class="hud-soc-value">
                              <span class="hud-soc-num">{{ formatNumber(vehicleStatus.soc, 0, '--') }}</span><span v-if="Number.isFinite(Number(vehicleStatus.soc))" class="hud-soc-pct">%</span>
                            </span>
                          </div>
                          <div class="hud-beam-row" role="group" :aria-label="hudBeamAriaLabel">
                            <span class="hud-beam-lamp" :class="hudBeamLampClass" :title="hudBeamTitle">
                              <HudHeadlightBeamIcon :high-beam="isHudHighBeamOn" />
                            </span>
                          </div>
                          <HudAuxStatusRow
                            :epb-on="hudEpbOn"
                            :horn-on="hudHornOn"
                          />
                          </div>
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=手动(0)，A=自动(1)，R=远控(2)"
                            >
                              <span
                                class="hud-dm-circle"
                                :class="hudDriveModeClass(vehicleStatus.drivemode)"
                              >{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                            </div>
                            <div class="hud-gear-sep" aria-hidden="true"></div>
                            <span
                              v-for="(ch, idx) in HUD_GEAR_LETTERS"
                              :key="ch"
                              class="hud-gear-char"
                              :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }"
                            >{{ ch }}</span>
                          </div>
                          </div>
                        </div>
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <HudSteerStatBlock
                            :steer-dir="steerDir"
                            :steer-degree-text="steerDegreeText"
                            :steer-knuckle-degree-text="steerKnuckleDegreeText"
                            :steer-aria-label="steerAriaLabel"
                            :show-knuckle-row="false"
                          />
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">油门</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-accel"
                              :class="{ 'is-lit': vehicleStatus.hudAccelLit }"
                              title="点亮：vcu_vcu_pt_ctrl_auto_sts=1 且 adcu_spd_req&gt;0"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 4v8M8 9l4-4 4 4"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                                <rect x="7" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.45" />
                              </svg>
                            </span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">制动</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-brake"
                              :class="{ 'is-lit': vehicleStatus.hudBrakeLit }"
                              title="点亮：vcu_xbr_ctrl_auto_sts=1 且 adcu_ext_acc_demand&lt;-0.1"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
                                <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        class="hud-turn-overlay"
                        :class="{ 'hud-turn-overlay--on-guide': showFrontAuxGuideVisible }"
                        :style="showFrontAuxGuideVisible ? frontVideoOverlayStyle : undefined"
                      >
                        <template v-if="showFrontAuxGuideVisible">
                          <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('left')">
                            <div class="hud-guide-anchor__turn-above">
                              <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                                <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                                <span class="hud-ts-label">LEFT</span>
                              </div>
                            </div>
                            <div class="hud-guide-anchor__wheel-center">
                              <HudTurnInnerWheel
                                side="left"
                                pivot-on-ground
                                :knuckle-deg="steerKnuckleDegSigned"
                              />
                            </div>
                          </div>
                          <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('right')">
                            <div class="hud-guide-anchor__turn-above">
                              <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                                <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                                <span class="hud-ts-label">RIGHT</span>
                              </div>
                            </div>
                            <div class="hud-guide-anchor__wheel-center">
                              <HudTurnInnerWheel
                                side="right"
                                pivot-on-ground
                                :knuckle-deg="steerKnuckleDegSigned"
                              />
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-left">
                            <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                              <span class="hud-ts-label">LEFT</span>
                            </div>
                            <HudTurnInnerWheel side="left" :knuckle-deg="steerKnuckleDegSigned" />
                          </div>
                          <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-right">
                            <HudTurnInnerWheel side="right" :knuckle-deg="steerKnuckleDegSigned" />
                            <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                              <span class="hud-ts-label">RIGHT</span>
                            </div>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                  <div class="layout-a-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('back')"
                    />
                  </div>
                </div>
                <div class="layout-a-row2">
                  <div class="layout-a-col">
                    <VideoCell
                      camera-direction="left"
                      :label="$t('parallel-driving.vehicle-detail.video-left')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('left')"
                    />
                  </div>
                  <div class="layout-a-col">
                    <VideoCell
                      camera-direction="right"
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('right')"
                    />
                  </div>
                </div>
              </div>
            </template>
            <!-- 方案 B：前主左，右侧后左右三路等高 -->
            <template v-else-if="layoutMode === 'b'">
              <a-row :gutter="2" class="video-grid layout-b-row">
                <a-col :span="18">
                  <div ref="frontVideoCalibHostRef" class="video-box video-box-front">
                    <div class="video-wrapper">
                      <WebRtcPlayer
                        v-if="VIDEO_CONFIG.protocol === 'webrtc' && getVideoStream('front')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :stream="getVideoStream('front')!"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('front')"
                        :show-cloud-link-rtt="showFrontCloudLinkRtt"
                        :cloud-link-network-rtt-ms="vehicleStatus.cloudLinkNetworkRttMs"
                        :fast-video-recovery="isControlling"
                      />
                      <Player
                        v-else-if="getVideoUrl('front')"
                        :url="getVideoUrl('front')"
                        :protocol="VIDEO_CONFIG.protocol"
                        :live="true"
                        autoplay
                      />
                      <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
                      <FrontCameraDistanceGuide
                        v-if="showFrontAuxGuideVisible"
                        :rows="DEFAULT_FRONT_GUIDE_ROWS"
                      />
                      <span class="video-badge">{{ $t('parallel-driving.vehicle-detail.video-front') }}</span>
                      <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-left-cluster">
                          <div class="hud-soc-beam-row">
                          <div
                            class="hud-soc-strip"
                            :class="hudSocStripClass"
                            title="VCU SOC（vcu_soc）"
                            role="status"
                            :aria-label="hudSocAriaLabel"
                          >
                            <svg class="hud-soc-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <rect
                                x="3"
                                y="8"
                                height="8"
                                rx="1.25"
                                ry="1.25"
                                fill="currentColor"
                                fill-opacity="0.55"
                                :width="hudSocIconFillWidth"
                              />
                              <rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
                              <path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                            <span class="hud-soc-value">
                              <span class="hud-soc-num">{{ formatNumber(vehicleStatus.soc, 0, '--') }}</span><span v-if="Number.isFinite(Number(vehicleStatus.soc))" class="hud-soc-pct">%</span>
                            </span>
                          </div>
                          <div class="hud-beam-row" role="group" :aria-label="hudBeamAriaLabel">
                            <span class="hud-beam-lamp" :class="hudBeamLampClass" :title="hudBeamTitle">
                              <HudHeadlightBeamIcon :high-beam="isHudHighBeamOn" />
                            </span>
                          </div>
                          <HudAuxStatusRow
                            :epb-on="hudEpbOn"
                            :horn-on="hudHornOn"
                          />
                          </div>
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=手动(0)，A=自动(1)，R=远控(2)"
                            >
                              <span
                                class="hud-dm-circle"
                                :class="hudDriveModeClass(vehicleStatus.drivemode)"
                              >{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                            </div>
                            <div class="hud-gear-sep" aria-hidden="true"></div>
                            <span
                              v-for="(ch, idx) in HUD_GEAR_LETTERS"
                              :key="ch"
                              class="hud-gear-char"
                              :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }"
                            >{{ ch }}</span>
                          </div>
                          </div>
                        </div>
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <HudSteerStatBlock
                            :steer-dir="steerDir"
                            :steer-degree-text="steerDegreeText"
                            :steer-knuckle-degree-text="steerKnuckleDegreeText"
                            :steer-aria-label="steerAriaLabel"
                            :show-knuckle-row="false"
                          />
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">油门</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-accel"
                              :class="{ 'is-lit': vehicleStatus.hudAccelLit }"
                              title="点亮：vcu_vcu_pt_ctrl_auto_sts=1 且 adcu_spd_req&gt;0"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 4v8M8 9l4-4 4 4"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                                <rect x="7" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.45" />
                              </svg>
                            </span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">制动</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-brake"
                              :class="{ 'is-lit': vehicleStatus.hudBrakeLit }"
                              title="点亮：vcu_xbr_ctrl_auto_sts=1 且 adcu_ext_acc_demand&lt;-0.1"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
                                <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      class="hud-turn-overlay"
                      :class="{ 'hud-turn-overlay--on-guide': showFrontAuxGuideVisible }"
                      :style="showFrontAuxGuideVisible ? frontVideoOverlayStyle : undefined"
                    >
                      <template v-if="showFrontAuxGuideVisible">
                        <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('left')">
                          <div class="hud-guide-anchor__turn-above">
                            <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                              <span class="hud-ts-label">LEFT</span>
                            </div>
                          </div>
                          <div class="hud-guide-anchor__wheel-center">
                            <HudTurnInnerWheel
                              side="left"
                              pivot-on-ground
                              :knuckle-deg="steerKnuckleDegSigned"
                            />
                          </div>
                        </div>
                        <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('right')">
                          <div class="hud-guide-anchor__turn-above">
                            <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                              <span class="hud-ts-label">RIGHT</span>
                            </div>
                          </div>
                          <div class="hud-guide-anchor__wheel-center">
                            <HudTurnInnerWheel
                              side="right"
                              pivot-on-ground
                              :knuckle-deg="steerKnuckleDegSigned"
                            />
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-left">
                          <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                            <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                            <span class="hud-ts-label">LEFT</span>
                          </div>
                          <HudTurnInnerWheel side="left" :knuckle-deg="steerKnuckleDegSigned" />
                        </div>
                        <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-right">
                          <HudTurnInnerWheel side="right" :knuckle-deg="steerKnuckleDegSigned" />
                          <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                            <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                            <span class="hud-ts-label">RIGHT</span>
                          </div>
                        </div>
                      </template>
                    </div>
                  </div>
                </a-col>
                <a-col :span="6" class="layout-b-right-col">
                  <a-row :gutter="2" class="video-grid layout-b-inner-row">
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-back')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('back')"
                        :url="getVideoUrl('back')"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('back')"
                      />
                    </a-col>
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-left')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('left')"
                        :url="getVideoUrl('left')"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('left')"
                      />
                    </a-col>
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-right')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="videoStreamAppPlayback"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('right')"
                        :url="getVideoUrl('right')"
                        :abr-layers="getAbrLayers()"
                        :abr-preset="getAbrPreset('right')"
                      />
                    </a-col>
                  </a-row>
                </a-col>
              </a-row>
            </template>
            <!-- 方案 C：两行各 50%，第一行前视居中 960:768，第二行三列各 960:768 -->
            <template v-else-if="layoutMode === 'c'">
              <div class="layout-c">
                <!-- 第一行 50% -->
                <div class="layout-c-row1">
                  <div class="layout-c-row1-inner">
                    <div ref="frontVideoCalibHostRef" class="layout-c-video-wrap">
                      <div class="layout-c-paint" :style="layoutCFrontPaintStyle">
                        <WebRtcPlayer
                          v-if="VIDEO_CONFIG.protocol === 'webrtc' && getVideoStream('front')"
                          :base-url="VIDEO_CONFIG.baseUrl"
                          :app="videoStreamAppPlayback"
                          :stream="getVideoStream('front')!"
                          :abr-layers="getAbrLayers()"
                          :abr-preset="getAbrPreset('front')"
                          :show-cloud-link-rtt="showFrontCloudLinkRtt"
                          :cloud-link-network-rtt-ms="vehicleStatus.cloudLinkNetworkRttMs"
                          :fast-video-recovery="isControlling"
                        />
                        <Player
                          v-else-if="getVideoUrl('front')"
                          :url="getVideoUrl('front')"
                          :protocol="VIDEO_CONFIG.protocol"
                          :live="true"
                          autoplay
                        />
                        <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
                        <FrontCameraDistanceGuide
                          v-if="showFrontAuxGuideVisible"
                          :rows="DEFAULT_FRONT_GUIDE_ROWS"
                        />
                        <span class="video-badge">{{ $t('parallel-driving.vehicle-detail.video-front') }}</span>
                        <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-left-cluster">
                          <div class="hud-soc-beam-row">
                          <div
                            class="hud-soc-strip"
                            :class="hudSocStripClass"
                            title="VCU SOC（vcu_soc）"
                            role="status"
                            :aria-label="hudSocAriaLabel"
                          >
                            <svg class="hud-soc-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <rect
                                x="3"
                                y="8"
                                height="8"
                                rx="1.25"
                                ry="1.25"
                                fill="currentColor"
                                fill-opacity="0.55"
                                :width="hudSocIconFillWidth"
                              />
                              <rect x="2" y="7" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
                              <path d="M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                            </svg>
                            <span class="hud-soc-value">
                              <span class="hud-soc-num">{{ formatNumber(vehicleStatus.soc, 0, '--') }}</span><span v-if="Number.isFinite(Number(vehicleStatus.soc))" class="hud-soc-pct">%</span>
                            </span>
                          </div>
                          <div class="hud-beam-row" role="group" :aria-label="hudBeamAriaLabel">
                            <span class="hud-beam-lamp" :class="hudBeamLampClass" :title="hudBeamTitle">
                              <HudHeadlightBeamIcon :high-beam="isHudHighBeamOn" />
                            </span>
                          </div>
                          <HudAuxStatusRow
                            :epb-on="hudEpbOn"
                            :horn-on="hudHornOn"
                          />
                          </div>
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=手动(0)，A=自动(1)，R=远控(2)"
                            >
                              <span
                                class="hud-dm-circle"
                                :class="hudDriveModeClass(vehicleStatus.drivemode)"
                              >{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                            </div>
                            <div class="hud-gear-sep" aria-hidden="true"></div>
                            <span
                              v-for="(ch, idx) in HUD_GEAR_LETTERS"
                              :key="ch"
                              class="hud-gear-char"
                              :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }"
                            >{{ ch }}</span>
                          </div>
                          </div>
                        </div>
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <HudSteerStatBlock
                            :steer-dir="steerDir"
                            :steer-degree-text="steerDegreeText"
                            :steer-knuckle-degree-text="steerKnuckleDegreeText"
                            :steer-aria-label="steerAriaLabel"
                            :show-knuckle-row="false"
                          />
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">油门</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-accel"
                              :class="{ 'is-lit': vehicleStatus.hudAccelLit }"
                              title="点亮：vcu_vcu_pt_ctrl_auto_sts=1 且 adcu_spd_req&gt;0"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M12 4v8M8 9l4-4 4 4"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                />
                                <rect x="7" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity="0.45" />
                              </svg>
                            </span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat hud-stat-pedal">
                            <span class="hud-stat-label">制动</span>
                            <span
                              class="hud-pedal-lamp hud-pedal-lamp-brake"
                              :class="{ 'is-lit': vehicleStatus.hudBrakeLit }"
                              title="点亮：vcu_xbr_ctrl_auto_sts=1 且 adcu_ext_acc_demand&lt;-0.1"
                            >
                              <svg class="hud-pedal-svg" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
                                <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                      <!-- 须放在 layout-c-video-wrap 内（与驾驶视图 d 一致），锚点 % 与 FrontCameraDistanceGuide 同一坐标系 -->
                      <div
                        class="hud-turn-overlay"
                        :class="{ 'hud-turn-overlay--on-guide': showFrontAuxGuideVisible }"
                        :style="showFrontAuxGuideVisible ? frontVideoOverlayStyle : undefined"
                      >
                        <template v-if="showFrontAuxGuideVisible">
                          <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('left')">
                            <div class="hud-guide-anchor__turn-above">
                              <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                                <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                                <span class="hud-ts-label">LEFT</span>
                              </div>
                            </div>
                            <div class="hud-guide-anchor__wheel-center">
                              <HudTurnInnerWheel
                                side="left"
                                pivot-on-ground
                                :knuckle-deg="steerKnuckleDegSigned"
                              />
                            </div>
                          </div>
                          <div class="hud-guide-anchor" :style="hudWheelGuideAnchorPosition('right')">
                            <div class="hud-guide-anchor__turn-above">
                              <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                                <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                                <span class="hud-ts-label">RIGHT</span>
                              </div>
                            </div>
                            <div class="hud-guide-anchor__wheel-center">
                              <HudTurnInnerWheel
                                side="right"
                                pivot-on-ground
                                :knuckle-deg="steerKnuckleDegSigned"
                              />
                            </div>
                          </div>
                        </template>
                        <template v-else>
                          <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-left">
                            <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                              <span class="hud-ts-label">LEFT</span>
                            </div>
                            <HudTurnInnerWheel side="left" :knuckle-deg="steerKnuckleDegSigned" />
                          </div>
                          <div class="hud-turn-cluster hud-turn-cluster--overlay hud-turn-cluster-right">
                            <HudTurnInnerWheel side="right" :knuckle-deg="steerKnuckleDegSigned" />
                            <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                              <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                              <span class="hud-ts-label">RIGHT</span>
                            </div>
                          </div>
                        </template>
                      </div>
                        </div>
                    </div>
                  </div>
                </div>
                <!-- 第二行 50% -->
                <div class="layout-c-row2">
                  <div class="layout-c-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-left')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('left')"
                    />
                  </div>
                  <div class="layout-c-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('back')"
                    />
                  </div>
                  <div class="layout-c-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="videoStreamAppPlayback"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
                      :abr-layers="getAbrLayers()"
                      :abr-preset="getAbrPreset('right')"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
          </div>
        </a-card>
        </div>
      </div>
    </a-spin>
    </j-page-container>
  </div>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import {
  getCockpitDevices,
  getBoundVehicle,
  queryVehicles,
  takeover,
  release,
  emergencyStop,
  sendControlCommand,
} from '../../api/parallel-driving'
import {
  initParallelDrivingWebSocket,
  closeParallelDrivingWebSocket,
  isParallelDrivingWebSocketActive,
} from '../../utils/websocket'
import WebRtcPlayer from '../../components/WebRtcPlayer.vue'
import VideoCell from '../../components/VideoCell.vue'
import HudSteerStatBlock from '../../components/HudSteerStatBlock.vue'
import HudTurnInnerWheel from '../../components/HudTurnInnerWheel.vue'
import HudHeadlightBeamIcon from '../../components/HudHeadlightBeamIcon.vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { Modal, notification } from 'ant-design-vue'
import HudAuxStatusRow from '../../components/HudAuxStatusRow.vue'
import FrontCameraDistanceGuide from '../../components/FrontCameraDistanceGuide.vue'
import { DEFAULT_FRONT_GUIDE_ROWS } from '../../components/front-camera-guide-config'
import { useVideoCalibrationOverlayRect } from '../../components/useVideoCalibrationOverlayRect'
import { wheelAngleDegFromSteerAngleDeg } from '../../utils/steer-wheel-knuckle-map'

/** 前/左右辅助线分控；v1 无记录时回退读 legacy v2（旧「引导线」单开关） */
const FRONT_AUX_GUIDE_LS_KEY = 'parallel-driving.showFrontAuxGuide.v1'
const SIDE_AUX_GUIDE_LS_KEY = 'parallel-driving.showSideAuxGuide.v1'
const FRONT_DISTANCE_GUIDE_LEGACY_LS_KEY = 'parallel-driving.showFrontDistanceGuide.v2'

const { t: $t } = useI18n()
const props = withDefaults(
  defineProps<{
    /** standard：车辆详情；remote-focus：远控工作台独立页 */
    presentation?: 'standard' | 'remote-focus'
    /** 由父容器（如 UltrawideShell）注入的整页全屏切换函数 */
    onToggleShellFullscreen?: () => void
    /** 整页全屏状态，用于按钮图标/文字同步 */
    isShellFullscreen?: boolean
  }>(),
  { presentation: 'standard', isShellFullscreen: false },
)
const route = useRoute()
const router = useRouter()

const vehicleId = computed(() => String(route.params.id || ''))

/** 远控工作台：独立路由 presentation；兼容旧书签 ?mode=remote-focus（左中右 + 沉浸式顶栏） */
const isRemoteFocusEntry = computed(
  () =>
    props.presentation === 'remote-focus' || String(route.query.mode || '') === 'remote-focus',
)

const loading = ref(true)
const vehicle = ref<any>(null)
const selectedCockpitId = ref('')
const cockpitLoading = ref(false)
const cockpitDevices = ref<
  Array<{ label: string; value: string; state: string; productId: string }>
>([])

/** 与后台一致：R 远控仅当选中「平行驾驶手柄」且在线时可选可下发；M / A 无此限制 */
const PARALLEL_JOYSTICK_PRODUCT_ID = 'parallel-driving-joystick'

const selectedCockpitRow = computed(() => {
  const id = selectedCockpitId.value
  if (!id) return null
  return cockpitDevices.value.find((d) => d.value === id) ?? null
})

/** 仅 C(远控)：需当前选中为平行驾驶手柄且在线 */
const canSelectRemoteC = computed(() => {
  const r = selectedCockpitRow.value
  if (!r) return false
  if (r.productId !== PARALLEL_JOYSTICK_PRODUCT_ID) return false
  return r.state === 'online'
})

const remoteCModeDisabledReason = computed(() => {
  if (!selectedCockpitId.value) {
    return $t('parallel-driving.vehicle-detail.preflight-c-reason-select')
  }
  if (cockpitLoading.value) {
    return $t('parallel-driving.vehicle-detail.preflight-c-reason-loading')
  }
  const r = selectedCockpitRow.value
  if (!r) {
    return $t('parallel-driving.vehicle-detail.preflight-c-reason-not-in-list')
  }
  if (r.productId !== PARALLEL_JOYSTICK_PRODUCT_ID) {
    return $t('parallel-driving.vehicle-detail.preflight-c-reason-joystick-only')
  }
  if (r.state !== 'online') {
    return $t('parallel-driving.vehicle-detail.preflight-c-reason-offline')
  }
  return ''
})
const selectedVideoDirections = ref<string[]>(['front', 'back', 'left', 'right'])
const hasFrontCameraSelected = computed(() => selectedVideoDirections.value.includes('front'))
const hasBackCameraSelected = computed(() => selectedVideoDirections.value.includes('back'))
/** 各布局均只播放已勾选方向（与「前全宽」一致）；未勾选则不拉流。「左中右」+挂后：左列左+挂后左、右列右+挂后右 */
const showRearHitchCams = ref(true)
const showFrontAuxGuide = ref(true)
const showSideAuxGuide = ref(false)  // 左右辅助线默认不选中
try {
  const f = localStorage.getItem(FRONT_AUX_GUIDE_LS_KEY)
  const s = localStorage.getItem(SIDE_AUX_GUIDE_LS_KEY)
  const leg = localStorage.getItem(FRONT_DISTANCE_GUIDE_LEGACY_LS_KEY)
  if (f === '0') showFrontAuxGuide.value = false
  else if (f === '1') showFrontAuxGuide.value = true
  else if (leg === '0') showFrontAuxGuide.value = false
  else if (leg === '1') showFrontAuxGuide.value = true
  if (s === '0') showSideAuxGuide.value = false
  else if (s === '1') showSideAuxGuide.value = true
  else if (leg === '0') showSideAuxGuide.value = false
  else if (leg === '1') showSideAuxGuide.value = true
} catch {
  /* ignore */
}
watch(showFrontAuxGuide, (v) => {
  try {
    localStorage.setItem(FRONT_AUX_GUIDE_LS_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}, { immediate: true })
watch(showSideAuxGuide, (v) => {
  try {
    localStorage.setItem(SIDE_AUX_GUIDE_LS_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
})
const LAYOUT_STORAGE_KEY = 'parallel-driving-layout-mode'
const layoutMode = ref<'a' | 'b' | 'c' | 'd' | 'e'>(
  (() => {
    if (
      props.presentation === 'remote-focus' ||
      String(route.query.mode || '') === 'remote-focus'
    ) {
      return 'e'
    }
    const v = localStorage.getItem(LAYOUT_STORAGE_KEY) as string
    if (v === 'b') return 'd'
    return v === 'a' || v === 'c' || v === 'd' || v === 'e' ? v : 'd'
  })(),
)
watch(layoutMode, (v) => {
  if (isRemoteFocusEntry.value) return
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, v)
  } catch {
    /* ignore */
  }
})

watch(
  isRemoteFocusEntry,
  (v) => {
    if (v) layoutMode.value = 'e'
  },
  { immediate: true },
)

/** 视频区外层 class：远控页恒为左中右，避免 layoutMode 与 localStorage 对齐前误用驾驶视图样式 */
const layoutSectionClass = computed(() => {
  if (isRemoteFocusEntry.value) return 'layout-mode-e'
  return `layout-mode-${layoutMode.value}`
})

/** 挂后仅「左中右」布局在左右列叠放辅路；非 e 时勾选则切到 e */
watch(showRearHitchCams, (on) => {
  if (on && layoutMode.value !== 'e') {
    layoutMode.value = 'e'
    onlyMessage($t('parallel-driving.vehicle-detail.rear-hitch-switched-layout'))
  }
})

const RC_PREFLIGHT_LS_KEY = 'pd_vehicle_detail_rc_preflight'
const readRemotePrefFromLs = () => {
  try {
    const raw = localStorage.getItem(RC_PREFLIGHT_LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<{
      epb: boolean
      horn: boolean
      low: boolean
      high: boolean
      aux: boolean
      hazard: boolean
      drive: number
    }>
  } catch {
    return null
  }
}
const preflightInit = readRemotePrefFromLs()
const remotePrefEpb = ref(preflightInit?.epb === true)
const remotePrefHorn = ref(preflightInit?.horn === true)
const remotePrefLowBeam = ref(preflightInit?.low === true)
const remotePrefHighBeam = ref(preflightInit?.high === true)
const remotePrefAuxLight = ref(preflightInit?.aux === true)
const remotePrefHazard = ref(preflightInit?.hazard === true)
const remotePrefDriveMode = ref(
  [0, 1, 2].includes(Number(preflightInit?.drive)) ? (preflightInit!.drive as 0 | 1 | 2) : 0
)
const saveRemotePrefToLs = () => {
  try {
    localStorage.setItem(
      RC_PREFLIGHT_LS_KEY,
      JSON.stringify({
        epb: remotePrefEpb.value,
        horn: remotePrefHorn.value,
        low: remotePrefLowBeam.value,
        high: remotePrefHighBeam.value,
        aux: remotePrefAuxLight.value,
        hazard: remotePrefHazard.value,
        drive: remotePrefDriveMode.value,
      })
    )
  } catch {
    /* ignore */
  }
}
watch(
  [remotePrefEpb, remotePrefHorn, remotePrefLowBeam, remotePrefHighBeam, remotePrefAuxLight, remotePrefHazard, remotePrefDriveMode],
  saveRemotePrefToLs
)

/** 远控预置开关（EPB/HORN/LOW_BEAM/HIGH_BEAM/AUX_LIGHT/HAZARD_LIGHT）：toggle 立即下发指令 */
const handlePrefSwitchChange = async (
  controlType: 'EPB' | 'HORN' | 'LOW_BEAM' | 'HIGH_BEAM' | 'AUX_LIGHT' | 'HAZARD_LIGHT',
  checked: boolean
) => {
  const cid = selectedCockpitId.value
  const vid = vehicle.value?.deviceId
  if (!cid || !vid) return
  try {
    await sendControlCommand({ cockpitDeviceId: cid, vehicleDeviceId: vid, controlType, params: { on: checked ? 1 : 0 } })
  } catch (err) {
    console.warn('handlePrefSwitchChange', controlType, err)
  }
}

/** 驾驶模式切换：更新偏好并下发命令到车端。
 *  uiDriveMode 会随后被 chassis_status.drive_mode 的 watch 同步为实车状态；
 *  若命令被车端拒绝（如刹车接管中），radio 会自动回弹到实际模式。 */
const handleDriveModeChange = async (e: { target: { value: number } }) => {
  const mode = e.target.value as 0 | 1 | 2
  if (mode === 0) {
    onlyMessage($t('parallel-driving.vehicle-detail.drive-mode-manual-forbidden'), 'warning')
    return
  }
  uiDriveMode.value = mode
  remotePrefDriveMode.value = mode
  const cid = selectedCockpitId.value
  const vid = vehicle.value?.deviceId
  if (!cid || !vid) return
  try {
    await sendControlCommand({ cockpitDeviceId: cid, vehicleDeviceId: vid, controlType: 'DRIVE_MODE', params: { mode } })
  } catch (err) {
    console.warn('handleDriveModeChange', err)
  }
}

const takingOver = ref(false)
const releasing = ref(false)
const isControlling = ref(false)
const vehicleStatus = reactive<Record<string, any>>({})

// MRC 紧急停车状态：0=正常, 1=MRC0, 2=MRC1, 3=MRC2（M/A/R 任意模式均可触发）
const mrcStatus = ref<0|1|2|3>(0)
let mrcPendingLevel: 0|1|2|3 | null = null
/** MRC1 圆形按钮：点击即下发 MRC1 */
const mrc1BtnRef = ref<HTMLElement | null>(null)

// ── 可拖动位置（默认右上角），持久化到 localStorage ──
const MRC1_POS_LS_KEY = 'pd_mrc1_btn_pos'
const readMrc1Pos = (): { top: string; left: string } => {
  try {
    const raw = localStorage.getItem(MRC1_POS_LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 旧版存储 right（中列坐标系），容器已变为右列 left，直接重置默认
      if (parsed.right != null && parsed.left == null) {
        return { top: '12px', left: '12px' }
      }
      const top = parsed.top || '12px'
      const left = parsed.left || '12px'
      // 坐标明显不对（从旧容器带过来的值），重置
      if (parseInt(left) > 60 || parseInt(top) > 60) {
        return { top: '12px', left: '12px' }
      }
      return { top, left }
    }
  } catch { /* ignore */ }
  return { top: '12px', left: '12px' }
}
const mrc1Pos = reactive(readMrc1Pos())
const mrc1BtnStyle = computed(() => ({
  top: mrc1Pos.top,
  left: mrc1Pos.left,
  right: 'auto',
  bottom: 'auto',
}))

const isDraggingMrc1 = ref(false)
let mrc1DragStart = { x: 0, y: 0, top: 0, left: 0 }

const startDragMrc1 = (e: MouseEvent | TouchEvent) => {
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
  const parent = (e.currentTarget as HTMLElement).parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  isDraggingMrc1.value = true
  mrc1DragStart = {
    x: clientX,
    y: clientY,
    top: parseInt(mrc1Pos.top) || 12,
    left: parseInt(mrc1Pos.left) || 12,
  }
  const onMove = (ev: MouseEvent | TouchEvent) => {
    if (!isDraggingMrc1.value) return
    const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
    const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY
    const dx = mrc1DragStart.x - cx
    const dy = cy - mrc1DragStart.y
    // 上下边界：按钮在父容器内
    const maxTop = Math.max(0, rect.height - 104)
    const newTop = Math.max(0, Math.min(maxTop, mrc1DragStart.top + dy))
    const maxLeft = Math.max(0, rect.width - 104)
    const newLeft = Math.max(0, Math.min(maxLeft, mrc1DragStart.left - dx))
    mrc1Pos.top = `${Math.round(newTop)}px`
    mrc1Pos.left = `${Math.round(newLeft)}px`
  }
  const onEnd = () => {
    isDraggingMrc1.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('touchmove', onMove)
    document.removeEventListener('touchend', onEnd)
    try { localStorage.setItem(MRC1_POS_LS_KEY, JSON.stringify({ top: mrc1Pos.top, left: mrc1Pos.left })) } catch { /* ignore */ }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
  document.addEventListener('touchmove', onMove)
  document.addEventListener('touchend', onEnd)
}

const handleMrc1BadgeClick = async () => {
  if (isDraggingMrc1.value) return
  const cid = selectedCockpitId.value
  const vid = vehicle.value?.deviceId
  if (!cid || !vid) {
    onlyMessage('请先选择驾驶仓', 'warning')
    return
  }
  const isActive = Number(vehicleStatus.mrcStatus) === 2
  const level = isActive ? 0 : 2  // 激活→恢复正常, 正常→下发MRC1
  const label = isActive ? 'MRC0（恢复正常）' : 'MRC1（紧急制动）'
  try {
    await sendControlCommand({ cockpitDeviceId: cid, vehicleDeviceId: vid, controlType: 'MRC', params: { mrc_status: level } })
    onlyMessage(`已下发 ${label}`)
  } catch (err) {
    console.warn('[MRC1 badge] send failed', err)
    onlyMessage(`${label} 下发失败`, 'error')
  }
}

const handleMrcChange = (val: any) => {
  const level = (val?.target?.value ?? val) as 0|1|2|3
  console.log('[MRC] level=', level, 'prev=', mrcStatus.value, 'cid=', selectedCockpitId.value, 'vid=', vehicle.value?.deviceId)
  if (level === mrcStatus.value) return
  const prevLevel = mrcStatus.value
  // 先切换 radio 视觉
  mrcStatus.value = level
  const mrcLabels = ['正常', 'MRC0', 'MRC1', 'MRC2']
  Modal.confirm({
    title: '确认 MRC 紧急停车',
    content: `确定将 MRC 状态从「${mrcLabels[prevLevel]}」切换为「${mrcLabels[level]}」？`,
    okText: '确定',
    cancelText: '取消',
    okType: level > 0 ? 'danger' : 'primary',
    wrapClassName: 'pd-mrc-confirm-dark',
    onOk: async () => {
      const cid = selectedCockpitId.value
      const vid = vehicle.value?.deviceId
      if (!cid || !vid) {
        onlyMessage('请先选择驾驶仓', 'warning')
        mrcStatus.value = prevLevel
        return
      }
      try {
        await sendControlCommand({ cockpitDeviceId: cid, vehicleDeviceId: vid, controlType: 'MRC', params: { mrc_status: level } })
      } catch (err) {
        console.warn('[MRC] send failed', err)
        mrcStatus.value = prevLevel
      }
    },
    onCancel: () => {
      mrcStatus.value = prevLevel
    },
  })
}

/**
 * Sync uiDriveMode (radio display) from actual vehicle mode reported via chassis_status.
 * This keeps the M/A/R radio in sync with reality after brake takeover (R→M),
 * ADS exit (A→M), or any other mode change not initiated by this page.
 *
 * remotePrefDriveMode is intentionally NOT synced here — it only changes on explicit
 * user clicks, so takeover preflight always uses the user's last intentional choice.
 */
watch(
  () => vehicleStatus.drivemode,
  (mode) => {
    if (mode == null) return  // no chassis data yet, keep initial value from localStorage
    const m = Number(mode)
    if (![0, 1, 2].includes(m)) return
    if (uiDriveMode.value !== m) {
      uiDriveMode.value = m as 0 | 1 | 2
    }
  },
)

/** 驾驶模式偏好：仅存储用户最后一次主动点击的值，用于接管预置；不随底盘状态变化 */
/** uiDriveMode：radio 显示值，自动同步自 chassis_status.drive_mode（实车状态） */
const uiDriveMode = ref<0 | 1 | 2>(
  [0, 1, 2].includes(Number(remotePrefDriveMode.value)) ? (remotePrefDriveMode.value as 0 | 1 | 2) : 0
)
const emergencyStopping = ref(false)
const isFullscreen = ref(false)
/** 暗黑顶栏条带：浏览器全屏或与「远控工作台」新开页同源 */
const remoteFocusFullscreenUi = computed(
  () => isFullscreen.value || isRemoteFocusEntry.value
)
const fullscreenRef = ref<HTMLElement | null>(null)
const videoSectionRef = ref<HTMLElement | null>(null)

const VIDEO_ASPECT_RATIO = 960 / 768

const sectionSize = reactive({ w: 0, h: 0 })
let sectionRO: ResizeObserver | null = null

const drivingFrontFlex = computed(() => {
  if (!sectionSize.w || !sectionSize.h) return 703
  const containerAR = sectionSize.w / sectionSize.h
  const fraction = VIDEO_ASPECT_RATIO / containerAR
  return Math.round(Math.min(0.85, Math.max(0.5, fraction)) * 1000)
})
const drivingSideFlex = computed(() => 1000 - drivingFrontFlex.value)

watch(isControlling, (v) => {
  if (v) {
    nextTick(() => {
      if (videoSectionRef.value) {
        sectionRO = new ResizeObserver((entries) => {
          const r = entries[0]?.contentRect
          if (r) { sectionSize.w = r.width; sectionSize.h = r.height }
        })
        sectionRO.observe(videoSectionRef.value)
      }
    })
  } else {
    sectionRO?.disconnect()
    sectionRO = null
  }
})

/** 全屏时下拉挂到全屏容器内，便于 scoped 深色样式命中 */
const cockpitSelectGetPopupContainer = (triggerNode: HTMLElement) => {
  if ((isFullscreen.value || isRemoteFocusEntry.value) && fullscreenRef.value) {
    return fullscreenRef.value
  }
  return triggerNode.parentElement || document.body
}
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 5000 // 5秒轮询一次，更新在线状态和远控状态

// 视频流配置（app 与 WVP/ZLM 流路径一致，取当前车辆 internalCode）
const VIDEO_CONFIG = {
  // ZLM 流媒体服务器地址
  baseUrl: 'http://10.7.30.44',
  // baseUrl: 'http://100.65.210.220',
  protocol: 'webrtc' as 'webrtc' | 'm3u8' | 'flv',
  streams: {
    front: 'cam_f_12',
    left: 'ipm',
    // right: 'cam_r_13',
    right: 'cam_f_7',
    back: 'cam_b_18',
    // rear_left: 'cam_l_19',
    // rear_right: 'cam_r_17',
    rear_left: 'cam_lb_4',
    rear_right: 'cam_rb_10'
  },
  abr: {
    enabled: false,
    layers: ['_high', '_mid', '_low'] as const,
  },
  // 车端 stream_settings.yml simulcast.enabled。关闭时流名无 _high/_mid/_low 后缀。
  simulcastEnabled: false,
}

/** ABR 层级列表（所有流共用） */
const ABR_LAYERS = ['_high', '_mid', '_low'] as const

/** 摄像头方向 → ABR 策略预设映射 */
const ABR_PRESET_MAP: Record<string, 'critical' | 'high' | 'normal' | 'low'> = {
  front: 'critical',
  back: 'high',
  left: 'normal',
  right: 'normal',
  rear_left: 'low',
  rear_right: 'low',
}

/** 根据流 key 获取 ABR 策略预设 */
const getAbrPreset = (key: string): 'critical' | 'high' | 'normal' | 'low' | undefined => {
  if (!VIDEO_CONFIG.abr.enabled) return undefined
  return ABR_PRESET_MAP[key]
}

/** 获取 ABR 层级列表（关闭时返回 undefined） */
const getAbrLayers = (): string[] | undefined => {
  if (!VIDEO_CONFIG.abr.enabled) return undefined
  return [...ABR_LAYERS]
}

const videoStreamApp = computed(() => {
  const raw = vehicle.value?.internalCode
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : ''
})

/** 仅用于拉流：业务上每台车 internalCode 入详情后即固定，仅在换车时变——首次拿到非空后写入并按路由锁住，poll 再也不会把 app「写没」触发全路重连黑屏 */
const lockedPlaybackInternalCodeByRouteId = ref<Record<string, string>>({})

watch(
  () => ({ id: vehicleId.value, code: videoStreamApp.value }),
  ({ id, code }) => {
    if (!id || !code) return
    if (lockedPlaybackInternalCodeByRouteId.value[id]) return
    lockedPlaybackInternalCodeByRouteId.value = {
      ...lockedPlaybackInternalCodeByRouteId.value,
      [id]: code,
    }
  },
  { immediate: true },
)

/** 详情内多路播放器统一用锁定后的 app（无锁且尚未拉到码时为空，不强行播） */
const videoStreamAppPlayback = computed(() => {
  const id = vehicleId.value
  if (!id) return ''
  return lockedPlaybackInternalCodeByRouteId.value[id] || '' // 'netbird'
})

// 协议：webrtc 低延迟 | m3u8(HLS) | flv
// 若 webrtc 报「连接失败: failed」，可临时改为 protocol: 'm3u8' 用 HLS（延迟较高但更稳定）
// const VIDEO_CONFIG = {
//   baseUrl: 'http://iot.intra.zeron.ai',
//   app: 'localtest',
//   protocol: 'webrtc' as 'webrtc' | 'm3u8' | 'flv',
//   streams: {
//     front: 'cam_lf_6',
//     left: 'cam_f_2',
//     right: 'cam_l_5',
//     back: 'cam_lb_4',
//   },
// }

const getVideoStream = (key: string) => {
  /** 与「前全宽」一致：仅勾选的方向拉流；全不勾选则不播放该路 */
  if (!selectedVideoDirections.value.includes(key)) return null
  const base = (VIDEO_CONFIG.streams as Record<string, string>)[key] || null
  if (!base) return null
  // simulcast off → 流名无后缀；ABR off + simulcast on → 固定 _high；ABR on → 由 WebRtcPlayer 内部拼后缀
  if (!VIDEO_CONFIG.simulcastEnabled) return base
  if (!VIDEO_CONFIG.abr.enabled) return `${base}_high`
  return base
}

const getVideoUrl = (key: string) => {
  const stream = getVideoStream(key)
  if (!stream) return ''
  const app = videoStreamAppPlayback.value
  if (!app) return ''
  const { baseUrl, protocol } = VIDEO_CONFIG
  if (protocol === 'm3u8') return `${baseUrl}/${app}/${stream}/hls.m3u8`
  if (protocol === 'flv') return `${baseUrl}/${app}/${stream}.live.flv`
  return '' // webrtc 用 WebRtcPlayer，不走 url
}

/** 挂后辅路：cam_b_17 / cam_b_19，仅勾选「挂后」且在左中右布局中启用 */
const getHitchStream = (key: 'rear_left' | 'rear_right'): string | null => {
  if (!showRearHitchCams.value) return null
  const base = (VIDEO_CONFIG.streams as Record<string, string>)[key] ?? null
  if (!base) return null
  if (!VIDEO_CONFIG.simulcastEnabled) return base
  if (!VIDEO_CONFIG.abr.enabled) return `${base}_high`
  return base
}

const getHitchVideoUrl = (key: 'rear_left' | 'rear_right') => {
  const stream = getHitchStream(key)
  if (!stream) return ''
  const app = videoStreamAppPlayback.value
  if (!app) return ''
  const { baseUrl, protocol } = VIDEO_CONFIG
  if (protocol === 'm3u8') return `${baseUrl}/${app}/${stream}/hls.m3u8`
  if (protocol === 'flv') return `${baseUrl}/${app}/${stream}.live.flv`
  return ''
}

/** 档位格式化：0=P, 1=R, 2=N, 3=D（与 e2e_control_v2 requested_gear 编码一致） */
const formatGear = (gear: number | undefined) => {
  if (gear == null) return '-'
  const map: Record<number, string> = { 0: 'P', 1: 'R', 2: 'N', 3: 'D' }
  return map[gear] ?? String(gear)
}

/** HUD 左侧 P/R/N/D：0=P,1=R,2=N,3=D */
const HUD_GEAR_LETTERS = ['P', 'R', 'N', 'D'] as const
const isHudGearActive = (index: number, gear: number | undefined) => {
  if (gear == null || !Number.isFinite(Number(gear))) return false
  return Number(gear) === index
}

const formatNumber = (val: any, digits = 0, fallback = '--') => {
  if (val == null) return fallback
  const n = Number(val)
  if (!Number.isFinite(n)) return fallback
  return digits > 0 ? n.toFixed(digits) : String(Math.round(n))
}

/** 驾驶模式 HUD：0=Manual→M，1=Auto→A，2=Remote→R */
const hudDriveModeChar = (dm: any) => {
  const n = Number(dm)
  if (n === 0) return 'M'
  if (n === 1) return 'A'
  if (n === 2) return 'R'
  return '–'
}

const hudDriveModeClass = (dm: any) => {
  const n = Number(dm)
  if (n === 0) return 'is-manual'
  if (n === 1) return 'is-auto'
  if (n === 2) return 'is-remote'
  return 'is-unknown'
}

/**
 * Layout-E 主画面/ PiP 是否切到「倒车」视图（后为主）。
 * CAN 的 vcu_veh_curr_gear 在 R(14) 与 Invalid(15)/N 间抖动时，gear 会在 1 与 非 1 间跳，
 * 若直接绑定会前后层 CSS 来回切导致闪跳；用滞回需连续多帧确认再切换。HUD 档位仍用 vehicleStatus.gear 实时值。
 */
const REVERSE_LAYOUT_ON_FRAMES = 3
const REVERSE_LAYOUT_OFF_FRAMES = 3
let reverseLayoutScore = 0
const isReverse = ref(false)

const syncReverseLayoutFromGear = (gear: number | undefined) => {
  const isR = Number(gear) === 1
  if (isR) {
    reverseLayoutScore = Math.min(REVERSE_LAYOUT_ON_FRAMES, reverseLayoutScore + 1)
    if (reverseLayoutScore >= REVERSE_LAYOUT_ON_FRAMES) isReverse.value = true
  } else {
    reverseLayoutScore = Math.max(-REVERSE_LAYOUT_OFF_FRAMES, reverseLayoutScore - 1)
    if (reverseLayoutScore <= -REVERSE_LAYOUT_OFF_FRAMES) isReverse.value = false
  }
}

/** 前视辅助线：用户开启且非倒车（R 档滞回，与中间 PiP/主画一致） */
const showFrontAuxGuideVisible = computed(() => showFrontAuxGuide.value && !isReverse.value)
provide('showFrontAuxGuide', showFrontAuxGuide)
provide('showSideAuxGuide', showSideAuxGuide)
provide('showFrontAuxGuideVisible', showFrontAuxGuideVisible)

/** 前视标定测量宿主：与 `sideGuideOverlayRectInWrapper` / `useVideoCalibrationOverlayRect` 一致 */
const frontVideoCalibHostRef = ref<HTMLElement | null>(null)
const { overlayStyle: frontVideoOverlayStyle } = useVideoCalibrationOverlayRect(
  frontVideoCalibHostRef,
  showFrontAuxGuideVisible
)

/** 方案 C：前视绘制层铺满 layout-c-video-wrap；标定对齐由引导层与 HUD 行内 rect 负责 */
const layoutCFrontPaintStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  width: '100%',
  height: '100%',
  zIndex: '1',
}))

/**
 * 左中右布局(e) flex 比例计算
 *
 * 视频 960×768 → AR=1.25。中间占满全高，宽度 = h × 1.25；
 * 左右各占剩余空间的一半。保底：中间 50~85%，两侧各 ≥7.5%
 */
/** 左中右布局(e)：中间 flex 占比，左右各占剩余一半 */
const LAYOUT_E_CENTER_RATIO = 0.46
const layoutECenterFlex = Math.round(LAYOUT_E_CENTER_RATIO * 1000)
const layoutESideFlex = Math.round((1000 - layoutECenterFlex) / 2)

/** 未勾选挂后：与原先一致，仅传 flex 数值；勾选挂后再用 shrink:0 避免列宽被压没 */
const layoutESideColumnStyle = computed(() => {
  if (!showRearHitchCams.value) return { flex: layoutESideFlex }
  return { flex: `${layoutESideFlex} 0 0%` }
})

const HUD_SPEED_MAX = 120
const speedBarPercent = computed(() => {
  const s = vehicleStatus.speed
  if (s == null || !Number.isFinite(Number(s))) return '0%'
  const pct = Math.min(100, (Number(s) / HUD_SPEED_MAX) * 100)
  return `${Math.round(pct)}%`
})

/** HUD 电量条：与实时车况仪表一致，低电量用颜色强调（非唯一信息载体，保留数值与 aria） */
const hudSocStripClass = computed(() => {
  const n = Number(vehicleStatus.soc)
  if (!Number.isFinite(n)) return ''
  if (n < 10) return 'is-critical'
  if (n < 20) return 'is-low'
  return ''
})

const hudSocAriaLabel = computed(() => {
  const n = Number(vehicleStatus.soc)
  if (!Number.isFinite(n)) return '高压电量未知'
  return `高压电量 ${Math.round(n)}%`
})

/** HUD 电池图标内芯宽度（viewBox 内与外壳内廓对齐，最大 16 ≈ 18 - 左右各 1 边距） */
const hudSocIconFillWidth = computed(() => {
  const n = Number(vehicleStatus.soc)
  if (!Number.isFinite(n)) return 0
  const pct = Math.max(0, Math.min(100, n))
  return (pct / 100) * 16
})

const isLeftTurnOn = computed(() => Number(vehicleStatus.leftTurnSignal) === 1)
const isRightTurnOn = computed(() => Number(vehicleStatus.rightTurnSignal) === 1)
const isHazardOn = computed(() => isLeftTurnOn.value && isRightTurnOn.value)

/** 近光 / 远光：applyChassisStatus 汇总 CGW 左右任一侧为 1；与实车一致先近光、远光单独拉 */
const isHudLowBeamOn = computed(() => Number(vehicleStatus.lowBeamOn) === 1)
const isHudHighBeamOn = computed(() => Number(vehicleStatus.highBeamOn) === 1)

/**
 * HUD 单槽大灯：默认始终用近光图标（HudHeadlightBeamIcon high=false）；
 * 仅当远光信号为 1 时切换为远光图标。全关时仍为近光轮廓、不点亮（is-lit false）。
 */
const hudBeamLampClass = computed(() => {
  const high = isHudHighBeamOn.value
  const low = isHudLowBeamOn.value
  return {
    'hud-beam-lamp-low': !high,
    'hud-beam-lamp-high': high,
    'is-lit': high ? true : low,
  }
})

const hudBeamTitle = computed(() =>
  isHudHighBeamOn.value
    ? '远光灯：cgw_left_high_beam_light_sts / cgw_right_high_beam_lamp_sts（任一侧为 1）'
    : '近光灯：cgw_left_low_beam_lamp_sts / cgw_right_low_beam_lamp_sts（任一侧为 1）'
)

const hudBeamAriaLabel = computed(() => {
  const high = isHudHighBeamOn.value
  const low = isHudLowBeamOn.value
  if (high && low) return '前大灯：近光与远光均开启'
  if (high) return '前大灯：远光灯开启'
  if (low) return '前大灯：近光灯开启'
  return '近光灯：关闭'
})

/** 手刹、喇叭（远近光见上方 HudHeadlightBeamIcon） */
const hudEpbOn = computed(() => Number(vehicleStatus.vcuEpbParkBrkSts) === 1)
const hudHornOn = computed(() => Number(vehicleStatus.cgwHornCtrlSts) === 1)

/** 前视 WebRTC 画面角标：仅展示 cloud_link_network_rtt_ms（需 NTP） */
const showFrontCloudLinkRtt = computed(
  () => (isControlling.value || isVehicleOnline.value) && VIDEO_CONFIG.protocol === 'webrtc'
)

/** 车端 vcu_steer_angle：数值与转角文案仍用小阈值；方向箭头单独用死区，避免 CAN 噪声在 center/左/右 间抖动导致 HUD 闪跳 */
const STEER_ANGLE_EPS = 1e-6
/** 仅用于 steerDir（箭头类名/着色），略大于常见零漂，D 档直行时更稳 */
const STEER_DIR_DEADBAND_DEG = 1.35
const steerDir = computed(() => {
  const n = Number(vehicleStatus.steering)
  if (!Number.isFinite(n)) return 'center'
  if (Math.abs(n) <= STEER_DIR_DEADBAND_DEG) return 'center'
  return n > 0 ? 'left' : 'right'
})

/** 转向图标无障碍说明 */
const steerAriaLabel = computed(() => {
  switch (steerDir.value) {
    case 'left':
      return '左转'
    case 'right':
      return '右转'
    default:
      return '直行'
  }
})

/** 与方向一致的角度展示：左/右为绝对值+°，中间为 0°，无数据为 -- */
const steerDegreeText = computed(() => {
  const n = Number(vehicleStatus.steering)
  if (!Number.isFinite(n)) return '--'
  if (Math.abs(n) <= STEER_ANGLE_EPS) return '0°'
  return `${Math.round(Math.abs(n))}°`
})

/** 前轮（转向节）转角：vcu_steer_angle 经非线性传动比换算，与 VehicleMode::TransToWheelAngleFromSteerAngle 一致 */
const steerKnuckleDegreeText = computed(() => {
  const n = Number(vehicleStatus.steering)
  if (!Number.isFinite(n)) return '--'
  const w = wheelAngleDegFromSteerAngleDeg(n)
  if (w == null || !Number.isFinite(w)) return '--'
  if (Math.abs(w) <= STEER_ANGLE_EPS) return '0°'
  return `${Math.round(Math.abs(w))}°`
})

/** 带符号前轮角（°），供 HUD 工字形示意图旋转 */
const steerKnuckleDegSigned = computed((): number | null => {
  const n = Number(vehicleStatus.steering)
  if (!Number.isFinite(n)) return null
  const w = wheelAngleDegFromSteerAngleDeg(n)
  if (w == null || !Number.isFinite(w)) return null
  return w
})

/** 前视 0.5m 横向标线左右端点（与 FrontCameraDistanceGuide 归一化坐标一致），用于把 HUD 前轮示意锚在引导线端点上 */
const frontGuideHalfMeterRow = computed(
  () => DEFAULT_FRONT_GUIDE_ROWS.find((r) => r.distanceM === 0.5) ?? DEFAULT_FRONT_GUIDE_ROWS[0]
)

function hudWheelGuideAnchorPosition(side: 'left' | 'right'): Record<string, string> {
  const r = frontGuideHalfMeterRow.value
  const p = side === 'left' ? r.left : r.right
  return {
    left: `${p.x * 100}%`,
    top: `${p.y * 100}%`,
  }
}

const getDictValue = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.value || val.getValue?.() || ''
}

const normalizeState = (val: any) => getDictValue(val).toString().toLowerCase()
const isActiveState = (val: any) => normalizeState(val) === 'active'
const isReleasableSessionState = (val: any) => {
  const s = normalizeState(val)
  return s === 'binding' || s === 'active' || s === 'releasing'
}
const isVehicleOnline = computed(() => vehicle.value?.state?.value === 'online')

/**
 * 视频区是否挂载：远控工作台在已有 vehicle 数据后始终挂载网格（与在线轮询解耦），避免
 * `isVehicleOnline` 抖动导致整块 `v-if` 卸载→全路 WebRtcPlayer 重建。详情页/嵌入仍为「接管或在线」。
 */
const showVideoMonitoringSection = computed(
  () =>
    !!vehicle.value &&
    (isRemoteFocusEntry.value || isControlling.value || isVehicleOnline.value),
)

const canCloudRelease = computed(() => {
  const v = vehicle.value
  if (!v) return false
  const candidateCockpitId = selectedCockpitId.value || v.boundCockpitId
  return isControlling.value || (isReleasableSessionState(v.sessionState) && !!candidateCockpitId)
})

const getSessionStateText = (state: any) => {
  let s = normalizeState(state)
  if (!s) return $t('parallel-driving.vehicle-list.not-bound')
  // 若含多个状态（如 "active,released"），取最后一个作为当前状态，避免显示矛盾文案
  if (s.includes(',')) {
    s = s.split(',').map((x: string) => x.trim()).filter(Boolean).pop() || s
  }
  const map: Record<string, string> = {
    binding: $t('parallel-driving.vehicle-list.state-binding'),
    active: $t('parallel-driving.vehicle-list.state-active'),
    releasing: $t('parallel-driving.vehicle-list.state-releasing'),
    released: $t('parallel-driving.vehicle-list.state-released'),
  }
  return map[s] || s
}

const getSessionStateColor = (state: any) => {
  let s = normalizeState(state)
  if (s?.includes(',')) {
    s = s.split(',').map((x: string) => x.trim()).filter(Boolean).pop() || s
  }
  const map: Record<string, string> = {
    binding: 'orange',
    active: 'green',
    releasing: 'orange',
    released: 'default',
  }
  return map[s] || 'default'
}

const getStateColor = (state: string) => {
  const map: Record<string, string> = {
    online: 'green',
    offline: 'red',
    notActive: 'orange',
  }
  return map[state || ''] || 'default'
}

// chassis_status(100ms) -> 面板字段映射（不改车端 payload，前端直接映射）
/**
 * CAN vcu_veh_curr_gear → 前端统一编码
 * CAN: 0=N, 1=D1, 2=D2, 3=D3, 4=AM1, 5=AM2, 6=AM3, 14=R, 15=Invalid
 * 前端: 0=P, 1=R, 2=N, 3=D
 */
const mapGear = (val: any): number | undefined => {
  if (val == null) return undefined
  const n = Number(val)
  if (!Number.isFinite(n)) return undefined
  if (n === 0) return 2              // CAN N档 → 前端 N(2)
  if (n >= 1 && n <= 6) return 3     // CAN D1~AM3 → 前端 D(3)
  if (n === 14) return 1             // CAN R档 → 前端 R(1)
  if (n === 15) return undefined     // Invalid
  return undefined                   // Reserved(7~13)
}

// 车速系数：车端若为 0.1 km/h 分辨率则设为 0.1，否则 1（原始值即 km/h）
const VEHICLE_SPEED_SCALE = 1

/** 油门/制动 HUD 灯：模拟滞回，避免扭矩、油压临界时 0/1 每 100ms 翻转导致底栏闪跳 */
let hudAccelLitLatched = false
let hudBrakeLitLatched = false

const applyChassisStatusToVehicleStatus = (properties: Record<string, any>) => {
  // properties 可能包含：
  // - chassis_status: { vcu_xxx: ... }
  // - 或直接平铺 vcu_xxx 字段
  const chassis = (properties as any).chassis_status
  const raw = chassis && typeof chassis === 'object' ? chassis : properties

  // 车速
  const speed = raw.vcu_vcu_vehicle_spd
  // 档位
  const gear = raw.vcu_veh_curr_gear ?? raw.vcu_curr_gear_ctrl_mod
  // 转向
  const steering = raw.vcu_steer_angle
  // 驾驶模式 0=Manual, 1=Auto
  const drivemodeRaw = raw.drive_mode ?? raw.vcu_vcu_pt_ctrl_auto_sts

  // const spdReq = Number(raw.adcu_spd_req)
  // const extAcc = Number(raw.adcu_ext_acc_demand)
  const tqRaw = Number(raw.vcu_drv_req_pct_tq)
  if (Number.isFinite(tqRaw)) {
    if (tqRaw >= 1.2) hudAccelLitLatched = true
    else if (tqRaw <= 0.35) hudAccelLitLatched = false
  }
  const fa = Number(raw.vcu_brk_prs_fa_left)
  const ra = Number(raw.vcu_brk_prs_ra1_left)
  if (Number.isFinite(fa) || Number.isFinite(ra)) {
    const faV = Number.isFinite(fa) ? fa : 0
    const raV = Number.isFinite(ra) ? ra : 0
    if (faV > 12 || raV > 12) hudBrakeLitLatched = true
    else if (faV < 6 && raV < 6) hudBrakeLitLatched = false
  }

  const patch: Record<string, any> = {}
  const speedNum = Number(speed)
  if (Number.isFinite(speedNum)) patch.speed = speedNum * VEHICLE_SPEED_SCALE // 1 = 直接显示原始值
  const gearNum = mapGear(gear)
  if (gearNum != null) patch.gear = gearNum
  const steerNum = Number(steering)
  if (Number.isFinite(steerNum)) patch.steering = steerNum
  // HUD 油门/制动：不显示踏板百分比，仅按滞回后的逻辑点亮图标
  patch.hudAccelLit = hudAccelLitLatched ? 1 : 0
  patch.hudBrakeLit = hudBrakeLitLatched ? 1 : 0
  // 驾驶模式：0=Manual, 1=Auto（仅车端有上报时更新，避免缺字段误显示为 0）
  if (drivemodeRaw != null && drivemodeRaw !== '') {
    const dm = Number(drivemodeRaw)
    if (Number.isFinite(dm)) patch.drivemode = dm
  }

  // voc
  const soc = Number(raw.vcu_soc || 0.0)
  if (Number.isFinite(soc)) patch.soc = soc

  // 转向灯：cgw_left_turn_light_sts / cgw_right_turn_light_sts (0=off, 1=on)
  const leftTurn = raw.cgw_left_turn_light_sts
  const rightTurn = raw.cgw_right_turn_light_sts
  if (leftTurn != null) patch.leftTurnSignal = Number(leftTurn)
  if (rightTurn != null) patch.rightTurnSignal = Number(rightTurn)

  // 近/远光汇总：同实车“一起开”语义，左或右任一侧 cgw_*=1 即认为该档开启（不分别判断单侧）
  if ('cgw_left_low_beam_lamp_sts' in raw || 'cgw_right_low_beam_lamp_sts' in raw) {
    const lo = Number(raw.cgw_left_low_beam_lamp_sts) === 1
    const ro = Number(raw.cgw_right_low_beam_lamp_sts) === 1
    patch.lowBeamOn = lo || ro ? 1 : 0
  }
  if (
    'cgw_left_high_beam_light_sts' in raw ||
    'cgw_right_high_beam_lamp_sts' in raw ||
    'cgw_right_high_beam_light_sts' in raw
  ) {
    const rH =
      (raw as any).cgw_right_high_beam_lamp_sts ?? (raw as any).cgw_right_high_beam_light_sts
    const lHi = Number(raw.cgw_left_high_beam_light_sts) === 1
    const rHi = Number(rH) === 1
    patch.highBeamOn = lHi || rHi ? 1 : 0
  }

  const epbRaw = (raw as any).vcu_epb_park_brk_sts ?? (raw as any).vcu_epb_park_brk_st
  if (epbRaw != null && epbRaw !== '') {
    const n = Number(epbRaw)
    if (Number.isFinite(n)) patch.vcuEpbParkBrkSts = n === 1 ? 1 : 0
  }
  if (raw.cgw_horn_ctrl_sts != null && raw.cgw_horn_ctrl_sts !== '') {
    const n = Number(raw.cgw_horn_ctrl_sts)
    if (Number.isFinite(n)) patch.cgwHornCtrlSts = n === 1 ? 1 : 0
  }

  // 车云 RTT（ms）：顶层或 chassis 内均可
  const topRtt =
    (properties as any).cloud_link_rtt_ms ??
    (properties as any).cloudLinkRttMs
  const nestedRtt = raw.cloud_link_rtt_ms ?? raw.cloudLinkRttMs
  const rttRaw = topRtt ?? nestedRtt
  if (rttRaw != null && rttRaw !== '') {
    const n = Number(rttRaw)
    if (Number.isFinite(n)) patch.cloudLinkRttMs = Math.round(n)
  }

  const topNet =
    (properties as any).cloud_link_network_rtt_ms ??
    (properties as any).cloudLinkNetworkRttMs
  const nestedNet = raw.cloud_link_network_rtt_ms ?? raw.cloudLinkNetworkRttMs
  const netRaw = topNet ?? nestedNet
  if (netRaw != null && netRaw !== '') {
    const n = Number(netRaw)
    if (Number.isFinite(n)) patch.cloudLinkNetworkRttMs = Math.round(n)
  }

  // ── MRC 状态：health_arbitrator 裁决结果 ──
  const mrcStatusRaw = raw.mrc_status ?? (properties as any).mrc_status
  if (mrcStatusRaw != null) {
    const ms = Number(mrcStatusRaw)
    if (Number.isFinite(ms)) patch.mrcStatus = ms
  }
  if (raw.mrc_error_name != null || (properties as any).mrc_error_name != null) {
    patch.mrcErrorName = (raw.mrc_error_name ?? (properties as any).mrc_error_name) as string
  } else {
    patch.mrcErrorName = ''
  }
  const mrcTs = raw.mrc_timestamp ?? (properties as any).mrc_timestamp
  if (mrcTs != null) {
    const n = Number(mrcTs)
    if (Number.isFinite(n)) patch.mrcTimestamp = n  // epoch ms
  }

  return patch
}

/** MRC timestamp (epoch ms) → HH:MM:SS local time */
const formatMrcTimestamp = (epochMs: number | undefined): string => {
  if (epochMs == null || !Number.isFinite(epochMs)) return ''
  const d = new Date(epochMs)
  if (isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/**
 * MRC 通知：仅 2(MRC1) / 3(MRC2) / 4(MRC3) 弹 error 通知，需手动关闭。
 * 同一 key 'mrc-status'，每次新通知替换上一个。
 */
const MRC_LABELS: Record<number, string> = { 0: '正常', 1: 'MRC0', 2: 'MRC1', 3: 'MRC2', 4: 'MRC3' }
let mrcNotifyLastLevel = 0
watch(
  () => vehicleStatus.mrcStatus,
  (level: number | undefined) => {
    const lv = level != null && Number.isFinite(level) ? Math.round(level) : 0
    if (lv === mrcNotifyLastLevel) return
    mrcNotifyLastLevel = lv
    // 仅 2/3/4 弹通知
    if (lv < 2) return
    const label = MRC_LABELS[lv] || `MRC(${lv})`
    const ts = vehicleStatus.mrcTimestamp
      ? formatMrcTimestamp(vehicleStatus.mrcTimestamp as number | undefined)
      : ''
    const errName = (vehicleStatus.mrcErrorName as string) || label
    notification.error({
      key: 'mrc-status',
      message: `${label}: 不正常`,
      description: () => h('div', [
        h('div', `触发来源: ${errName}`),
        h('div', ts ? `触发时间: ${ts} | 请手动关闭` : '请手动关闭'),
      ]),
      duration: 0,
      placement: 'topRight',
    })
  },
)

const loadVehicle = async (silent = false) => {
  if (!vehicleId.value) return
  if (!silent) loading.value = true
  try {
    const result = await queryVehicles({
      pageSize: 1,
      pageIndex: 0,
      terms: [{ column: 'deviceId', termType: 'eq', value: vehicleId.value }],
    })
    const data = result?.result?.data
    const raw = data?.[0]
    if (raw) {
      vehicle.value = { ...raw }
      // 兼容 state 多种格式：字符串 / 对象(value可能大写)
      const rawState = raw.state
      if (typeof rawState === 'string') {
        const v = rawState.toLowerCase()
        vehicle.value.state = { value: v, text: v === 'online' ? '在线' : v === 'offline' ? '离线' : rawState }
      } else if (rawState && typeof rawState === 'object' && rawState.value) {
        const v = String(rawState.value).toLowerCase()
        vehicle.value.state = { value: v, text: rawState.text || (v === 'online' ? '在线' : v === 'offline' ? '离线' : v) }
      }
      // 兼容 sessionState 多种格式：字符串 / 对象
      const rawSessionState = raw.sessionState
      const SESSION_STATE_MAP: Record<string, string> = {
        binding: $t('parallel-driving.vehicle-list.state-binding'),
        active: $t('parallel-driving.vehicle-list.state-active'),
        releasing: $t('parallel-driving.vehicle-list.state-releasing'),
        released: $t('parallel-driving.vehicle-list.state-released'),
      }
      if (typeof rawSessionState === 'string') {
        const v = rawSessionState.toLowerCase()
        vehicle.value.sessionState = { value: v, text: SESSION_STATE_MAP[v] || rawSessionState }
      } else if (rawSessionState && typeof rawSessionState === 'object' && rawSessionState.value) {
        const v = String(rawSessionState.value).toLowerCase()
        vehicle.value.sessionState = { value: v, text: rawSessionState.text || SESSION_STATE_MAP[v] || v }
      }
      // 远控状态：车辆被接管则同步选中驾驶舱并标记为控制中，否则标记为未控制
      const takenOver = isActiveState(raw.sessionState) && raw.boundCockpitId
      if (takenOver) {
        selectedCockpitId.value = raw.boundCockpitId
        isControlling.value = true
      } else {
        const wasControlling = isControlling.value
        isControlling.value = false
        // 监控模式（未接管）下也会每 POLL_INTERVAL 静默轮询；切勿每次把 WS 掐掉再让 watch 重连，否则看似「无操作也在不停重连」
        if (wasControlling) {
          closeWebSocket()
        }
      }
    } else {
      if (!silent) vehicle.value = null
    }
  } catch (e) {
    if (!silent) {
      console.error('加载车辆信息失败:', e)
      onlyMessage($t('parallel-driving.vehicle-detail.load-failed'), 'error')
    }
  } finally {
    if (!silent) loading.value = false
  }
}

const loadCockpitDevices = async (keyword?: string) => {
  cockpitLoading.value = true
  try {
    // 与车辆列表、控制台一致：走设备实例查询（/device-instance/_query/no-paging），
    // 避免仅详情页使用 cockpits/_query 时因接口/权限/响应差异导致下拉无数据。
    const result = await getCockpitDevices({
      terms: keyword
        ? [{ column: 'name', termType: 'like', value: `*${keyword}*` }]
        : [],
      sorts: [{ name: 'createTime', order: 'desc' }],
    })
    const data = (result as any)?.result || []
    const mapped = (Array.isArray(data) ? data : []).map((item: any) => {
      const name = (item.deviceName || item.name || '').trim()
      const id = (item.deviceId || item.id || '').trim()
      const label = name ? `${name}(${id})` : id
      const st = item.state
      const stateVal =
        typeof st === 'string'
          ? st.toLowerCase()
          : st != null && typeof st === 'object' && (st as any).value != null
            ? String((st as any).value).toLowerCase()
            : String(st ?? '')
              .toLowerCase()
      return {
        label,
        value: id,
        state: stateVal || 'offline',
        productId: String(item.productId || '').trim(),
      }
    })
    const id = (selectedCockpitId.value || '').trim()
    if (id && !mapped.some((d) => d.value === id)) {
      const prev = cockpitDevices.value.find((d) => d.value === id)
      cockpitDevices.value = [
        prev ?? { label: id, value: id, state: 'offline', productId: '' },
        ...mapped,
      ]
    } else {
      cockpitDevices.value = mapped
    }
  } catch (e) {
    console.error('加载驾驶舱失败:', e)
    onlyMessage($t('parallel-driving.control-panel.load-cockpit-devices-failed'), 'error')
  } finally {
    cockpitLoading.value = false
  }
}

const handleCockpitSearch = (value: string) => {
  loadCockpitDevices(value)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const waitUntilSessionActive = async (cockpitId: string, vehicleId: string) => {
  const retries = 40
  for (let i = 0; i < retries; i++) {
    try {
      const res: any = await getBoundVehicle(cockpitId)
      const session = res?.result ?? res
      let state = String(session?.state ?? session?.sessionState ?? '').toLowerCase()
      if (state.includes(',')) {
        state = state
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean)
          .pop() || state
      }
      const boundVehicleId = String(session?.vehicleDeviceId ?? '')
      if (state === 'active' && (!vehicleId || boundVehicleId === vehicleId)) {
        return true
      }
    } catch {
      // Ignore transient query failures and keep polling in the short binding window.
    }
    await sleep(250)
  }
  return false
}

/** 接管会话建立后按预置项下发到车（设备侧/物模型需与 ControlType 对齐） */
const applyRemotePreflight = async () => {
  const cid = selectedCockpitId.value
  const vid = vehicle.value?.deviceId
  if (!cid || !vid) return
  const base = { cockpitDeviceId: cid, vehicleDeviceId: vid }
  let failedStep = ''
  let failedMsg = ''
  /**
   * 安全顺序：先发 DRIVE_MODE 让车端缓存生效，再发灯光/EPB。
   * 这样 remotejoystick 帧合并时已能携带正确的 drive_mode，
   * 避免 takeover 后首帧以 drive_mode=0 进入 e2e_control 的乱序窗口。
   */
  const run = async () => {
    const sendPref = async (step: string, controlType: string, params: Record<string, any>) => {
      failedStep = step
      try {
        await sendControlCommand({ ...base, controlType, params })
      } catch (e: any) {
        failedMsg =
          e?.response?.data?.result?.message ||
          e?.response?.data?.message ||
          e?.response?.result?.message ||
          e?.response?.message ||
          e?.message ||
          ''
        throw e
      }
    }

    // ① 驾驶模式优先下发：车端 cached_drive_mode_ 立即更新
    const m = remotePrefDriveMode.value
    if (m === 2) {
      if (canSelectRemoteC.value) {
        await sendPref('DRIVE_MODE', 'DRIVE_MODE', { mode: 2 })
      }
    } else {
      await sendPref('DRIVE_MODE', 'DRIVE_MODE', { mode: m })
    }
    // ② 车辆功能预置（仅 drive_mode=2 时车端才会缓存生效，其余模式忽略）
    await sendPref('EPB', 'EPB', { on: remotePrefEpb.value ? 1 : 0 })
    await sendPref('HORN', 'HORN', { on: remotePrefHorn.value ? 1 : 0 })
    await sendPref('LOW_BEAM', 'LOW_BEAM', { on: remotePrefLowBeam.value ? 1 : 0 })
    await sendPref('HIGH_BEAM', 'HIGH_BEAM', { on: remotePrefHighBeam.value ? 1 : 0 })
    await sendPref('AUX_LIGHT', 'AUX_LIGHT', { on: remotePrefAuxLight.value ? 1 : 0 })
    await sendPref('HAZARD_LIGHT', 'HAZARD_LIGHT', { on: remotePrefHazard.value ? 1 : 0 })
  }
  for (let i = 0; i < 3; i++) {
    try {
      await run()
      return
    } catch (e) {
      console.warn('applyRemotePreflight', e)
      if (i < 2) await sleep(450)
    }
  }
  const detail = [failedStep, failedMsg].filter(Boolean).join(': ')
  onlyMessage(
    detail
      ? `${$t('parallel-driving.vehicle-detail.preflight-apply-skip')} (${detail})`
      : $t('parallel-driving.vehicle-detail.preflight-apply-skip'),
    'warning',
  )
}

const handleStartRemoteControl = async () => {
  if (!selectedCockpitId.value || !vehicle.value) return
  if (vehicle.value.state?.value !== 'online') {
    onlyMessage($t('parallel-driving.vehicle-list.vehicle-offline'), 'error')
    return
  }
  if (isActiveState(vehicle.value.sessionState) && vehicle.value.boundCockpitId !== selectedCockpitId.value) {
    onlyMessage($t('parallel-driving.vehicle-list.vehicle-already-taken-over'), 'error')
    return
  }

  takingOver.value = true
  try {
    const result = await takeover({
      cockpitDeviceId: selectedCockpitId.value,
      vehicleDeviceId: vehicle.value.deviceId,
    })
    const takeoverResult: any = (result as any)?.result ?? null
    const takeoverState = normalizeState(
      takeoverResult?.sessionState ?? takeoverResult?.state ?? '',
    )
    if (result.success) {
      if (takeoverState && takeoverState !== 'active') {
        onlyMessage(`接管返回未激活状态: ${takeoverState}`, 'error')
        await loadVehicle(true)
        return
      }
      onlyMessage($t('parallel-driving.vehicle-list.takeover-success'))
      isControlling.value = true
      await loadVehicle(true)
      await loadCockpitDevices()
      initWebSocket()
      await nextTick()
      const activeReady = await waitUntilSessionActive(selectedCockpitId.value, vehicle.value.deviceId)
      if (!activeReady) {
        onlyMessage('会话状态仍为 binding，暂未下发远控预置。请直接点击结束远控(释放会话)后重试', 'warning')
        return
      }
      await applyRemotePreflight()
    } else {
      const msg = (result as any)?.message
      onlyMessage(msg || $t('parallel-driving.vehicle-list.takeover-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.vehicle-list.takeover-failed'), 'error')
  } finally {
    takingOver.value = false
  }
}

const handleExitRemoteControl = async () => {
  if (!vehicle.value) return
  const cockpitId = selectedCockpitId.value || vehicle.value.boundCockpitId
  if (!cockpitId) {
    onlyMessage('无法确定驾驶舱ID，无法释放控制', 'error')
    return
  }

  releasing.value = true
  try {
    const result = await release({
      cockpitDeviceId: cockpitId,
      vehicleDeviceId: vehicle.value.deviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.vehicle-list.release-success'))
      isControlling.value = false
      closeWebSocket()
      await loadVehicle(true)
      // 若当前选择的驾驶舱与绑定驾驶舱一致，释放后清理选择，避免误提示“正在接管”
      if (selectedCockpitId.value && selectedCockpitId.value === cockpitId) {
        selectedCockpitId.value = ''
      }
    } else {
      const msg = (result as any)?.message
      onlyMessage(msg || $t('parallel-driving.vehicle-list.release-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.vehicle-list.release-failed'), 'error')
  } finally {
    releasing.value = false
  }
}

const handleBack = () => {
  if (isRemoteFocusEntry.value) {
    /** 远控工作台：优先关闭浏览器标签/窗口；非 window.open 打开的页多数浏览器会忽略 close，再退回列表 */
    if (typeof window !== 'undefined') {
      try {
        window.close()
      } catch {
        /* noop */
      }
      window.setTimeout(() => {
        void router.push({ path: '/parallel-driving/vehicles' })
      }, 180)
    } else {
      void router.push({ path: '/parallel-driving/vehicles' })
    }
    return
  }
  router.push({ name: 'vehicle-list' })
}

const toggleFullscreen = async () => {
  if (!fullscreenRef.value) return
  try {
    if (isFullscreen.value) {
      await document.exitFullscreen?.()
      isFullscreen.value = false
    } else {
      await fullscreenRef.value.requestFullscreen?.()
      isFullscreen.value = true
    }
  } catch (e) {
    console.warn('Fullscreen not supported:', e)
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement === fullscreenRef.value
}

// 启动轮询：在线状态、远控状态（静默更新，不刷新页面）
const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(() => {
    loadVehicle(true)
  }, POLL_INTERVAL)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// 启动 WebSocket：车速等实时状态
// 接管模式: vehicleId + cockpitId；监控模式(在线未接管): 仅 vehicleId
let pendingStatusPatch: Record<string, any> | null = null
let statusRafId: number | null = null

/** 车端 100ms 一包时，RTT/浮点噪声会导致 vehicleStatus 每帧都变，HUD 与带 RTT 的 VideoCell 整树重绘闪跳；仅在实际变化超过阈值时写入 */
const shouldApplyStatusPatchValue = (key: string, prev: any, next: any): boolean => {
  if (prev === next) return false
  if (key === 'cloudLinkRttMs' || key === 'cloudLinkNetworkRttMs') {
    const a = Number(prev)
    const b = Number(next)
    const aOk = Number.isFinite(a)
    const bOk = Number.isFinite(b)
    if (!aOk && !bOk) return false
    if (!aOk || !bOk) return true
    return Math.abs(a - b) >= 8
  }
  if (key === 'steering') {
    const a = Number(prev)
    const b = Number(next)
    if (!Number.isFinite(a) && !Number.isFinite(b)) return false
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true
    return Math.abs(a - b) >= 0.08
  }
  if (key === 'speed') {
    const a = Number(prev)
    const b = Number(next)
    if (!Number.isFinite(a) && !Number.isFinite(b)) return false
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true
    return Math.abs(a - b) >= 0.05
  }
  if (key === 'soc') {
    const a = Number(prev)
    const b = Number(next)
    if (!Number.isFinite(a) && !Number.isFinite(b)) return false
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true
    return Math.abs(a - b) >= 0.5
  }
  return prev !== next
}

const flushStatusPatch = () => {
  statusRafId = null
  if (!pendingStatusPatch) return
  const patch = pendingStatusPatch
  pendingStatusPatch = null
  for (const key of Object.keys(patch)) {
    if (shouldApplyStatusPatchValue(key, vehicleStatus[key], patch[key])) {
      vehicleStatus[key] = patch[key]
    }
  }
  syncReverseLayoutFromGear(vehicleStatus.gear as number | undefined)
}

/** 避免 watch 多次触发时对同一 vehicle|cockpit 反复 close+open，引发旧 socket onclose 与新连接竞态、控制台重连刷屏 */
let lastParallelDrivingWsKey = ''

const initWebSocket = () => {
  const deviceId = vehicle.value?.deviceId
  if (!deviceId) { closeWebSocket(); return }
  const cockpitId = isControlling.value ? selectedCockpitId.value : undefined
  if (isControlling.value && !selectedCockpitId.value) { closeWebSocket(); return }
  const wsKey = `${deviceId}|${cockpitId ?? ''}`
  if (isParallelDrivingWebSocketActive() && wsKey === lastParallelDrivingWsKey) {
    return
  }
  lastParallelDrivingWsKey = wsKey
  closeParallelDrivingWebSocket()
  initParallelDrivingWebSocket(
    deviceId,
    cockpitId,
    (data) => {
      if (data.type === 'vehicle-status' && data.properties) {
        const mapped = applyChassisStatusToVehicleStatus(data.properties)
        pendingStatusPatch = mapped
        if (statusRafId == null) {
          statusRafId = requestAnimationFrame(flushStatusPatch)
        }
      }
    },
    () => {},
    () => {},
    () => {}
  )
}

/** 仅清空底盘 HUD 缓存（换车、离开页）；勿在每次断 WS 时调用，否则 watch 频繁 close→init 会整屏「--」再恢复 */
const resetParallelDrivingChassisHud = () => {
  for (const key of Object.keys(vehicleStatus)) {
    delete vehicleStatus[key]
  }
  hudAccelLitLatched = false
  hudBrakeLitLatched = false
  reverseLayoutScore = 0
  isReverse.value = false
}

const closeWebSocket = () => {
  lastParallelDrivingWsKey = ''
  closeParallelDrivingWebSocket()
  if (statusRafId != null) {
    cancelAnimationFrame(statusRafId)
    statusRafId = null
  }
  pendingStatusPatch = null
  hudAccelLitLatched = false
  hudBrakeLitLatched = false
}

const handleEmergencyStop = async () => {
  if (!selectedCockpitId.value || !vehicle.value) return
  emergencyStopping.value = true
  try {
    const result = await emergencyStop({
      cockpitDeviceId: selectedCockpitId.value,
      vehicleDeviceId: vehicle.value.deviceId,
    })
    if (result.success) {
      onlyMessage($t('parallel-driving.control-pad.emergency-stop-success'))
    } else {
      const msg = (result as any)?.message
      onlyMessage(msg || $t('parallel-driving.control-pad.emergency-stop-failed'), 'error')
    }
  } catch (error: any) {
    onlyMessage(error.message || $t('parallel-driving.control-pad.emergency-stop-failed'), 'error')
  } finally {
    emergencyStopping.value = false
  }
}

watch(vehicleId, (id, prevId) => {
  if (prevId !== undefined && id !== prevId) {
    resetParallelDrivingChassisHud()
    delete lockedPlaybackInternalCodeByRouteId.value[prevId]
  }
  loadVehicle()
  if (id) startPolling()
  else stopPolling()
}, { immediate: true })

/** 合并同一 tick / 轮询结束后的多次依赖抖动，避免短时间连续 init/close */
let parallelDrivingWsFlushTimer: ReturnType<typeof setTimeout> | null = null
const flushParallelDrivingWebSocket = () => {
  if (!vehicle.value?.deviceId) {
    closeWebSocket()
    return
  }
  if (isControlling.value && selectedCockpitId.value && vehicle.value.boundCockpitId === selectedCockpitId.value) {
    initWebSocket()
  } else if (vehicle.value.state?.value === 'online') {
    initWebSocket()
  } else {
    closeWebSocket()
  }
}

watch(
  () => [
    vehicle.value?.deviceId,
    isControlling.value,
    selectedCockpitId.value,
    vehicle.value?.state?.value,
    vehicle.value?.boundCockpitId,
  ],
  () => {
    if (parallelDrivingWsFlushTimer != null) clearTimeout(parallelDrivingWsFlushTimer)
    parallelDrivingWsFlushTimer = setTimeout(() => {
      parallelDrivingWsFlushTimer = null
      flushParallelDrivingWebSocket()
    }, 80)
  },
  { immediate: true }
)

// ── MOCK: MRC 通知测试开关（true=每5s轮换弹框，false=走真实数据）──
const MOCK_MRC_ENABLED = false
let mockMrcTimer: ReturnType<typeof setInterval> | null = null
const MOCK_MRC_CYCLE = [
  { s: 2, n: 'JOYSTICK_IDLE_TIMEOUT' },
  { s: 3, n: 'CLOUD_LINK_RTT_EXCESSIVE' },
  { s: 4, n: 'COLLISION_IMMINENT' },
  { s: 0, n: '' },
]
let mockMrcIdx = 0

onMounted(() => {
  loadCockpitDevices()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  try {
    const saved = localStorage.getItem('parallelDriving.cockpitDeviceId')
    if (saved) selectedCockpitId.value = saved
  } catch (e) {
    // ignore
  }

  if (MOCK_MRC_ENABLED) {
    mockMrcIdx = 0
    mockMrcTimer = setInterval(() => {
      const item = MOCK_MRC_CYCLE[mockMrcIdx % MOCK_MRC_CYCLE.length]
      mockMrcIdx++
      vehicleStatus.mrcStatus = item.s
      vehicleStatus.mrcErrorName = item.n
      vehicleStatus.mrcTimestamp = Date.now()
    }, 5000)
  }
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (document.fullscreenElement) document.exitFullscreen?.()
  stopPolling()
  closeWebSocket()
  if (parallelDrivingWsFlushTimer != null) {
    clearTimeout(parallelDrivingWsFlushTimer)
    parallelDrivingWsFlushTimer = null
  }
  if (mockMrcTimer != null) {
    clearInterval(mockMrcTimer)
    mockMrcTimer = null
  }
  resetParallelDrivingChassisHud()
  sectionRO?.disconnect()
})
</script>

<style scoped lang="less">
.vehicle-detail {
  padding: 0;
}

/* 远控工作台独立页：暗黑主题（仅根 class，不影响普通车辆详情） */
.pd-vehicle-detail-root--remote-focus {
  color-scheme: dark;
  min-height: 100vh;
  color: rgba(255, 255, 255, 0.82);
  scrollbar-color: rgba(255, 255, 255, 0.22) rgba(255, 255, 255, 0.05);
  background:
    radial-gradient(1200px 640px at 8% -14%, rgba(64, 169, 255, 0.14), transparent 58%),
    radial-gradient(980px 560px at 96% 0%, rgba(82, 196, 26, 0.07), transparent 52%),
    radial-gradient(780px 440px at 50% 112%, rgba(91, 140, 255, 0.06), transparent 55%),
    linear-gradient(165deg, #0b1018 0%, #070b12 38%, #05080e 100%);

  :deep(.ant-pro-page-container),
  :deep(.ant-pro-page-container-grid-content),
  :deep(.ant-pro-page-container-children-content) {
    background: transparent;
  }

  :deep(.ant-pro-page-container-children-content.children-full-height) {
    padding: 0 10px 22px;
  }

  :deep(.ant-spin-nested-loading),
  :deep(.ant-spin-container) {
    background: transparent;
  }

  :deep(.ant-spin-dot-item) {
    background-color: #5b8cff;
  }

  /* 主操作卡片：浮在背景上的深色块 */
  :deep(.pd-rc-card--remote-focus.ant-card) {
    margin-bottom: 0 !important;
    background: transparent !important;
    border: none !important;
    border-radius: 14px;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.07),
      0 24px 56px rgba(0, 0, 0, 0.52);
    overflow: hidden;
  }

  /*
   * Windowed 远控条：与末尾「非 scoped fs-layout-dark」同语义 ——
   * 标签/未选中 pill 与底对比不足时阅读累眼，此处单独拉高对比与描边。
   */
  .remote-control-form {
    padding: 10px 14px;
    margin-bottom: 12px !important;
    row-gap: 10px;
    column-gap: 14px;
    background: rgba(16, 20, 30, 0.88);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.06) inset,
      0 6px 22px rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .rc-label {
    color: rgba(255, 255, 255, 0.84);
    font-weight: 550;
  }

  .rc-vehicle-name {
    color: rgba(255, 255, 255, 0.96);
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .rc-divider {
    height: 22px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(255, 255, 255, 0.16) 28%,
      rgba(255, 255, 255, 0.16) 72%,
      transparent 100%
    );
  }

  .rc-aux-guide-prefix {
    color: rgba(255, 255, 255, 0.72);
  }

  .rc-preflight-name,
  .rc-preflight-drive-title {
    color: rgba(255, 255, 255, 0.76);
  }

  :deep(.rc-video-toggles) {
    padding: 4px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    gap: 3px;
  }

  :deep(.rc-checkbox-group.ant-checkbox-group) {
    padding: 4px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    gap: 3px;
  }

  :deep(.ant-checkbox-wrapper) {
    color: rgba(255, 255, 255, 0.76) !important;
    border-radius: 6px !important;
    transition: background 0.15s ease, color 0.15s ease;
  }

  :deep(.ant-checkbox-wrapper:hover) {
    color: rgba(255, 255, 255, 0.96) !important;
    background: rgba(255, 255, 255, 0.09) !important;
  }

  :deep(.ant-checkbox-wrapper-checked) {
    background: rgba(91, 140, 255, 0.26) !important;
    color: #fff !important;
    box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.45);
  }

  :deep(.ant-checkbox) {
    display: none !important;
  }

  :deep(.rc-checkbox-hitch.ant-checkbox-wrapper),
  :deep(.rc-checkbox-guide.ant-checkbox-wrapper) {
    margin-inline-start: 0 !important;
    padding: 0 11px !important;
    min-height: 26px !important;
    line-height: 24px !important;
    border-radius: 6px !important;
    color: rgba(255, 255, 255, 0.76) !important;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.11) !important;
  }

  :deep(.rc-checkbox-hitch.ant-checkbox-wrapper-checked),
  :deep(.rc-checkbox-guide.ant-checkbox-wrapper-checked) {
    background: rgba(91, 140, 255, 0.24) !important;
    color: #fff !important;
    border-color: rgba(91, 140, 255, 0.42) !important;
    box-shadow: inset 0 0 0 1px rgba(91, 140, 255, 0.28);
  }

  :deep(.rc-preflight-drive-radio.ant-radio-group) {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 4px 8px;
    gap: 4px 12px;
    background: rgba(0, 0, 0, 0.36);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  :deep(.rc-preflight-drive-radio .ant-radio-wrapper) {
    color: rgba(255, 255, 255, 0.78) !important;
    white-space: nowrap;
    margin-inline-end: 0 !important;
    align-items: center;
  }

  :deep(.rc-preflight-drive-radio .ant-radio-wrapper:hover) {
    color: rgba(255, 255, 255, 0.95) !important;
  }

  /* 未选中：压暗圆环，避免与选中态蓝点争奇斗艳 */
  :deep(.rc-preflight-drive-radio .ant-radio .ant-radio-inner) {
    border-color: rgba(255, 255, 255, 0.22);
    background-color: rgba(255, 255, 255, 0.04);
  }

  :deep(.rc-preflight-drive-radio .ant-radio:hover .ant-radio-inner) {
    border-color: rgba(255, 255, 255, 0.38);
    background-color: rgba(255, 255, 255, 0.07);
  }

  :deep(.rc-preflight-drive-radio .ant-radio-checked .ant-radio-inner) {
    border-color: #5e9eff;
    background-color: #4a7ae8;
    box-shadow: 0 0 0 1px rgba(94, 158, 255, 0.35);
  }

  :deep(.rc-preflight-drive-radio .ant-radio-checked .ant-radio-inner::after) {
    background-color: #fff;
  }

  :deep(.rc-preflight-drive-radio .ant-radio-disabled .ant-radio-inner) {
    border-color: rgba(255, 255, 255, 0.12) !important;
    background-color: rgba(255, 255, 255, 0.03) !important;
  }

  :deep(.rc-preflight-drive-radio .ant-radio-disabled.ant-radio-checked .ant-radio-inner) {
    border-color: rgba(94, 158, 255, 0.45) !important;
    background-color: rgba(74, 122, 232, 0.35) !important;
  }

  :deep(.rc-preflight-drive-radio .ant-radio-wrapper-disabled) {
    color: rgba(255, 255, 255, 0.7) !important;
  }

  /* Ant 全局：.ant-radio-disabled + span { color: rgba(0,0,0,.25) }，深色底上「R 远控」会看不见 */
  :deep(.rc-preflight-drive-radio .ant-radio-disabled + span) {
    color: rgba(255, 255, 255, 0.7) !important;
    cursor: not-allowed;
  }

  :deep(.ant-switch) {
    background: rgba(255, 255, 255, 0.16);
  }

  :deep(.ant-switch:hover:not(.ant-switch-disabled)) {
    background: rgba(255, 255, 255, 0.22);
  }

  :deep(.ant-switch-checked) {
    background: #5b8cff !important;
  }

  :deep(.ant-select-selector) {
    background: rgba(255, 255, 255, 0.07) !important;
    border: 1px solid rgba(255, 255, 255, 0.14) !important;
    color: rgba(255, 255, 255, 0.95) !important;
  }

  :deep(.ant-select:hover .ant-select-selector),
  :deep(.ant-select-focused .ant-select-selector) {
    border-color: rgba(91, 140, 255, 0.55) !important;
    background: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.ant-select-arrow) {
    color: rgba(255, 255, 255, 0.55);
  }
}

.pd-remote-focus-app-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  /* 与下方条带内「ZERON」左缘对齐：children-full-height 左右 10px + .remote-control-form 左右 14px */
  padding: 6px 24px;
  margin-bottom: 4px;
  border-radius: 0 0 8px 8px;
  background: rgba(15, 20, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-top: none;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  backdrop-filter: saturate(140%) blur(12px);

  &__exit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.88);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.14);
    }

    &:focus-visible {
      outline: 2px solid #69b1ff;
      outline-offset: 2px;
    }

    flex-shrink: 0;
    margin-left: auto;
  }

  &__title-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
    max-width: 100%;
    /* 整块随「车牌+标签」变宽，不把标签撑到远离车名；过长时整行上限为栏内剩余宽度 */
    width: fit-content;
  }

  &__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: rgba(255, 255, 255, 0.96);
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
    min-width: 0;
  }

  &__tags {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
  }

  &__center {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }

  /* Ant Tag 在低照度顶栏的可读微调 */
  :deep(.ant-tag) {
    margin-inline-end: 0;
    border-color: transparent;
    margin: 0;
    padding: 0 6px;
    font-size: 12px;
    line-height: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pd-remote-focus-app-bar {
    backdrop-filter: none;
  }
}

.pd-vehicle-detail-root--remote-focus .remote-control-wrapper {
  margin-bottom: 0;
  margin-top: 2px;
}

.pd-rc-card--remote-focus :deep(.ant-card-body) {
  padding-bottom: 12px;
}

.pd-remote-focus-shell {
  /* 顶栏已压扁，多留给视频区 */
  min-height: min(70vh, calc(100dvh - 84px));
}

/* 远控页：card-body 与整体暗壳统一（scoped 可提高优先级覆盖 .remote-control-card-fs） */
.pd-vehicle-detail-root--remote-focus :deep(.remote-control-card-fs .ant-card-body) {
  background: linear-gradient(180deg, #131820 0%, #0d1016 48%, #090c12 100%) !important;
}

.pd-vehicle-detail-root--remote-focus :deep(.fullscreen-target:not(:fullscreen) .video-section) {
  border-top-color: rgba(255, 255, 255, 0.06) !important;
}

.pd-vehicle-detail-root--remote-focus .video-placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.pd-vehicle-detail-root--remote-focus .vehicle-offline-monitor-placeholder {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(19, 23, 31, 0.95) 0%, rgba(12, 14, 20, 0.98) 100%);
  border-radius: 0 0 12px 12px;
}

.pd-vehicle-detail-root--remote-focus .offline-monitor-icon-wrap {
  background: rgba(255, 255, 255, 0.08);
}

.pd-vehicle-detail-root--remote-focus .offline-monitor-svg {
  color: rgba(255, 255, 255, 0.55);
}

.pd-vehicle-detail-root--remote-focus .offline-monitor-title {
  color: rgba(255, 255, 255, 0.92);
}

.pd-vehicle-detail-root--remote-focus .offline-monitor-hint {
  color: rgba(255, 255, 255, 0.56);
}

/* windowed：为 sticky 顶栏与边距留出垂直空间（仅远控页） */
.pd-vehicle-detail-root--remote-focus
  .fullscreen-target:not(:fullscreen).card-body-fullscreen-wrapper:has(.video-section) {
  height: calc(100dvh - 132px);
  min-height: min(520px, calc(100dvh - 132px));
}

.remote-control-wrapper {
  margin-bottom: 16px;
}

.remote-control-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 16px;
}

.rc-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rc-label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
  user-select: none;
}

.rc-divider {
  display: inline-block;
  width: 1px;
  height: 20px;
  background: rgba(0, 0, 0, 0.08);
  margin: 0 4px;
  flex-shrink: 0;
}

.rc-select {
  width: 154px; // 220px * 0.7
}

.rc-group-vehicle-id {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.rc-vehicle-name {
  font-size: 14px;
  font-weight: 600;
  color: inherit;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

// badge 文字在深色底上保持可读
.rc-vehicle-badge {
  :deep(.ant-badge-status-text) {
    color: rgba(255, 255, 255, 0.82);
    font-size: 12px;
  }
}

.rc-group-actions {
  gap: 6px;
}

/* MRC 紧急停车：分段按钮，MRC1/MRC2 用警告/危险色 */
.rc-group-mrc {
  gap: 6px;
}

/* MRC 实时状态徽章（紧挨 radio group，仅 MRC1/MRC2 时显示） */
.rc-mrc-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
  white-space: nowrap;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: all 0.2s ease;
}

.rc-mrc-badge-name {
  letter-spacing: 0.02em;
}

.rc-mrc-badge-time {
  font-weight: 500;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

/* MRC0：提示蓝 */
.rc-mrc-badge.is-mrc0 {
  color: #fff;
  background: rgba(24, 144, 255, 0.72);
  border: 1.5px solid rgba(24, 144, 255, 0.9);
  box-shadow: 0 0 16px rgba(24, 144, 255, 0.5), inset 0 1px 0 rgba(255,255,255,0.2);
  font-size: 13px;
  font-weight: 700;
  padding: 3px 12px;
  animation: rc-mrc-pulse 2s ease-in-out infinite;
}

@keyframes rc-mrc-pulse {
  0%, 100% { box-shadow: 0 0 16px rgba(24, 144, 255, 0.5), inset 0 1px 0 rgba(255,255,255,0.2); }
  50%      { box-shadow: 0 0 28px rgba(24, 144, 255, 0.75), inset 0 1px 0 rgba(255,255,255,0.2); }
}

/* MRC1：警告橙 */
.rc-mrc-badge.is-mrc1 {
  color: #ffa940;
  background: rgba(250, 140, 22, 0.18);
  border: 1px solid rgba(250, 140, 22, 0.35);
  box-shadow: 0 0 10px rgba(250, 140, 22, 0.12);
}

/* MRC2：危险红 */
.rc-mrc-badge.is-mrc2 {
  color: #ff7875;
  background: rgba(245, 34, 45, 0.2);
  border: 1px solid rgba(245, 34, 45, 0.4);
  box-shadow: 0 0 12px rgba(245, 34, 45, 0.15);
}

/* 正常态：灰色低调 */
.rc-mrc-badge.is-normal {
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

/* 远控工作台暗黑主题下微调 */
.pd-vehicle-detail-root--remote-focus .rc-mrc-badge.is-mrc1 {
  color: #ffc069;
  background: rgba(250, 140, 22, 0.22);
  border-color: rgba(250, 140, 22, 0.4);
}

.pd-vehicle-detail-root--remote-focus .rc-mrc-badge.is-mrc2 {
  color: #ff9c9a;
  background: rgba(245, 34, 45, 0.26);
  border-color: rgba(245, 34, 45, 0.48);
}

.pd-vehicle-detail-root--remote-focus .rc-mrc-badge.is-normal {
  color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.08);
}

.rc-mrc-radio {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

:deep(.rc-mrc-radio .ant-radio-button-wrapper) {
  height: 26px;
  line-height: 26px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
}

:deep(.rc-mrc-radio .ant-radio-button-wrapper[value="2"]) {
  color: #d46b08;
}
:deep(.rc-mrc-radio .ant-radio-button-wrapper[value="2"].ant-radio-button-wrapper-checked) {
  color: #fff;
  background: #d46b08;
  border-color: #d46b08;
}

:deep(.rc-mrc-radio .ant-radio-button-wrapper[value="3"]) {
  color: #cf1322;
}
:deep(.rc-mrc-radio .ant-radio-button-wrapper[value="3"].ant-radio-button-wrapper-checked) {
  color: #fff;
  background: #cf1322;
  border-color: #cf1322;
}

.rc-group-preflight {
  flex: 1 1 280px;
  min-width: 0;
  align-items: flex-start;
  flex-direction: row;
  flex-wrap: wrap;
  row-gap: 6px;
}
.rc-preflight-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}
.rc-preflight-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.rc-preflight-row-drive {
  align-items: center;
  flex-wrap: wrap;
}
.rc-preflight-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rc-preflight-name,
.rc-preflight-drive-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  user-select: none;
}
.rc-preflight-drive-title {
  margin-right: 4px;
}
.rc-preflight-drive-radio {
  display: inline-flex;
  flex-wrap: wrap;
  row-gap: 2px;
}
.rc-actual-dm {
  margin-left: 8px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  user-select: none;
}
.rc-pref-dm-cur {
  margin-left: 4px;
  margin-right: 6px;
  min-width: 18px;
  font-size: 13px;
  font-weight: 600;
  color: #1677ff;
  white-space: nowrap;
  user-select: none;
}
.rc-preflight-c-radio-wrap {
  display: inline-block;
}
.rc-preflight-c-radio-wrap.is-disabled {
  cursor: not-allowed;
}
.rc-preflight-c-radio-wrap.is-disabled :deep(.ant-radio-wrapper) {
  cursor: not-allowed;
}

.rc-group-fs {
  margin-left: auto;
}

/* 前后左右 + 辅助线 + 挂后：同一行/换行组；全屏下由 .rc-video-toggles 套一层与布局 pill 一致的壳 */
.rc-video-toggles {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.rc-aux-guide-inline {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.rc-aux-guide-prefix {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  line-height: 22px;
  white-space: nowrap;
}

/* 车辆未在线：监控区空状态（信息层次 + 可操作刷新） */
.vehicle-offline-monitor-placeholder {
  margin-top: 16px;
  padding: 32px 20px 28px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  transition: background-color 0.2s ease;
}

.offline-monitor-card {
  max-width: 440px;
  text-align: center;
}

.offline-monitor-icon-wrap {
  margin: 0 auto 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.offline-monitor-svg {
  width: 26px;
  height: 26px;
  color: rgba(0, 0, 0, 0.45);
}

.offline-monitor-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  line-height: 1.4;
}

.offline-monitor-hint {
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.65;
  color: rgba(0, 0, 0, 0.55);
}

.offline-monitor-refresh {
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .vehicle-offline-monitor-placeholder {
    transition: none;
  }
}

.video-section {
  position: relative;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 全屏仅包含 ant-card-body 内容：表单 + 视频 */
.card-body-fullscreen-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
/* 非全屏时，照全屏逻辑：固定高度 + flex，让视频区域占满剩余空间 */
.fullscreen-target:not(:fullscreen).card-body-fullscreen-wrapper:has(.video-section) {
  height: calc(100vh - 180px);
  min-height: 500px;
  overflow: hidden;
}

.fullscreen-target:fullscreen {
  background: #0d0d0d !important;
  padding: 16px;
  margin: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
}

/* 全屏时远控卡片 body 同步深色（子节点进全屏层后，避免页面上残留白底块） */
.remote-control-card-fs :deep(.ant-card-body) {
  background: #0d0d0d !important;
}

/*
 * 全屏：remote-control-form 以下 — 强制深色底，覆盖 Ant Row/Col、布局根节点、视频壳层白底
 */
.fullscreen-target:fullscreen,
.fullscreen-target:-webkit-full-screen,
.fullscreen-target:-moz-full-screen {
  background-color: #0d0d0d !important;
}

.fullscreen-target:fullscreen .video-section,
.fullscreen-target:-webkit-full-screen .video-section,
.fullscreen-target:-moz-full-screen .video-section {
  background-color: #0d0d0d !important;
}

.fullscreen-target:fullscreen :deep(.ant-row),
.fullscreen-target:-webkit-full-screen :deep(.ant-row),
.fullscreen-target:-moz-full-screen :deep(.ant-row),
.fullscreen-target:fullscreen :deep(.ant-col),
.fullscreen-target:-webkit-full-screen :deep(.ant-col),
.fullscreen-target:-moz-full-screen :deep(.ant-col) {
  background: transparent !important;
  background-color: transparent !important;
}

.fullscreen-target:fullscreen .layout-a,
.fullscreen-target:-webkit-full-screen .layout-a,
.fullscreen-target:-moz-full-screen .layout-a,
.fullscreen-target:fullscreen .layout-c,
.fullscreen-target:-webkit-full-screen .layout-c,
.fullscreen-target:-moz-full-screen .layout-c,
.fullscreen-target:fullscreen .layout-mode-a,
.fullscreen-target:-webkit-full-screen .layout-mode-a,
.fullscreen-target:-moz-full-screen .layout-mode-a,
.fullscreen-target:fullscreen .layout-mode-b,
.fullscreen-target:-webkit-full-screen .layout-mode-b,
.fullscreen-target:-moz-full-screen .layout-mode-b,
.fullscreen-target:fullscreen .layout-mode-c,
.fullscreen-target:-webkit-full-screen .layout-mode-c,
.fullscreen-target:-moz-full-screen .layout-mode-c {
  background-color: transparent !important;
}

.fullscreen-target:fullscreen .video-with-hud,
.fullscreen-target:-webkit-full-screen .video-with-hud,
.fullscreen-target:-moz-full-screen .video-with-hud {
  background-color: #000 !important;
}

.fullscreen-target:fullscreen .layout-a-row1,
.fullscreen-target:-webkit-full-screen .layout-a-row1,
.fullscreen-target:-moz-full-screen .layout-a-row1,
.fullscreen-target:fullscreen .layout-a-row2,
.fullscreen-target:-webkit-full-screen .layout-a-row2,
.fullscreen-target:-moz-full-screen .layout-a-row2 {
  background-color: transparent !important;
}

/* 全屏远控表单深色：见文件末尾「非 scoped」样式块（.pd-vehicle-detail-fs.fs-layout-dark），避免 scoped+:fullscreen 不命中 Ant 内部节点 */

/* 全屏下视频区域：占满剩余空间（标准 + WebKit + Gecko） */
.fullscreen-target:fullscreen .video-section,
.fullscreen-target:-webkit-full-screen .video-section,
.fullscreen-target:-moz-full-screen .video-section {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* A：2×2 */
.fullscreen-target:fullscreen .layout-mode-a,
.fullscreen-target:-webkit-full-screen .layout-mode-a,
.fullscreen-target:-moz-full-screen .layout-mode-a {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

/* B：前主左 */
.fullscreen-target:fullscreen .layout-mode-b,
.fullscreen-target:-webkit-full-screen .layout-mode-b,
.fullscreen-target:-moz-full-screen .layout-mode-b {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 3fr 1fr;
  grid-template-rows: 1fr;
  gap: 8px;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-row,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-row,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-row {
  display: contents;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-row .ant-col,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-row .ant-col,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-row .ant-col {
  min-width: 0;
  min-height: 0;
  max-width: none !important;
  flex: none !important;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-right-col,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-right-col,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-right-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  justify-content: center;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-inner-row,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-inner-row,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-inner-row {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  justify-content: center;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-inner-row .ant-col,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-inner-row .ant-col,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-inner-row .ant-col {
  flex: 1;
  min-height: 0;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-inner-row .video-box,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-inner-row .video-box,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-inner-row .video-box {
  flex: 1;
  min-height: 0;
}
.fullscreen-target:fullscreen .layout-mode-b .layout-b-inner-row .video-wrapper,
.fullscreen-target:-webkit-full-screen .layout-mode-b .layout-b-inner-row .video-wrapper,
.fullscreen-target:-moz-full-screen .layout-mode-b .layout-b-inner-row .video-wrapper {
  aspect-ratio: unset;
}

.fullscreen-target:fullscreen .video-grid,
.fullscreen-target:-webkit-full-screen .video-grid,
.fullscreen-target:-moz-full-screen .video-grid {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
}

.fullscreen-target:fullscreen .video-grid.ant-row,
.fullscreen-target:-webkit-full-screen .video-grid.ant-row,
.fullscreen-target:-moz-full-screen .video-grid.ant-row {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.fullscreen-target:fullscreen .video-grid .ant-col,
.fullscreen-target:-webkit-full-screen .video-grid .ant-col,
.fullscreen-target:-moz-full-screen .video-grid .ant-col {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  min-width: 0;
}

.fullscreen-target:fullscreen .video-box,
.fullscreen-target:-webkit-full-screen .video-box,
.fullscreen-target:-moz-full-screen .video-box,
.fullscreen-target:fullscreen .video-section :deep(.video-box),
.fullscreen-target:-webkit-full-screen .video-section :deep(.video-box),
.fullscreen-target:-moz-full-screen .video-section :deep(.video-box) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  background-color: #000 !important;
}

.fullscreen-target:fullscreen .video-wrapper,
.fullscreen-target:-webkit-full-screen .video-wrapper,
.fullscreen-target:-moz-full-screen .video-wrapper,
.fullscreen-target:fullscreen .video-section :deep(.video-wrapper),
.fullscreen-target:-webkit-full-screen .video-section :deep(.video-wrapper),
.fullscreen-target:-moz-full-screen .video-section :deep(.video-wrapper) {
  flex: 1;
  min-height: 0;
  aspect-ratio: unset;
  display: flex;
  background-color: #000 !important;
}

.fullscreen-target:fullscreen .video-wrapper .webrtc-player,
.fullscreen-target:-webkit-full-screen .video-wrapper .webrtc-player,
.fullscreen-target:-moz-full-screen .video-wrapper .webrtc-player,
.fullscreen-target:fullscreen .video-wrapper :deep(.webrtc-player),
.fullscreen-target:-webkit-full-screen .video-wrapper :deep(.webrtc-player),
.fullscreen-target:-moz-full-screen .video-wrapper :deep(.webrtc-player),
.fullscreen-target:fullscreen .video-section :deep(.webrtc-player),
.fullscreen-target:-webkit-full-screen .video-section :deep(.webrtc-player),
.fullscreen-target:-moz-full-screen .video-section :deep(.webrtc-player),
.fullscreen-target:fullscreen .video-section :deep([class*='player']),
.fullscreen-target:-webkit-full-screen .video-section :deep([class*='player']),
.fullscreen-target:-moz-full-screen .video-section :deep([class*='player']),
.fullscreen-target:fullscreen .video-section :deep(.xgplayer),
.fullscreen-target:-webkit-full-screen .video-section :deep(.xgplayer),
.fullscreen-target:-moz-full-screen .video-section :deep(.xgplayer) {
  flex: 1;
  min-width: 0;
  min-height: 0;
  background-color: #000 !important;
}

.fullscreen-target:fullscreen .video-wrapper video,
.fullscreen-target:-webkit-full-screen .video-wrapper video,
.fullscreen-target:-moz-full-screen .video-wrapper video,
.fullscreen-target:fullscreen .webrtc-player video,
.fullscreen-target:-webkit-full-screen .webrtc-player video,
.fullscreen-target:-moz-full-screen .webrtc-player video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 全屏：video-badge 角标（已从独立行改为叠加角标） */

.fullscreen-target:fullscreen .video-section :deep(.video-placeholder),
.fullscreen-target:-webkit-full-screen .video-section :deep(.video-placeholder),
.fullscreen-target:-moz-full-screen .video-section :deep(.video-placeholder),
.fullscreen-target:fullscreen .video-section .video-placeholder,
.fullscreen-target:-webkit-full-screen .video-section .video-placeholder,
.fullscreen-target:-moz-full-screen .video-section .video-placeholder {
  color: rgba(255, 255, 255, 0.5) !important;
}

.fullscreen-target:fullscreen .video-section .layout-a-col,
.fullscreen-target:-webkit-full-screen .video-section .layout-a-col,
.fullscreen-target:-moz-full-screen .video-section .layout-a-col {
  background: #0a0a0a !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
}

.fullscreen-target:fullscreen .video-section .layout-c-row1,
.fullscreen-target:-webkit-full-screen .video-section .layout-c-row1,
.fullscreen-target:-moz-full-screen .video-section .layout-c-row1,
.fullscreen-target:fullscreen .video-section .layout-c-col,
.fullscreen-target:-webkit-full-screen .video-section .layout-c-col,
.fullscreen-target:-moz-full-screen .video-section .layout-c-col {
  background: #0a0a0a !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
}

.fullscreen-target:fullscreen .video-section .layout-c-video-wrap,
.fullscreen-target:-webkit-full-screen .video-section .layout-c-video-wrap,
.fullscreen-target:-moz-full-screen .video-section .layout-c-video-wrap {
  background: #000;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

/* ── 全屏：Layout-E（左中右）适配 ── */
.fullscreen-target:fullscreen .layout-e,
.fullscreen-target:-webkit-full-screen .layout-e,
.fullscreen-target:-moz-full-screen .layout-e {
  flex: 1;
  min-height: 0;
  min-width: 0;
  height: 100%;
}
.fullscreen-target:fullscreen .layout-e-left,
.fullscreen-target:-webkit-full-screen .layout-e-left,
.fullscreen-target:-moz-full-screen .layout-e-left,
.fullscreen-target:fullscreen .layout-e-center,
.fullscreen-target:-webkit-full-screen .layout-e-center,
.fullscreen-target:-moz-full-screen .layout-e-center,
.fullscreen-target:fullscreen .layout-e-right,
.fullscreen-target:-webkit-full-screen .layout-e-right,
.fullscreen-target:-moz-full-screen .layout-e-right {
  min-height: 0;
  min-width: 0;
}
.fullscreen-target:fullscreen .layout-e .video-box,
.fullscreen-target:-webkit-full-screen .layout-e .video-box,
.fullscreen-target:-moz-full-screen .layout-e .video-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #000 !important;
}
.fullscreen-target:fullscreen .layout-e .video-wrapper,
.fullscreen-target:-webkit-full-screen .layout-e .video-wrapper,
.fullscreen-target:-moz-full-screen .layout-e .video-wrapper {
  flex: 1;
  min-height: 0;
  background-color: #000 !important;
}
.fullscreen-target:fullscreen .layout-e .video-wrapper video,
.fullscreen-target:-webkit-full-screen .layout-e .video-wrapper video,
.fullscreen-target:-moz-full-screen .layout-e .video-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 全屏：前视 HUD 尺寸放大回全屏比例 */
.fullscreen-target:fullscreen .video-section .status-hud-xiaomi,
.fullscreen-target:-webkit-full-screen .video-section .status-hud-xiaomi,
.fullscreen-target:-moz-full-screen .video-section .status-hud-xiaomi {
  padding: 28px 48px 16px;
  gap: 32px;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.82) 0%,
    rgba(0, 0, 0, 0.45) 42%,
    rgba(0, 0, 0, 0.12) 72%,
    transparent 100%
  );
}
.fullscreen-target:fullscreen .video-section .hud-speed-num,
.fullscreen-target:-webkit-full-screen .video-section .hud-speed-num,
.fullscreen-target:-moz-full-screen .video-section .hud-speed-num {
  font-size: 56px;
}
.fullscreen-target:fullscreen .video-section .hud-soc-num,
.fullscreen-target:-webkit-full-screen .video-section .hud-soc-num,
.fullscreen-target:-moz-full-screen .video-section .hud-soc-num {
  font-size: 17px;
}
.fullscreen-target:fullscreen .video-section .hud-soc-icon,
.fullscreen-target:-webkit-full-screen .video-section .hud-soc-icon,
.fullscreen-target:-moz-full-screen .video-section .hud-soc-icon {
  width: 18px;
  height: 18px;
}
.fullscreen-target:fullscreen .video-section .hud-beam-svg,
.fullscreen-target:-webkit-full-screen .video-section .hud-beam-svg,
.fullscreen-target:-moz-full-screen .video-section .hud-beam-svg {
  width: 30px;
  height: 30px;
}
.fullscreen-target:fullscreen .video-section .hud-gear-char,
.fullscreen-target:-webkit-full-screen .video-section .hud-gear-char,
.fullscreen-target:-moz-full-screen .video-section .hud-gear-char {
  font-size: 30px;
}

.fullscreen-target:fullscreen .video-section .hud-ts-arrow,
.fullscreen-target:-webkit-full-screen .video-section .hud-ts-arrow,
.fullscreen-target:-moz-full-screen .video-section .hud-ts-arrow {
  width: 64px;
  height: 44px;
}

.fullscreen-target:fullscreen .video-section .hud-ts-label,
.fullscreen-target:-webkit-full-screen .video-section .hud-ts-label,
.fullscreen-target:-moz-full-screen .video-section .hud-ts-label {
  font-size: 11px;
}

.fullscreen-target:fullscreen .video-section .hud-turn-overlay,
.fullscreen-target:-webkit-full-screen .video-section .hud-turn-overlay,
.fullscreen-target:-moz-full-screen .video-section .hud-turn-overlay {
  bottom: 90px;
  padding: 0 48px;
}
.fullscreen-target:fullscreen .video-section .hud-turn-overlay--on-guide,
.fullscreen-target:-webkit-full-screen .video-section .hud-turn-overlay--on-guide,
.fullscreen-target:-moz-full-screen .video-section .hud-turn-overlay--on-guide {
  inset: 0;
  bottom: 0;
  padding: 0;
}
.fullscreen-target:fullscreen .video-section .hud-ts-arrow,
.fullscreen-target:-webkit-full-screen .video-section .hud-ts-arrow,
.fullscreen-target:-moz-full-screen .video-section .hud-ts-arrow {
  width: 56px;
  height: 38px;
}
.fullscreen-target:fullscreen .video-section .hud-stat-value,
.fullscreen-target:-webkit-full-screen .video-section .hud-stat-value,
.fullscreen-target:-moz-full-screen .video-section .hud-stat-value {
  font-size: 24px;
}
.fullscreen-target:fullscreen .video-section .hud-stat-label,
.fullscreen-target:-webkit-full-screen .video-section .hud-stat-label,
.fullscreen-target:-moz-full-screen .video-section .hud-stat-label {
  font-size: 11px;
}
.fullscreen-target:fullscreen .video-section .hud-stat,
.fullscreen-target:-webkit-full-screen .video-section .hud-stat,
.fullscreen-target:-moz-full-screen .video-section .hud-stat {
  min-width: 52px;
}
.fullscreen-target:fullscreen .video-section .hud-stat-sep,
.fullscreen-target:-webkit-full-screen .video-section .hud-stat-sep,
.fullscreen-target:-moz-full-screen .video-section .hud-stat-sep {
  height: 30px;
  margin: 0 12px;
}
.fullscreen-target:fullscreen .video-section .hud-bar,
.fullscreen-target:-webkit-full-screen .video-section .hud-bar,
.fullscreen-target:-moz-full-screen .video-section .hud-bar {
  width: 220px;
  height: 4px;
}
.fullscreen-target:fullscreen .video-section .hud-speed-unit,
.fullscreen-target:-webkit-full-screen .video-section .hud-speed-unit,
.fullscreen-target:-moz-full-screen .video-section .hud-speed-unit {
  font-size: 16px;
}
.fullscreen-target:fullscreen .video-section .hud-dm-circle,
.fullscreen-target:-webkit-full-screen .video-section .hud-dm-circle,
.fullscreen-target:-moz-full-screen .video-section .hud-dm-circle {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.fullscreen-target:-webkit-full-screen {
  background: #0a0a0a !important;
  padding: 4px 4px 0;
  margin: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
}

.fullscreen-target:-moz-full-screen {
  background: #0a0a0a !important;
  padding: 4px 4px 0;
  margin: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
}

.video-box {
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
  display: flex;
  flex-direction: column;
}

/* HUD：小米天际屏风格 - 左档位 | 中速度+进度条(焦点) | 右次要信息+底线 */
.status-hud-xiaomi {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 32px 10px;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.35) 50%,
    transparent 100%
  );
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
  font-variant-numeric: tabular-nums;
}

.status-hud-xiaomi .hud-left {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}

.status-hud-xiaomi .hud-left-cluster {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.status-hud-xiaomi .hud-soc-beam-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.status-hud-xiaomi .hud-beam-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  margin-top: 1px;
}

.status-hud-xiaomi .hud-beam-lamp {
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.28);
  cursor: help;
  pointer-events: auto;
  transition: color 0.18s ease, filter 0.18s ease;
}

/* 与 PRND 行视觉一致：gear 字 20px / M 圆 22px，灯标取 26px 与整行对齐 */
.status-hud-xiaomi .hud-beam-svg {
  width: 26px;
  height: 26px;
  display: block;
}

/* 近/远光：参考图 #00FFCC 系霓虹 + bloom */
.status-hud-xiaomi .hud-beam-svg--xiaomi {
  shape-rendering: geometricPrecision;
}

.status-hud-xiaomi .hud-beam-lamp-low.is-lit {
  color: #00ffcc;
  filter: drop-shadow(0 0 2px rgba(0, 255, 204, 1)) drop-shadow(0 0 10px rgba(0, 255, 204, 0.65))
    drop-shadow(0 0 20px rgba(0, 255, 204, 0.38));
}

.status-hud-xiaomi .hud-beam-lamp-high.is-lit {
  color: #4dffea;
  filter: drop-shadow(0 0 2px rgba(77, 255, 234, 1)) drop-shadow(0 0 12px rgba(77, 255, 234, 0.55))
    drop-shadow(0 0 22px rgba(77, 255, 234, 0.3));
}

@media (prefers-reduced-motion: reduce) {
  .status-hud-xiaomi .hud-beam-lamp {
    transition: none;
  }

  .status-hud-xiaomi .hud-beam-lamp-low.is-lit,
  .status-hud-xiaomi .hud-beam-lamp-high.is-lit {
    filter: drop-shadow(0 0 5px rgba(0, 255, 204, 0.75));
  }

  .status-hud-xiaomi .hud-beam-lamp-high.is-lit {
    filter: drop-shadow(0 0 5px rgba(77, 255, 234, 0.75));
  }
}

.status-hud-xiaomi .hud-soc-strip {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: help;
  pointer-events: auto;
  color: rgba(255, 255, 255, 0.88);
  transition: color 0.2s ease, filter 0.2s ease;
}

.status-hud-xiaomi .hud-soc-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  opacity: 0.92;
}

.status-hud-xiaomi .hud-soc-value {
  display: inline-flex;
  align-items: baseline;
  gap: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.status-hud-xiaomi .hud-soc-num {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.status-hud-xiaomi .hud-soc-pct {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  margin-left: 1px;
}

.status-hud-xiaomi .hud-soc-strip.is-low {
  color: #fbbf24;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.35));
}

.status-hud-xiaomi .hud-soc-strip.is-low .hud-soc-pct {
  color: rgba(251, 191, 36, 0.75);
}

.status-hud-xiaomi .hud-soc-strip.is-critical {
  color: #f87171;
  filter: drop-shadow(0 0 8px rgba(248, 113, 113, 0.45));
}

.status-hud-xiaomi .hud-soc-strip.is-critical .hud-soc-pct {
  color: rgba(248, 113, 113, 0.8);
}

@media (prefers-reduced-motion: reduce) {
  .status-hud-xiaomi .hud-soc-strip {
    transition: none;
  }
}

.status-hud-xiaomi .hud-gear-row {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  gap: 10px;
}

.status-hud-xiaomi .hud-drivemode-pair {
  display: flex;
  align-items: center;
  margin-right: 2px;
  cursor: help;
  pointer-events: auto;
}

.status-hud-xiaomi .hud-dm-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  box-sizing: border-box;
  border: 2px solid rgba(255, 255, 255, 0.28);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.32);
  line-height: 1;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.status-hud-xiaomi .hud-dm-circle.is-manual {
  border-color: rgba(255, 255, 255, 0.9);
  color: rgba(255, 255, 255, 0.95);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.status-hud-xiaomi .hud-dm-circle.is-auto {
  border-color: rgba(130, 210, 255, 0.95);
  color: rgba(140, 220, 255, 1);
  background: rgba(100, 180, 255, 0.12);
  box-shadow: 0 0 12px rgba(100, 180, 255, 0.35);
}

.status-hud-xiaomi .hud-dm-circle.is-remote {
  border-color: rgba(255, 165, 50, 0.95);
  color: rgba(255, 175, 60, 1);
  background: rgba(255, 140, 0, 0.15);
  box-shadow: 0 0 12px rgba(255, 140, 0, 0.4);
}

.status-hud-xiaomi .hud-dm-circle.is-unknown {
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.28);
  font-size: 14px;
  font-weight: 600;
}

.status-hud-xiaomi .hud-gear-sep {
  width: 1px;
  align-self: stretch;
  min-height: 22px;
  margin: 0 2px 2px 0;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(255, 255, 255, 0.22) 15%,
    rgba(255, 255, 255, 0.22) 85%,
    transparent
  );
}

.status-hud-xiaomi .hud-gear-char {
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.32);
  letter-spacing: 0.02em;
  line-height: 1;
  transition: color 0.15s ease, opacity 0.15s ease;
}

.status-hud-xiaomi .hud-gear-char.active {
  color: #fff;
  font-weight: 700;
  text-shadow: 0 0 12px rgba(255, 255, 255, 0.35);
}

/* ── HUD 中间：速度 ── */
.status-hud-xiaomi .hud-center {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

/* ── Turn Signal Overlay: top of front camera, left/right symmetric ── */
.hud-turn-overlay {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 32px;
  pointer-events: none;
}

/* 开启前视距离引导时：铺满前视区，左右轮锚在 0.5m 横线端点（与 FrontCameraDistanceGuide 归一化坐标一致） */
.hud-turn-overlay--on-guide {
  /* 勿用 inset 简写，以便行内与标定内接框 left/top/width/height 对齐时覆盖 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: block;
  padding: 0;
}

.hud-guide-anchor {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.hud-guide-anchor__wheel-center {
  position: absolute;
  left: 0;
  top: 0;
}

.hud-guide-anchor__turn-above {
  position: absolute;
  left: 0;
  top: 0;
  /* 轮子在端点上方摆动，转向灯再叠在轮子上方（约 32px 轮高 + 间距） */
  transform: translate(-50%, calc(-100% - 40px));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hud-turn-overlay--on-guide .hud-guide-anchor :deep(.hud-turn-wheel) {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

/* 转向灯在外、前轮示意在内（靠向画面中心） */
.hud-turn-cluster {
  display: flex;
  flex-direction: row;
  pointer-events: none;
}
.hud-turn-cluster--overlay {
  align-items: flex-end;
  gap: 6px;
}
.hud-turn-cluster--overlay.hud-turn-cluster-left :deep(.hud-turn-wheel) {
  margin-left: 14px;
}
.hud-turn-cluster--overlay.hud-turn-cluster-right :deep(.hud-turn-wheel) {
  margin-right: 14px;
}
.hud-turn-cluster--bar {
  position: relative;
  z-index: 2;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.hud-turn-cluster--bar.hud-turn-cluster-left :deep(.hud-turn-wheel) {
  margin-left: 10px;
}
.hud-turn-cluster--bar.hud-turn-cluster-right :deep(.hud-turn-wheel) {
  margin-right: 10px;
}

.hud-ts-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  opacity: 0.12;
  transition: opacity 0.15s ease;
}

.hud-ts-wrap.is-on {
  opacity: 1;
  animation: hud-ts-blink 0.8s step-end infinite;
}

.hud-ts-wrap.is-on .hud-ts-arrow {
  fill: #22c55e;
  filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.7))
          drop-shadow(0 0 24px rgba(34, 197, 94, 0.35));
}

.hud-ts-wrap.is-on .hud-ts-label {
  color: #22c55e;
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.hud-ts-wrap.is-hazard {
  animation-duration: 0.6s;
}

.hud-ts-wrap.is-hazard .hud-ts-arrow {
  fill: #f59e0b;
  filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.7))
          drop-shadow(0 0 24px rgba(245, 158, 11, 0.35));
}

.hud-ts-wrap.is-hazard .hud-ts-label {
  color: #f59e0b;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.5);
}

.hud-ts-arrow {
  width: 32px;
  height: 22px;
  fill: rgba(255, 255, 255, 0.85);
  transition: fill 0.15s ease, filter 0.15s ease;
}

.hud-ts-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  transition: color 0.15s ease;
}

@keyframes hud-ts-blink {
  0%   { opacity: 1; }
  50%  { opacity: 0.08; }
  100% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .hud-ts-wrap.is-on,
  .hud-ts-wrap.is-hazard {
    animation: none;
    opacity: 1;
  }
}

.status-hud-xiaomi .hud-speed-block {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.status-hud-xiaomi .hud-speed-num {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  letter-spacing: -0.04em;
  text-shadow:
    0 0 24px rgba(255, 255, 255, 0.22),
    0 2px 6px rgba(0, 0, 0, 0.45);
}

.status-hud-xiaomi .hud-speed-unit {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  letter-spacing: 0.04em;
  text-transform: lowercase;
  padding-bottom: 4px;
}

.status-hud-xiaomi .hud-bar {
  width: 120px;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}

.status-hud-xiaomi .hud-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.65));
  border-radius: 2px;
  transition: width 0.25s ease;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.30);
}

/* ── HUD 右侧：转向 · 油门 · 制动 ── */
.status-hud-xiaomi .hud-right {
  display: flex;
  align-items: flex-end;
  gap: 0;
}

.status-hud-xiaomi .hud-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 36px;
}

.status-hud-xiaomi .hud-stat-steer {
  min-width: calc(22px + 4px + 5ch);
}

.status-hud-xiaomi .hud-stat-steer.is-steer-deg-hidden {
  min-width: 22px;
}

.status-hud-xiaomi .hud-stat-label {
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.42);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.status-hud-xiaomi .hud-stat-value {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}

.status-hud-xiaomi .hud-stat-unit {
  font-size: 12px;
  font-weight: 400;
  font-style: normal;
  color: rgba(255, 255, 255, 0.45);
  margin-left: 1px;
}

.status-hud-xiaomi .hud-stat-sep {
  display: inline-block;
  width: 1px;
  height: 20px;
  margin: 0 6px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.16) 20%,
    rgba(255, 255, 255, 0.16) 80%,
    transparent 100%
  );
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 2px;
}

/* HUD 油门 / 制动：图标明暗（不显示百分比） */
.status-hud-xiaomi .hud-stat-pedal .hud-pedal-lamp {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  color: rgba(255, 255, 255, 0.3);
  transition: color 0.2s ease, filter 0.2s ease;
}

.status-hud-xiaomi .hud-pedal-lamp .hud-pedal-svg {
  width: 22px;
  height: 22px;
  display: block;
}

.status-hud-xiaomi .hud-pedal-lamp-accel.is-lit {
  color: #aed581;
  filter: drop-shadow(0 0 7px rgba(174, 213, 129, 0.7));
}

.status-hud-xiaomi .hud-pedal-lamp-brake.is-lit {
  color: #ff6b6b;
  filter: drop-shadow(0 0 9px rgba(255, 107, 107, 0.55));
}

@media (prefers-reduced-motion: reduce) {
  .status-hud-xiaomi .hud-stat-pedal .hud-pedal-lamp {
    transition: none;
  }
}

/* A 布局：2×2，每行 50%，每格 960:768 */
.layout-mode-a {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.layout-a {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 2px;
}

.layout-a-row1,
.layout-a-row2 {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  gap: 2px;
}

.layout-a-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.layout-a-col-front .video-with-hud {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.layout-a-col .video-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}


.layout-a-col .video-wrapper {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  position: relative;
  overflow: hidden;
}

.layout-a-col .video-wrapper .webrtc-player,
.layout-a-col .video-wrapper :deep(.webrtc-player),
.layout-a-col .video-wrapper .video-placeholder,
.layout-a-col .video-wrapper :deep([class*="player"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.layout-a-col .video-wrapper video,
.layout-a-col .video-wrapper :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-grid .ant-col {
  margin-bottom: 2px;
}

.fullscreen-target:not(:fullscreen) .video-section.layout-mode-a {
  flex: 1;
  min-height: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ━━━ 驾驶视图：前视自适应 + 侧栏，动态比例 ━━━ */
.layout-d {
  display: flex;
  flex: 1;
  min-height: 0;
  height: 100%;
  gap: 2px;
}
.layout-d-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
/** 前视与标定 960×768 内接层同尺寸的测量宿主（与 VideoCell .video-box 同大） */
.detail-front-calib-host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.layout-mode-b .video-box.video-box-front.detail-b-front-calib {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.layout-d-main .video-with-hud {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.layout-d-main .video-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.layout-d-main .video-wrapper,
.layout-d-main :deep(.video-wrapper) {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  position: relative;
  overflow: hidden;
}
.layout-d-main .video-wrapper .webrtc-player,
.layout-d-main .video-wrapper :deep(.webrtc-player),
.layout-d-main .video-wrapper .video-placeholder,
.layout-d-main .video-wrapper :deep([class*="player"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-d-main video,
.layout-d-main :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.layout-d-side {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.layout-d-cell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.layout-d-cell .video-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.layout-d-cell .video-wrapper,
.layout-d-cell :deep(.video-wrapper) {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  position: relative;
  overflow: hidden;
}
.layout-d-cell .video-wrapper .webrtc-player,
.layout-d-cell .video-wrapper :deep(.webrtc-player),
.layout-d-cell .video-wrapper .video-placeholder,
.layout-d-cell .video-wrapper :deep([class*="player"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-d-cell video,
.layout-d-cell :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.fullscreen-target:not(:fullscreen) .video-section.layout-mode-d {
  flex: 1;
  min-height: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Layout E：左中右 + CSS 层交换（不重载视频） ──
 *
 *  front / back 各只渲染一次，通过 CSS position 切换大小位置。
 *  HUD 独立层，始终覆盖在主画面上方。
 *  未勾选挂后：行 align-items:center，左右与中栏垂直居中。
 *  勾选挂后：行 align-items:stretch，三列同高（侧栏去掉 aspect-ratio 后须拉伸，否则 height:100% 子项会塌成只显示中栏）。
 *
 *  D 档:                          R 档 (is-reverse):
 *  ┌────────┬───────────────┬────────┐  ┌────────┬───────────────┬────────┐
 *  │        │ ┌PiP 后┐      │        │  │        │ ┌PiP 前┐      │        │
 *  │        │ └──────┘      │        │  │        │ └──────┘      │        │
 *  │        │   前 (主)     │        │  │        │   后 (主)     │        │
 *  │  左    │   + HUD      │   右   │  │  左    │   + HUD      │   右   │
 *  └────────┴───────────────┴────────┘  └────────┴───────────────┴────────┘
 */
.layout-e {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 0;
  height: 100%;
  gap: 2px;
  background: #0a0a0a;
  padding: 2px;
}

/* 挂后：三列拉伸同高，侧栏内上下两路才能分到高度（flex-start + 父高 auto 会导致侧栏高度为 0） */
.layout-e.layout-e--hitch-sides {
  align-items: stretch;
}

/* 挂后：左右列内叠 rear；列为 flex 纵轴容器，高由行拉伸决定 */
.layout-e.layout-e--hitch-sides .layout-e-left,
.layout-e.layout-e--hitch-sides .layout-e-right {
  aspect-ratio: unset;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}
.layout-e.layout-e--hitch-sides .layout-e-side-stack {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  width: 100%;
  min-height: 0;
  max-height: 100%;
  height: 100%;
  gap: 2px;
}
.layout-e.layout-e--hitch-sides .layout-e-side-half {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  aspect-ratio: unset;
}

/* ── 左右侧栏 ── */
.layout-e-left,
.layout-e-right {
  min-width: 0;
  position: relative;
  aspect-ratio: 960 / 768;
  max-height: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.4);
}
.layout-e-left :deep(.video-box),
.layout-e-right :deep(.video-box) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.layout-e-left :deep(.video-wrapper),
.layout-e-right :deep(.video-wrapper) {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.layout-e-left :deep(.video-wrapper .webrtc-player),
.layout-e-left :deep(.video-wrapper [class*="player"]),
.layout-e-right :deep(.video-wrapper .webrtc-player),
.layout-e-right :deep(.video-wrapper [class*="player"]),
.layout-e-left :deep(.video-wrapper .video-placeholder),
.layout-e-right :deep(.video-wrapper .video-placeholder) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-e-left :deep(video),
.layout-e-right :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center center;
}

/* 左中右 + 挂后：左右列内上下两路，等高平分 */
.layout-e-side-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 2px;
  box-sizing: border-box;
}
.layout-e-side-half {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* 单列模式：左眼/右眼不卸组件；内层不搞双边框（外栏 layout-e-left/right 已描边） */
.layout-e-side-stack--solo {
  gap: 0;
  background: transparent;
}
.layout-e-side-stack--solo > .layout-e-side-half {
  flex: 1 1 auto;
  border: none;
  border-radius: 0;
  background: transparent;
}

/* ── 中间区域（层叠容器） ── */
.layout-e-center {
  min-width: 0;
  position: relative;
  aspect-ratio: 960 / 768;
  max-height: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

/* ── 视频层：共用样式 ── */
.layout-e-layer {
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.layout-e-layer :deep(.video-box) {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.layout-e-layer :deep(.video-wrapper) {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.layout-e-layer :deep(.video-wrapper .webrtc-player),
.layout-e-layer :deep(.video-wrapper [class*="player"]),
.layout-e-layer :deep(.video-wrapper .video-placeholder) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-e-layer :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* ── 中列双层：D=前主后隐, R=后主前隐，WebRTC 双流始终在线 ── */
.layout-e-layer-front {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.layout-e-layer-back {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: none;
}
/* 倒车：交换可见层 */
.layout-e-center.is-reverse .layout-e-layer-front {
  display: none;
}
.layout-e-center.is-reverse .layout-e-layer-back {
  display: block;
}

/* ── 右列双层：与中列相反，D=后主前隐, R=前主后隐。直接在 layout-e-side-half 内 absolute 叠放，去掉多余 wrapper 避免黑底 ── */
.layout-e-right-dual-host {
  position: relative;
  background: transparent;
}
.layout-e-right-layer-front,
.layout-e-right-layer-back {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.layout-e-right-layer-front {
  display: none;
}
.layout-e-right-dual-host.is-reverse .layout-e-right-layer-front {
  display: block;
}
.layout-e-right-dual-host.is-reverse .layout-e-right-layer-back {
  display: none;
}

/* ── cam_f_7 辅助前视 PiP：左缘对齐中列左缘，scale(1.5) 溢出 ── */
.layout-e-layer-f7 {
  position: absolute;
  top: 8px;
  /* 中列左缘 = 左列宽(27% of available) + gap(2px) + padding-left(2px) */
  left: calc((100% - 8px) * 0.27 + 4px);
  /* 宽度与 back PiP 一致：中列宽(46%) × 4/15 */
  width: calc(100% * 0.46 * 4 / 15);
  aspect-ratio: 960 / 768;
  z-index: 8;
  /* 容器仅作定位锚点，透明无边框，video scale 溢出自然浮于主画面上 */
  background: transparent;
  overflow: visible;
  outline: none;
  transition: none;
}
.layout-e-layer-f7 :deep(.video-badge) {
  /* badge 在 scale 后位置偏了，隐藏 */
  display: none;
}
/* VideoCell 内部 overflow:hidden 需打通，让 scale(1.5) 溢出可见 */
.layout-e-layer-f7 :deep(.video-box),
.layout-e-layer-f7 :deep(.video-wrapper) {
  overflow: visible;
}
/* 覆盖播放器黑底：webrtc-player / media-player-container 背景设透明，避免 PiP 容器内出现黑条 */
.layout-e-layer-f7 :deep(.webrtc-player),
.layout-e-layer-f7 :deep(.media-player-container) {
  background: transparent;
}
.layout-e-layer-f7 :deep(video) {
  /* !important 必须：WebRtcPlayer 组件 video 上 objectFit/transform 是内联 style，优先级最高 */
  object-fit: cover !important;
  /* scale(1.5) + bottom left → 等比放大，translateY 微调下移盖住容器 */
  transform-origin: bottom left;
  transform: scale(1.5) translateY(2px) !important;
}

/* 视频裁剪 */
.layout-e-layer :deep(video) { object-fit: contain; }

/* 远控工作台 Layout-E 定制 */
.pd-remote-focus-deck .layout-e-layer-f7 {
  width: calc(100% * 0.46 * 16 / 45);
}

/* ── 前视距离引导：与 HUD 同级叠放，须高于 HUD(5) 才能看见；位置与 960×768 内接框由行内对齐 VideoCell ── */
.layout-e-front-distance-guide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 6;
  pointer-events: none;
}

/* ── Layout-E：前轮示意叠在引导线之上（0.5m 端点），z-index 高于引导层 ── */
.layout-e-wheels-on-guide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 7;
  pointer-events: none;
}

/* ── MRC1 可拖动圆形按钮：红色脉冲辉光，可拖拽自由定位 ── */
.layout-e-mrc1-badge {
  position: absolute;
  z-index: 9;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}
.mrc1-circle-btn {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid rgba(74, 222, 128, 0.55);
  background: rgba(34, 197, 94, 0.85);
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.05em;
  line-height: 1;
  cursor: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  outline: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow:
    0 0 14px rgba(34, 197, 94, 0.4),
    0 0 32px rgba(34, 197, 94, 0.2),
    0 0 60px rgba(34, 197, 94, 0.08),
    inset 0 1.5px 0 rgba(255, 255, 255, 0.18);
  animation:
    mrc1-active-breath 2.4s ease-in-out infinite,
    mrc1-active-border 3s ease-in-out infinite;
  transition: transform 0.18s cubic-bezier(0.25, 0.8, 0.25, 1.4),
              box-shadow 0.25s ease;

  &::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2.5px solid rgba(74, 222, 128, 0.35);
    animation: mrc1-active-ripple 2.4s ease-out infinite;
    pointer-events: none;
  }

  &::before { display: none; }

  &:hover {
    transform: scale(1.12);
    box-shadow:
      0 0 24px rgba(34, 197, 94, 0.65),
      0 0 48px rgba(34, 197, 94, 0.3),
      0 0 80px rgba(34, 197, 94, 0.12),
      inset 0 2px 0 rgba(255, 255, 255, 0.25);
  }

  &:active {
    transform: scale(0.94);
    transition: transform 0.08s ease;
  }

  &.is-dragging {
    transform: scale(1.08);
    animation: mrc1-drag-glow 0.6s ease-in-out infinite;
    &::after { animation: none; opacity: 0; }
  }

  /* MRC1 告警态：红色呼吸 + 光环 + 扫光 */
  &.is-alarm {
    background: rgba(220, 38, 38, 0.9);
    border-color: rgba(248, 113, 113, 0.6);
    animation:
      mrc1-breath 2.4s ease-in-out infinite,
      mrc1-border-glow 3s ease-in-out infinite;
    &::after {
      display: block;
      border-color: rgba(248, 113, 113, 0.45);
      animation-name: mrc1-ripple;
    }
    &::before {
      display: block;
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        rgba(255, 255, 255, 0.15) 60deg,
        transparent 120deg,
        transparent 360deg
      );
      animation: mrc1-sweep 4s linear infinite;
      pointer-events: none;
    }

    &:hover {
      box-shadow:
        0 0 32px rgba(220, 38, 38, 0.75),
        0 0 64px rgba(220, 38, 38, 0.4),
        0 0 100px rgba(220, 38, 38, 0.18),
        inset 0 2px 0 rgba(255, 255, 255, 0.25),
        inset 0 -3px 8px rgba(0, 0, 0, 0.25);
    }
  }
}
.mrc1-circle-icon {
  position: relative;
  z-index: 1;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

/* 告警态文字：呼吸动画 */
.mrc1-circle-btn.is-alarm .mrc1-circle-icon {
  animation: mrc1-text-pulse 2.4s ease-in-out infinite;
  color: #fff;
  text-shadow: 0 1px 4px rgba(180, 0, 0, 0.5);
}

/* ── 辉光呼吸（3层 box-shadow 深浅交替） ── */
@keyframes mrc1-breath {
  0%, 100% {
    box-shadow:
      0 0 18px rgba(220, 38, 38, 0.5),
      0 0 42px rgba(220, 38, 38, 0.28),
      0 0 80px rgba(220, 38, 38, 0.12),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.2),
      inset 0 -2px 6px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow:
      0 0 32px rgba(220, 38, 38, 0.72),
      0 0 64px rgba(220, 38, 38, 0.42),
      0 0 100px rgba(220, 38, 38, 0.22),
      0 4px 8px rgba(220, 38, 38, 0.15),
      inset 0 2px 0 rgba(255, 255, 255, 0.28),
      inset 0 -3px 8px rgba(0, 0, 0, 0.3);
  }
}

/* ── 外扩光环：放大 + 淡出 ── */
@keyframes mrc1-ripple {
  0%   { inset: -6px;  opacity: 1;    border-width: 2.5px; }
  50%  { inset: -12px; opacity: 0.45; border-width: 1.5px; }
  100% { inset: -22px; opacity: 0;    border-width: 0.5px; }
}

/* ── 边框色呼吸 ── */
@keyframes mrc1-border-glow {
  0%, 100% { border-color: rgba(248, 113, 113, 0.55); }
  50%      { border-color: rgba(255, 140, 140, 0.85); }
}

/* ── 高光锥旋转 ── */
@keyframes mrc1-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── 文字微呼吸 ── */
@keyframes mrc1-text-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.08); }
}

/* ── 拖拽中简化辉光 ── */
@keyframes mrc1-drag-glow {
  0%, 100% {
    box-shadow:
      0 0 40px rgba(220, 38, 38, 0.75),
      0 0 80px rgba(220, 38, 38, 0.4);
  }
  50% {
    box-shadow:
      0 0 56px rgba(220, 38, 38, 0.9),
      0 0 100px rgba(220, 38, 38, 0.5);
  }
}

/* ── 激活态（正常/绿色）动画 ── */
@keyframes mrc1-active-breath {
  0%, 100% {
    box-shadow:
      0 0 14px rgba(34, 197, 94, 0.4),
      0 0 32px rgba(34, 197, 94, 0.2),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.18);
  }
  50% {
    box-shadow:
      0 0 24px rgba(34, 197, 94, 0.6),
      0 0 48px rgba(34, 197, 94, 0.3),
      inset 0 2px 0 rgba(255, 255, 255, 0.25);
  }
}
@keyframes mrc1-active-ripple {
  0%   { inset: -6px;  opacity: 0.8;  border-width: 2.5px; }
  50%  { inset: -10px; opacity: 0.35; border-width: 1.5px; }
  100% { inset: -18px; opacity: 0;    border-width: 0.5px; }
}
@keyframes mrc1-active-border {
  0%, 100% { border-color: rgba(74, 222, 128, 0.5); }
  50%      { border-color: rgba(134, 239, 172, 0.8); }
}

@media (prefers-reduced-motion: reduce) {
  .mrc1-circle-btn,
  .mrc1-circle-icon,
  .mrc1-circle-btn.is-alarm::after,
  .mrc1-circle-btn.is-alarm::before {
    animation: none !important;
  }
  .mrc1-circle-btn::after { opacity: 0; }
  .mrc1-circle-btn.is-alarm::after { opacity: 0; }
  .mrc1-circle-btn.is-alarm::before { opacity: 0; }
}

/* ── HUD 叠加层：独立于视频，始终覆盖主画面 ── */
.layout-e-hud-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}
.layout-e-hud-overlay .status-hud {
  pointer-events: auto;
}

/* ── Layout-E HUD：字体放大 + 转向灯内联 ── */
.layout-e-hud .hud-speed-num {
  font-size: 42px;
}
.layout-e-hud .hud-speed-unit {
  font-size: 14px;
}
.layout-e-hud .hud-stat-value {
  font-size: 18px;
}
.layout-e-hud .hud-stat-label {
  font-size: 10px;
}
.layout-e-hud .hud-gear-char {
  font-size: 22px;
}
.layout-e-hud .hud-dm-circle {
  width: 24px;
  height: 24px;
  font-size: 13px;
}
.layout-e-hud .hud-soc-num {
  font-size: 14px;
}
.layout-e-hud .hud-soc-icon {
  width: 16px;
  height: 16px;
}
.layout-e-hud .hud-beam-svg {
  width: 28px;
  height: 28px;
}
.layout-e-hud .hud-stat-sep {
  height: 24px;
  margin: 0 8px;
}
.layout-e-hud .hud-stat {
  min-width: 40px;
}
.layout-e-hud .hud-stat-steer {
  min-width: calc(22px + 4px + 5ch);
}
.layout-e-hud .hud-stat-steer.is-steer-deg-hidden {
  min-width: 22px;
}
.layout-e-hud .hud-bar {
  width: 140px;
  height: 3px;
}
.layout-e-hud :deep(.hud-turn-cluster--bar .hud-turn-wheel-svg) {
  width: 10px;
  height: 32px;
}
.layout-e-hud.status-hud-xiaomi {
  padding: 24px 28px 12px;
  gap: 12px;
}

/* ── 内联转向灯：速度两侧 ── */
.hud-ts-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.10;
  transition: opacity 0.15s ease;
  padding: 0 4px;
}
.hud-ts-inline .hud-ts-arrow {
  width: 36px;
  height: 24px;
}
.hud-ts-inline.is-on {
  opacity: 1;
  animation: hud-ts-blink 0.8s step-end infinite;
}
.hud-ts-inline.is-on .hud-ts-arrow {
  fill: #22c55e;
  filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.7))
          drop-shadow(0 0 24px rgba(34, 197, 94, 0.35));
}
.hud-ts-inline.is-hazard {
  animation-duration: 0.6s;
}
.hud-ts-inline.is-hazard .hud-ts-arrow {
  fill: #f59e0b;
  filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.7))
          drop-shadow(0 0 24px rgba(245, 158, 11, 0.35));
}
@media (prefers-reduced-motion: reduce) {
  .hud-ts-inline.is-on,
  .hud-ts-inline.is-hazard {
    animation: none;
    opacity: 1;
  }
}

.fullscreen-target:not(:fullscreen) .video-section.layout-mode-e {
  flex: 1;
  min-height: 0;
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* B 布局非全屏：一行两列，后左右各为前高度的 1/3 */
.layout-mode-b .layout-b-row {
  display: flex;
  width: 100%;
}
.layout-mode-b .layout-b-row .ant-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.layout-mode-b .layout-b-right-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  justify-content: center;
}
.layout-mode-b .layout-b-inner-row {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.layout-mode-b .layout-b-inner-row .ant-col {
  flex: 1;
  min-height: 0;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
}
.layout-mode-b .layout-b-inner-row .video-box {
  flex: 1;
  min-height: 0;
}
.layout-mode-b .layout-b-inner-row .video-wrapper {
  aspect-ratio: unset;
}

/* C 布局：两行各 50%，第一行前视居中 960:768，第二行三列各 960:768 */
.video-section.layout-mode-c {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
/* 非全屏布局 C：与全屏一致，flex 占满剩余空间 */
.fullscreen-target:not(:fullscreen) .video-section.layout-mode-c {
  margin-top: 0 !important;
  padding-top: 0 !important;
  border-top: none !important;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.layout-c {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  gap: 2px;
}
.layout-c-row1 {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.layout-c-row1-inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  align-self: stretch;
  width: 100%;
  max-height: 100%;
}
.layout-c-video-wrap {
  flex: 1;
  min-height: 0;
  aspect-ratio: 960 / 768;
  max-width: 100%;
  max-height: 100%;
  position: relative;
  background: #000;
}
.layout-c-paint {
  position: relative;
  overflow: hidden;
}
  /* 内接 960×768 时 paint 的绝对定位由行内 zIndex 等覆盖；子层仍填满 paint */
.layout-c-video-wrap .layout-c-paint .webrtc-player,
.layout-c-video-wrap .layout-c-paint :deep(.webrtc-player),
.layout-c-video-wrap .layout-c-paint .video-placeholder,
.layout-c-video-wrap .layout-c-paint :deep([class*='player']) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-c-video-wrap .layout-c-paint video,
.layout-c-video-wrap .layout-c-paint :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.layout-c-row2 {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  gap: 2px;
}
.layout-c-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.layout-c-col .video-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.layout-c-col .video-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.layout-c-col .video-wrapper .webrtc-player,
.layout-c-col .video-wrapper :deep(.webrtc-player),
.layout-c-col .video-wrapper .video-placeholder,
.layout-c-col .video-wrapper :deep([class*="player"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-c-col .video-wrapper video,
.layout-c-col .video-wrapper :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
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

.video-wrapper {
  /* 车辆视频 16:9，与 VideoCell 一致 */
  flex: 1;
  min-height: 120px;
  aspect-ratio: 16 / 9;
  position: relative;
}

.panel-wrapper {
  background: #1a1a1a;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
}

.status-content {
  gap: 16px;
}

.status-speed {
  text-align: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.status-speed .status-value {
  font-size: 36px;
  font-weight: 600;
  color: #fff;
  margin-right: 4px;
}

.status-speed .status-unit {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-item .status-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.status-item .status-value {
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
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

<style lang="less">
/* =====================================================================
 * 全屏远控条 — 暗黑主题（非 scoped，.fs-layout-dark 激活）
 * ===================================================================
 * 毛玻璃控制条 · 低对比柔光 · pill 按钮 · 统一 8px 圆角
 * =================================================================== */
@rc-bg:            rgba(16, 18, 24, 0.88);
@rc-accent:        #5b8cff;
@rc-accent-hover:  #7aa3ff;
@rc-accent-glow:   rgba(91, 140, 255, 0.18);
@rc-danger:        #f5564a;
@rc-danger-bg:     rgba(245, 86, 74, 0.12);
@rc-text:          rgba(255, 255, 255, 0.92);
@rc-text-dim:      rgba(255, 255, 255, 0.74);
@rc-text-label:    rgba(255, 255, 255, 0.78);
@rc-border:        rgba(255, 255, 255, 0.13);
@rc-border-hover:  rgba(255, 255, 255, 0.22);
@rc-surface:       rgba(255, 255, 255, 0.065);
@rc-surface-hover: rgba(255, 255, 255, 0.1);

.pd-vehicle-detail-fs.fs-layout-dark {

  /* ── 视频区 ── */
  .video-section {
    flex: 1; min-height: 0; min-width: 0; width: 100%;
    margin-top: 0 !important; padding-top: 0 !important;
    border: none !important;
    background-color: #0d0d0d !important;
    display: flex; flex-direction: column; overflow: hidden;
  }

  /* ── 布局通用：占满（含驾驶 d、左中右 e，否则全屏下列高被压成「紧高」） ── */
  .layout-mode-a,
  .layout-mode-b,
  .layout-mode-c,
  .layout-mode-d,
  .layout-mode-e {
    flex: 1;
    min-height: 0;
    min-width: 0;
    width: 100%;
    background-color: transparent !important;
  }

  /* ── 布局 B：前主 + 右侧三路 ── */
  .layout-mode-b {
    display: grid !important;
    grid-template-columns: 3fr 1fr;
    grid-template-rows: 1fr;
    gap: 8px;
  }

  .layout-mode-b .layout-b-row {
    display: contents !important;
  }

  .layout-mode-b .layout-b-row > .ant-col {
    min-width: 0;
    min-height: 0;
    max-width: none !important;
    flex: none !important;
    width: 100% !important;
    display: flex;
    flex-direction: column;
  }

  .layout-mode-b .layout-b-right-col {
    display: flex !important;
    flex-direction: column;
    min-height: 0;
    justify-content: stretch;
  }

  .layout-mode-b .layout-b-inner-row {
    flex: 1;
    min-height: 0;
    display: flex !important;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: stretch;
    gap: 8px;
  }

  .layout-mode-b .layout-b-inner-row > .ant-col {
    flex: 1;
    min-height: 0;
    margin-bottom: 0 !important;
    display: flex;
    flex-direction: column;
  }

  .layout-mode-b .video-box,
  .layout-mode-b .layout-b-inner-row .video-box {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .layout-mode-b .video-wrapper,
  .layout-mode-b .layout-b-inner-row .video-wrapper {
    flex: 1;
    min-height: 0;
    aspect-ratio: unset !important;
    position: relative;
  }

  .layout-mode-b .video-box-front {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .layout-mode-b .video-box-front .video-wrapper {
    flex: 1;
    min-height: 0;
    aspect-ratio: unset !important;
  }

  /* ── 控制条 ──（允许多行：远控视频/引导线/挂后等换行后仍可点击，勿固定 42px 裁切） */
  .remote-control-form {
    flex-shrink: 0;
    margin-bottom: 4px !important;
    padding: 8px 12px;
    min-height: 42px;
    height: auto;
    display: flex !important;
    flex-wrap: wrap;
    align-items: center;
    align-content: center;
    row-gap: 8px;
    column-gap: 12px;
    background: @rc-bg;
    border-radius: 8px;
    border: 1px solid @rc-border;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 2px 12px rgba(0, 0, 0, 0.50);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  /* ── 组 / 标签 / 分隔线 ── */
  .rc-group       { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .rc-group-fs    { margin-left: auto; }
  .rc-group-actions { gap: 6px; }
  .rc-group-mrc { gap: 6px; }

  .rc-mrc-radio.ant-radio-group {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid @rc-border;
    gap: 2px;
  }

  .rc-mrc-radio .ant-radio-button-wrapper {
    background: transparent !important;
    border: none !important;
    border-radius: 6px !important;
    color: @rc-text-dim !important;
    height: 26px !important;
    line-height: 26px !important;
    padding: 0 10px !important;
    font-size: 12px !important;
    font-weight: 500;
    transition: all 0.18s ease;
    &::before { display: none !important; }
  }

  .rc-mrc-radio .ant-radio-button-wrapper-checked {
    background: fade(@rc-accent, 18%) !important;
    color: #fff !important;
    box-shadow: 0 0 0 1px fade(@rc-accent, 38%) inset !important;
  }

  /* MRC1：警告色 */
  .rc-mrc-radio .ant-radio-button-wrapper[value="2"] {
    color: #ffa940 !important;
  }
  .rc-mrc-radio .ant-radio-button-wrapper[value="2"].ant-radio-button-wrapper-checked {
    background: rgba(250, 140, 22, 0.28) !important;
    color: #fff !important;
    box-shadow: 0 0 0 1px rgba(250, 140, 22, 0.48) inset !important;
  }

  /* MRC2：危险色 */
  .rc-mrc-radio .ant-radio-button-wrapper[value="3"] {
    color: #ff7875 !important;
  }
  .rc-mrc-radio .ant-radio-button-wrapper[value="3"].ant-radio-button-wrapper-checked {
    background: rgba(245, 34, 45, 0.32) !important;
    color: #fff !important;
    box-shadow: 0 0 0 1px rgba(245, 34, 45, 0.52) inset !important;
  }

  /* MRC 实时状态徽章（全屏暗黑主题） */
  .rc-mrc-badge {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .rc-mrc-badge.is-mrc0 {
    color: #fff;
    background: rgba(24, 144, 255, 0.78);
    border: 2px solid rgba(24, 144, 255, 0.95);
    box-shadow: 0 0 22px rgba(24, 144, 255, 0.55), inset 0 1px 0 rgba(255,255,255,0.2);
    font-size: 13px;
    font-weight: 700;
    padding: 3px 12px;
    animation: rc-mrc-pulse 2s ease-in-out infinite;
  }

  .rc-mrc-badge.is-mrc1 {
    color: #ffc069;
    background: rgba(250, 140, 22, 0.24);
    border: 1px solid rgba(250, 140, 22, 0.42);
    box-shadow: 0 0 14px rgba(250, 140, 22, 0.14);
  }

  .rc-mrc-badge.is-mrc2 {
    color: #ff9c9a;
    background: rgba(245, 34, 45, 0.28);
    border: 1px solid rgba(245, 34, 45, 0.5);
    box-shadow: 0 0 16px rgba(245, 34, 45, 0.18);
  }

  .rc-mrc-badge.is-normal {
    color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .rc-group-video { flex-wrap: wrap; row-gap: 4px; align-items: center; }
  .rc-group-preflight { align-items: flex-start; }
  .rc-preflight-name,
  .rc-preflight-drive-title {
    color: rgba(255, 255, 255, 0.78);
  }

  /* 与「布局」分段条同一视觉：单壳内 flex，内层 checkbox-group 不再套第二层框 */
  .rc-video-toggles {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 3px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid @rc-border;
    gap: 2px;
    max-width: 100%;
  }

  .rc-video-toggles .rc-checkbox-group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    gap: 2px;
  }

  .rc-video-toggles .rc-aux-guide-prefix {
    color: rgba(255, 255, 255, 0.65);
  }

  .rc-label {
    font-size: 13px;
    color: @rc-text-label;
    white-space: nowrap;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .rc-vehicle-name {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.96);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .rc-brand {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.12em;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0 4px 0 2px;
    user-select: none;
  }

  .rc-divider {
    display: inline-block;
    width: 1px; height: 24px;
    background: linear-gradient(180deg,
      transparent 0%, rgba(255,255,255,0.10) 25%,
      rgba(255,255,255,0.10) 75%, transparent 100%);
    flex-shrink: 0;
    margin: 0 2px;
  }

  /* ── Select ── */
  .rc-select { width: 140px !important; } // 200px * 0.7
  .ant-select { color: @rc-text; }

  .ant-select-selector {
    background: @rc-surface !important;
    border: 1px solid @rc-border !important;
    border-radius: 8px !important;
    color: @rc-text !important;
    height: 32px !important;
    box-shadow: none !important;
    transition: border-color 0.2s, background 0.2s;
  }

  .ant-select:hover .ant-select-selector,
  .ant-select-focused .ant-select-selector {
    background: @rc-surface-hover !important;
    border-color: fade(@rc-accent, 45%) !important;
  }

  .ant-select-arrow           { color: @rc-text-dim; }
  .ant-select-selection-search-input { color: #fff !important; }
  .ant-select-selection-item  { color: #fff !important; line-height: 30px !important; font-size: 13px !important; }
  .ant-select-selection-placeholder { color: @rc-text-dim !important; }
  .ant-select-clear            { color: @rc-text-dim; background: transparent; }

  /* ── Checkbox → pill 分段（与布局 radio 一致）；视频区内层由 .rc-video-toggles .rc-checkbox-group 去掉第二层框 ── */
  .rc-checkbox-group {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid @rc-border;
    gap: 2px;
  }

  .ant-checkbox-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent !important;
    border: none !important;
    border-radius: 6px !important;
    color: @rc-text-dim !important;
    height: 26px !important;
    line-height: 26px !important;
    padding: 0 12px !important;
    font-size: 13px !important;
    font-weight: 500;
    margin-inline-start: 0 !important;
    user-select: none;
    cursor: pointer;
    transition: all 0.18s ease;
    &::after { display: none !important; }
    &:hover { color: @rc-text !important; background: @rc-surface-hover !important; }
  }

  .ant-checkbox-wrapper-checked {
    background: fade(@rc-accent, 18%) !important;
    color: #fff !important;
    box-shadow: 0 0 0 1px fade(@rc-accent, 38%) inset !important;
    &:hover { background: fade(@rc-accent, 26%) !important; }
  }

  .ant-checkbox {
    display: none !important;
  }

  /* ── Radio 分段（布局） ── */
  .rc-layout-radio.ant-radio-group {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid @rc-border;
    gap: 2px;
  }

  .ant-radio-button-wrapper {
    background: transparent !important;
    border: none !important;
    border-radius: 6px !important;
    color: @rc-text-dim !important;
    height: 26px !important;
    line-height: 26px !important;
    padding: 0 12px !important;
    font-size: 13px !important;
    font-weight: 500;
    transition: all 0.18s ease;
    &::before { display: none !important; }
    &:hover:not(.ant-radio-button-wrapper-checked) {
      color: @rc-text !important;
      background: @rc-surface-hover !important;
    }
  }

  .ant-radio-button-wrapper-checked {
    background: fade(@rc-accent, 18%) !important;
    color: #fff !important;
    box-shadow: 0 0 0 1px fade(@rc-accent, 38%) inset !important;
    &:hover { background: fade(@rc-accent, 26%) !important; }
  }

  .ant-radio-button-inner { display: none !important; }

  /* ── 驾驶模式（远控预置 M/A/R）：圆点 Radio，与 windowed remote-focus scoped 块同语义 ── */
  .rc-preflight-drive-radio.ant-radio-group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 4px 8px;
    gap: 4px 12px;
    background: rgba(0, 0, 0, 0.38);
    border-radius: 8px;
    border: 1px solid @rc-border;
  }

  .rc-preflight-drive-radio .ant-radio-wrapper {
    color: @rc-text-dim !important;
    white-space: nowrap;
    margin-inline-end: 0 !important;
    align-items: center;
  }

  .rc-preflight-drive-radio .ant-radio-wrapper:hover {
    color: @rc-text !important;
  }

  .rc-preflight-drive-radio .ant-radio .ant-radio-inner {
    border-color: rgba(255, 255, 255, 0.22);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .rc-preflight-drive-radio .ant-radio:hover .ant-radio-inner {
    border-color: rgba(255, 255, 255, 0.38);
    background-color: rgba(255, 255, 255, 0.07);
  }

  .rc-preflight-drive-radio .ant-radio-checked .ant-radio-inner {
    border-color: #5e9eff;
    background-color: #4a7ae8;
    box-shadow: 0 0 0 1px rgba(94, 158, 255, 0.35);
  }

  .rc-preflight-drive-radio .ant-radio-checked .ant-radio-inner::after {
    background-color: #fff;
  }

  .rc-preflight-drive-radio .ant-radio-disabled .ant-radio-inner {
    border-color: rgba(255, 255, 255, 0.12) !important;
    background-color: rgba(255, 255, 255, 0.03) !important;
  }

  .rc-preflight-drive-radio .ant-radio-disabled.ant-radio-checked .ant-radio-inner {
    border-color: rgba(94, 158, 255, 0.45) !important;
    background-color: rgba(74, 122, 232, 0.35) !important;
  }

  .rc-preflight-drive-radio .ant-radio-wrapper-disabled {
    color: rgba(255, 255, 255, 0.7) !important;
  }

  .rc-preflight-drive-radio .ant-radio-disabled + span {
    color: rgba(255, 255, 255, 0.7) !important;
    cursor: not-allowed;
  }

  /* ── 按钮 ── */
  .rc-btn {
    border-radius: 8px !important;
    font-weight: 500;
    font-size: 14px !important;
    height: 32px !important;
    padding: 0 16px !important;
    transition: all 0.18s ease;
    border: 1px solid transparent !important;
  }

  .ant-btn-primary:not([disabled]) {
    background: @rc-accent !important;
    border-color: fade(@rc-accent-hover, 35%) !important;
    color: #fff !important;
    box-shadow: 0 1px 8px @rc-accent-glow !important;
    &:hover {
      background: @rc-accent-hover !important;
      box-shadow: 0 2px 14px fade(@rc-accent, 32%) !important;
    }
  }

  .ant-btn-primary:disabled,
  .ant-btn-primary[disabled] {
    color: rgba(255,255,255,0.35) !important;
    background: fade(@rc-accent, 16%) !important;
    border-color: fade(@rc-accent, 20%) !important;
    box-shadow: none !important;
  }

  .ant-btn-dangerous:not([disabled]) {
    background: @rc-danger-bg !important;
    border-color: fade(@rc-danger, 32%) !important;
    color: #ffa39e !important;
    &:hover {
      background: fade(@rc-danger, 20%) !important;
      border-color: fade(@rc-danger, 48%) !important;
      color: #fff !important;
    }
  }

  .rc-btn-fs.ant-btn {
    background: @rc-surface !important;
    border-color: @rc-border !important;
    color: @rc-text-dim !important;
    height: 28px !important; padding: 0 10px !important;
    font-size: 12px !important;
    &:hover {
      background: @rc-surface-hover !important;
      border-color: @rc-border-hover !important;
      color: @rc-text !important;
    }
  }

  .rc-btn-start.ant-btn,
  .rc-btn-stop.ant-btn {
    height: 28px !important;
    padding: 0 12px !important;
    font-size: 13px !important;
  }

  .ant-btn[disabled]:not(.ant-btn-primary):not(.ant-btn-dangerous) {
    color: rgba(255,255,255,0.25) !important;
    background: @rc-surface !important;
    border-color: @rc-border !important;
    box-shadow: none !important;
  }

  /* ── 下拉面板 ── */
  .ant-select-dropdown {
    background: #181b22 !important;
    border: 1px solid @rc-border;
    border-radius: 10px !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    padding: 4px !important;
  }

  .rc-virtual-list-holder-inner .ant-select-item,
  .ant-select-item {
    color: @rc-text !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    margin: 1px 0;
  }

  .ant-select-item-option-active  { background: @rc-surface-hover !important; }
  .ant-select-item-option-selected { background: fade(@rc-accent, 16%) !important; font-weight: 500; }
  .ant-empty-description { color: @rc-text-dim; }
}

/* 独立远控路由 windowed：甲板外沿高光；与「普通详情页点全屏」区分开（无 .pd-remote-focus-deck） */
.pd-vehicle-detail-fs.fs-layout-dark.pd-remote-focus-deck:not(:fullscreen) {
  border-radius: 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 0 0 1px rgba(255, 255, 255, 0.06);
}

/* 远控工作台：远控预置（手刹/喇叭/灯光）与驾驶模式（M/A/C）同一行，极窄时自动换行 */
.pd-remote-focus-deck .rc-preflight-inner {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.pd-remote-focus-deck .rc-group.rc-group-preflight {
  align-items: center;
}

/* ── MRC 确认弹框：暗黑驾驶仓主题（Modal.confirm 专用选择器）── */
.pd-mrc-confirm-dark {
  .ant-modal-content {
    background: #141820 !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  }
  .ant-modal-confirm-body .ant-modal-confirm-title {
    color: rgba(255, 255, 255, 0.95) !important;
    font-weight: 600;
  }
  .ant-modal-confirm-body .ant-modal-confirm-content {
    color: rgba(255, 255, 255, 0.75) !important;
    margin-top: 8px;
  }
  .ant-modal-confirm-body .anticon {
    color: #fa8c16;
  }
  .ant-modal-confirm-btns {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .ant-btn {
    border-radius: 8px;
    height: 34px;
    padding: 0 18px;
    font-weight: 500;
    transition: all 0.18s ease;
  }
  .ant-btn-default {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.78);
    &:hover {
      background: rgba(255, 255, 255, 0.14);
      border-color: rgba(255, 255, 255, 0.24);
      color: #fff;
    }
  }
  .ant-btn-primary {
    background: #5b8cff;
    border-color: #5b8cff;
    box-shadow: 0 2px 8px rgba(91, 140, 255, 0.3);
    &:hover {
      background: #7aa3ff;
      border-color: #7aa3ff;
    }
  }
  .ant-btn-dangerous {
    background: rgba(245, 86, 74, 0.18);
    border-color: rgba(245, 86, 74, 0.4);
    color: #ffa39e;
    &:hover {
      background: rgba(245, 86, 74, 0.28);
      border-color: rgba(245, 86, 74, 0.55);
      color: #fff;
    }
  }
}

/* cam_f_7 PiP：非 scoped 全局覆盖，穿透 WebRtcPlayer 内联 style */
.layout-e-layer-f7 video {
  object-fit: cover !important;
  transform-origin: bottom left;
  transform: scale(1.5) translateY(2px) !important;
}
/* PiP 太小，码率 badge 不好定位，隐藏 */
.layout-e-layer-f7 .webrtc-top-bar {
  display: none !important;
}
</style>
