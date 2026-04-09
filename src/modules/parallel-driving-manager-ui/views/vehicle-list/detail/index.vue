<template>
  <j-page-container :showBack="true" @back="handleBack">
    <template #title>
      <span>{{ vehicle?.deviceName || vehicle?.deviceId || $t('parallel-driving.vehicle-detail.title') }}</span>
      <a-tag v-if="vehicle" :color="getStateColor(vehicle.state?.value)" style="margin-left: 12px">
        {{ vehicle.state?.text || vehicle.state?.value || '-' }}
      </a-tag>
    </template>

    <a-spin :spinning="loading">
      <div v-if="vehicle" class="vehicle-detail">
        <!-- 基本信息 -->
        <a-card :title="$t('parallel-driving.vehicle-detail.basic-info')" :bordered="false" style="margin-bottom: 16px">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.device-id')">
              {{ vehicle.deviceId }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('parallel-driving.vehicle-list.device-name')">
              {{ vehicle.deviceName || '-' }}
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
          :title="$t('parallel-driving.vehicle-detail.remote-control')"
          :bordered="false"
          style="margin-bottom: 16px"
          :class="{ 'remote-control-card-fs': isFullscreen }"
        >
          <!-- 全屏仅包含 card-body 内容：表单 + 视频 -->
          <div
            ref="fullscreenRef"
            class="pd-vehicle-detail-fs fullscreen-target card-body-fullscreen-wrapper"
            :class="{ 'fs-layout-dark': isFullscreen }"
          >
          <div class="remote-control-form" style="margin-bottom: 16px">
            <span v-if="isFullscreen" class="rc-brand">ZERON</span>
            <span v-if="isFullscreen" class="rc-divider" />
            <!-- 组 1：驾驶舱 -->
            <div class="rc-group rc-group-cockpit">
              <span class="rc-label">{{ $t('parallel-driving.vehicle-detail.select-cockpit') }}</span>
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
              <a-checkbox-group v-model:value="selectedVideoDirections" class="rc-checkbox-group">
                <a-checkbox value="front">{{ $t('parallel-driving.vehicle-detail.video-front') }}</a-checkbox>
                <a-checkbox value="back">{{ $t('parallel-driving.vehicle-detail.video-back') }}</a-checkbox>
                <a-checkbox value="left">{{ $t('parallel-driving.vehicle-detail.video-left') }}</a-checkbox>
                <a-checkbox value="right">{{ $t('parallel-driving.vehicle-detail.video-right') }}</a-checkbox>
              </a-checkbox-group>
            </div>

            <span class="rc-divider" />

            <!-- 组 3：布局 -->
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

            <!-- 组 4：操作按钮 -->
            <div class="rc-group rc-group-actions">
              <a-button
                type="primary"
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
            <div v-if="isControlling || isVehicleOnline" class="rc-group rc-group-fs">
              <a-button size="small" class="rc-btn rc-btn-fs" @click="toggleFullscreen">
                <template #icon>
                  <AIcon :type="isFullscreen ? 'FullscreenExitOutlined' : 'FullscreenOutlined'" />
                </template>
                {{ isFullscreen ? $t('parallel-driving.vehicle-detail.exit-fullscreen') : $t('parallel-driving.vehicle-detail.fullscreen') }}
              </a-button>
            </div>
          </div>

          <!-- 视频区域：接管中或车辆在线均显示 -->
          <div v-if="isControlling || isVehicleOnline" ref="videoSectionRef" class="video-section" :class="`layout-mode-${layoutMode}`">
            <!-- 驾驶视图：前视自适应宽度 + 右侧三路，动态计算最优比例 -->
            <template v-if="layoutMode === 'd'">
              <div class="layout-d">
                <div class="layout-d-main" :style="{ flex: drivingFrontFlex }">
                  <div class="video-with-hud">
                    <div class="hud-turn-overlay">
                      <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                        <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                        <span class="hud-ts-label">LEFT</span>
                      </div>
                      <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                        <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                        <span class="hud-ts-label">RIGHT</span>
                      </div>
                    </div>
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-front')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('front')"
                      :url="getVideoUrl('front')"
                    />
                    <div class="status-hud status-hud-xiaomi">
                      <div class="hud-left">
                        <div class="hud-gear-row">
                          <div class="hud-drivemode-pair" title="驾驶模式：M=Manual(0)，A=Auto(1)">
                            <span class="hud-dm-circle" :class="hudDriveModeClass(vehicleStatus.drivemode)">{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                          </div>
                          <div class="hud-gear-sep" aria-hidden="true"></div>
                          <span v-for="(ch, idx) in HUD_GEAR_LETTERS" :key="ch" class="hud-gear-char" :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }">{{ ch }}</span>
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
                        <div class="hud-stat">
                          <span class="hud-stat-label">转向</span>
                          <span class="hud-stat-value">{{ formatNumber(vehicleStatus.steering, 0, '--') }}</span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat">
                          <span class="hud-stat-label">油门</span>
                          <span class="hud-stat-value">{{ formatPercentInt(vehicleStatus.accelerator) }}</span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat">
                          <span class="hud-stat-label">制动</span>
                          <span class="hud-stat-value hud-stat-brake" :class="{ 'is-active': Number(vehicleStatus.brake) > 0 }">{{ formatPercentInt(vehicleStatus.brake) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="layout-d-side" :style="{ flex: drivingSideFlex }">
                  <div class="layout-d-cell">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                    />
                  </div>
                  <div class="layout-d-cell">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-left')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                    />
                  </div>
                  <div class="layout-d-cell">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
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
                      <!-- 转向灯：上半部左右对称 -->
                      <div class="hud-turn-overlay">
                        <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                          <span class="hud-ts-label">LEFT</span>
                        </div>
                        <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                          <span class="hud-ts-label">RIGHT</span>
                        </div>
                      </div>
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-front')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('front')"
                      :url="getVideoUrl('front')"
                    />
                      <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=Manual(0)，A=Auto(1)"
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
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <div class="hud-stat">
                            <span class="hud-stat-label">转向</span>
                            <span class="hud-stat-value">{{ formatNumber(vehicleStatus.steering, 0, '--') }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">油门</span>
                            <span class="hud-stat-value">{{ formatPercentInt(vehicleStatus.accelerator) }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">制动</span>
                            <span class="hud-stat-value hud-stat-brake" :class="{ 'is-active': Number(vehicleStatus.brake) > 0 }">{{ formatPercentInt(vehicleStatus.brake) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="layout-a-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                    />
                  </div>
                </div>
                <div class="layout-a-row2">
                  <div class="layout-a-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-left')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                    />
                  </div>
                  <div class="layout-a-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
                    />
                  </div>
                </div>
              </div>
            </template>
            <!-- 方案 B：前主左，右侧后左右三路等高 -->
            <template v-else-if="layoutMode === 'b'">
              <a-row :gutter="2" class="video-grid layout-b-row">
                <a-col :span="18">
                  <div class="video-box video-box-front">
                    <div class="video-wrapper">
                      <!-- 转向灯：上半部左右对称 -->
                      <div class="hud-turn-overlay">
                        <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                          <span class="hud-ts-label">LEFT</span>
                        </div>
                        <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                          <span class="hud-ts-label">RIGHT</span>
                        </div>
                      </div>
                      <WebRtcPlayer
                        v-if="VIDEO_CONFIG.protocol === 'webrtc' && getVideoStream('front')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="VIDEO_CONFIG.app"
                        :stream="getVideoStream('front')!"
                      />
                      <Player
                        v-else-if="getVideoUrl('front')"
                        :url="getVideoUrl('front')"
                        :protocol="VIDEO_CONFIG.protocol"
                        :live="true"
                        autoplay
                      />
                      <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
                      <span class="video-badge">{{ $t('parallel-driving.vehicle-detail.video-front') }}</span>
                      <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=Manual(0)，A=Auto(1)"
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
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <div class="hud-stat">
                            <span class="hud-stat-label">转向</span>
                            <span class="hud-stat-value">{{ formatNumber(vehicleStatus.steering, 0, '--') }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">油门</span>
                            <span class="hud-stat-value">{{ formatPercentInt(vehicleStatus.accelerator) }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">制动</span>
                            <span class="hud-stat-value hud-stat-brake" :class="{ 'is-active': Number(vehicleStatus.brake) > 0 }">{{ formatPercentInt(vehicleStatus.brake) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </a-col>
                <a-col :span="6" class="layout-b-right-col">
                  <a-row :gutter="2" class="video-grid layout-b-inner-row">
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-back')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="VIDEO_CONFIG.app"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('back')"
                        :url="getVideoUrl('back')"
                      />
                    </a-col>
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-left')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="VIDEO_CONFIG.app"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('left')"
                        :url="getVideoUrl('left')"
                      />
                    </a-col>
                    <a-col :span="24">
                      <VideoCell
                        :label="$t('parallel-driving.vehicle-detail.video-right')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="VIDEO_CONFIG.app"
                        :protocol="VIDEO_CONFIG.protocol"
                        :stream="getVideoStream('right')"
                        :url="getVideoUrl('right')"
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
                    <div class="layout-c-video-wrap">
                      <!-- 转向灯：上半部左右对称 -->
                      <div class="hud-turn-overlay">
                        <div class="hud-ts-wrap hud-ts-wrap-left" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                          <span class="hud-ts-label">LEFT</span>
                        </div>
                        <div class="hud-ts-wrap hud-ts-wrap-right" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                          <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                          <span class="hud-ts-label">RIGHT</span>
                        </div>
                      </div>
                      <WebRtcPlayer
                        v-if="VIDEO_CONFIG.protocol === 'webrtc' && getVideoStream('front')"
                        :base-url="VIDEO_CONFIG.baseUrl"
                        :app="VIDEO_CONFIG.app"
                        :stream="getVideoStream('front')!"
                      />
                      <Player
                        v-else-if="getVideoUrl('front')"
                        :url="getVideoUrl('front')"
                        :protocol="VIDEO_CONFIG.protocol"
                        :live="true"
                        autoplay
                      />
                      <div v-else class="video-placeholder">{{ $t('parallel-driving.vehicle-detail.video-loading') }}</div>
                      <span class="video-badge">{{ $t('parallel-driving.vehicle-detail.video-front') }}</span>
                      <div class="status-hud status-hud-xiaomi">
                        <div class="hud-left">
                          <div class="hud-gear-row">
                            <div
                              class="hud-drivemode-pair"
                              title="驾驶模式：M=Manual(0)，A=Auto(1)"
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
                        <div class="hud-center">
                          <div class="hud-speed-block">
                            <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                            <span class="hud-speed-unit">km/h</span>
                          </div>
                          <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                        </div>
                        <div class="hud-right">
                          <div class="hud-stat">
                            <span class="hud-stat-label">转向</span>
                            <span class="hud-stat-value">{{ formatNumber(vehicleStatus.steering, 0, '--') }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">油门</span>
                            <span class="hud-stat-value">{{ formatPercentInt(vehicleStatus.accelerator) }}</span>
                          </div>
                          <span class="hud-stat-sep" />
                          <div class="hud-stat">
                            <span class="hud-stat-label">制动</span>
                            <span class="hud-stat-value hud-stat-brake" :class="{ 'is-active': Number(vehicleStatus.brake) > 0 }">{{ formatPercentInt(vehicleStatus.brake) }}</span>
                          </div>
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
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('left')"
                      :url="getVideoUrl('left')"
                    />
                  </div>
                  <div class="layout-c-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                    />
                  </div>
                  <div class="layout-c-col">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-right')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('right')"
                      :url="getVideoUrl('right')"
                    />
                  </div>
                </div>
              </div>
            </template>
            <!-- 方案 E：左中右 + PiP，倒车 CSS 交换位置（不重载视频） -->
            <template v-else-if="layoutMode === 'e'">
              <div class="layout-e">
                <!-- 左列 -->
                <div class="layout-e-left" :style="{ flex: layoutESideFlex }">
                  <VideoCell
                    :label="$t('parallel-driving.vehicle-detail.video-left')"
                    :base-url="VIDEO_CONFIG.baseUrl"
                    :app="VIDEO_CONFIG.app"
                    :protocol="VIDEO_CONFIG.protocol"
                    :stream="getVideoStream('left')"
                    :url="getVideoUrl('left')"
                  />
                </div>
                <!-- 中列：front + back 各渲染一次，CSS 交换大小位置 -->
                <div class="layout-e-center" :style="{ flex: layoutECenterFlex }" :class="{ 'is-reverse': isReverse }">
                  <!-- 前视频层 — 正常=主画面, 倒车=PiP -->
                  <div class="layout-e-layer layout-e-layer-front">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-front')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('front')"
                      :url="getVideoUrl('front')"
                    />
                  </div>
                  <!-- 后视频层 — 正常=PiP, 倒车=主画面 -->
                  <div class="layout-e-layer layout-e-layer-back">
                    <VideoCell
                      :label="$t('parallel-driving.vehicle-detail.video-back')"
                      :base-url="VIDEO_CONFIG.baseUrl"
                      :app="VIDEO_CONFIG.app"
                      :protocol="VIDEO_CONFIG.protocol"
                      :stream="getVideoStream('back')"
                      :url="getVideoUrl('back')"
                    />
                  </div>
                  <!-- PiP 档位角标：覆盖在 PiP 小窗右下 -->
                  <span class="layout-e-pip-badge" :class="{ 'is-reverse': isReverse }">
                    {{ isReverse ? 'R' : 'D' }}
                  </span>
                  <!-- HUD 叠加层：转向灯集成到底栏，速度两侧 -->
                  <div class="layout-e-hud-overlay">
                    <div class="status-hud status-hud-xiaomi layout-e-hud">
                      <div class="hud-left">
                        <div class="hud-gear-row">
                          <div class="hud-drivemode-pair" title="驾驶模式：M=Manual(0)，A=Auto(1)">
                            <span class="hud-dm-circle" :class="hudDriveModeClass(vehicleStatus.drivemode)">{{ hudDriveModeChar(vehicleStatus.drivemode) }}</span>
                          </div>
                          <div class="hud-gear-sep" aria-hidden="true"></div>
                          <span v-for="(ch, idx) in HUD_GEAR_LETTERS" :key="ch" class="hud-gear-char" :class="{ active: isHudGearActive(idx, vehicleStatus.gear) }">{{ ch }}</span>
                        </div>
                      </div>
                      <div class="hud-ts-inline" :class="{ 'is-on': isLeftTurnOn, 'is-hazard': isHazardOn }">
                        <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M20 2L2 16l18 14v-9h26v-10H20V2z"/></svg>
                      </div>
                      <div class="hud-center">
                        <div class="hud-speed-block">
                          <span class="hud-speed-num">{{ formatNumber(vehicleStatus.speed, 0, '--') }}</span>
                          <span class="hud-speed-unit">km/h</span>
                        </div>
                        <div class="hud-bar"><div class="hud-bar-fill" :style="{ width: speedBarPercent }"></div></div>
                      </div>
                      <div class="hud-ts-inline" :class="{ 'is-on': isRightTurnOn, 'is-hazard': isHazardOn }">
                        <svg class="hud-ts-arrow" viewBox="0 0 48 32"><path d="M28 2l18 14-18 14v-9H2v-10h26V2z"/></svg>
                      </div>
                      <div class="hud-right">
                        <div class="hud-stat">
                          <span class="hud-stat-label">转向</span>
                          <span class="hud-stat-value">{{ formatNumber(vehicleStatus.steering, 0, '--') }}</span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat">
                          <span class="hud-stat-label">油门</span>
                          <span class="hud-stat-value">{{ formatPercentInt(vehicleStatus.accelerator) }}</span>
                        </div>
                        <span class="hud-stat-sep" />
                        <div class="hud-stat">
                          <span class="hud-stat-label">制动</span>
                          <span class="hud-stat-value hud-stat-brake" :class="{ 'is-active': Number(vehicleStatus.brake) > 0 }">{{ formatPercentInt(vehicleStatus.brake) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 右列 -->
                <div class="layout-e-right" :style="{ flex: layoutESideFlex }">
                  <VideoCell
                    :label="$t('parallel-driving.vehicle-detail.video-right')"
                    :base-url="VIDEO_CONFIG.baseUrl"
                    :app="VIDEO_CONFIG.app"
                    :protocol="VIDEO_CONFIG.protocol"
                    :stream="getVideoStream('right')"
                    :url="getVideoUrl('right')"
                  />
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
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@/utils/comm'
import {
  getCockpitDevices,
  queryVehicles,
  takeover,
  release,
  emergencyStop,
} from '../../../api/parallel-driving'
import { initParallelDrivingWebSocket, closeParallelDrivingWebSocket } from '../../../utils/websocket'
import WebRtcPlayer from '../../../components/WebRtcPlayer.vue'
import VideoCell from '../../../components/VideoCell.vue'

const { t: $t } = useI18n()
const route = useRoute()
const router = useRouter()

const vehicleId = computed(() => route.params.id as string)
const loading = ref(true)
const vehicle = ref<any>(null)
const selectedCockpitId = ref('')
const cockpitLoading = ref(false)
const cockpitDevices = ref<Array<{ label: string; value: string }>>([])
const selectedVideoDirections = ref<string[]>(['front', 'back', 'left', 'right'])
const LAYOUT_STORAGE_KEY = 'parallel-driving-layout-mode'
const layoutMode = ref<'a' | 'b' | 'c' | 'd' | 'e'>(
  (() => {
    const v = localStorage.getItem(LAYOUT_STORAGE_KEY) as string
    if (v === 'b') return 'd'
    return (v === 'a' || v === 'c' || v === 'd' || v === 'e') ? v : 'd'
  })()
)
watch(layoutMode, (v) => localStorage.setItem(LAYOUT_STORAGE_KEY, v))

const takingOver = ref(false)
const releasing = ref(false)
const isControlling = ref(false)
const vehicleStatus = ref<Record<string, any>>({})
const emergencyStopping = ref(false)
const isFullscreen = ref(false)
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
  if (isFullscreen.value && fullscreenRef.value) {
    return fullscreenRef.value
  }
  return triggerNode.parentElement || document.body
}
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL = 5000 // 5秒轮询一次，更新在线状态和远控状态

// 视频流配置（可后续改为从配置或设备元数据读取）
const VIDEO_CONFIG = {
  baseUrl: 'http://118.145.132.112',
  app: 'dp010',
  protocol: 'webrtc' as 'webrtc' | 'm3u8' | 'flv',
  streams: {
    front: 'cam_f_7',
    left: 'cam_l_11',
    right: 'cam_r_13',
    back: 'cam_b_18',
  },
}

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
  const selected = selectedVideoDirections.value.length ? selectedVideoDirections.value : ['front', 'back', 'left', 'right']
  if (!selected.includes(key)) return null
  return (VIDEO_CONFIG.streams as Record<string, string>)[key] || null
}

const getVideoUrl = (key: string) => {
  const stream = getVideoStream(key)
  if (!stream) return ''
  const { baseUrl, app, protocol } = VIDEO_CONFIG
  if (protocol === 'm3u8') return `${baseUrl}/${app}/${stream}/hls.m3u8`
  if (protocol === 'flv') return `${baseUrl}/${app}/${stream}.live.flv`
  return '' // webrtc 用 WebRtcPlayer，不走 url
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

/** 驾驶模式 HUD：仅显示 M 或 A 其一（0=Manual→M，1=Auto→A） */
const hudDriveModeChar = (dm: any) => {
  const n = Number(dm)
  if (n === 0) return 'M'
  if (n === 1) return 'A'
  return '–'
}

const hudDriveModeClass = (dm: any) => {
  const n = Number(dm)
  if (n === 0) return 'is-manual'
  if (n === 1) return 'is-auto'
  return 'is-unknown'
}

/** 倒车检测：gear=1 为 R 档，用于 layout-e 的 CSS 层交换 */
const isReverse = computed(() => Number(vehicleStatus.value?.gear) === 1)

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

const HUD_SPEED_MAX = 120
const speedBarPercent = computed(() => {
  const s = vehicleStatus.value?.speed
  if (s == null || !Number.isFinite(Number(s))) return '0%'
  const pct = Math.min(100, (Number(s) / HUD_SPEED_MAX) * 100)
  return `${Math.round(pct)}%`
})

const isLeftTurnOn = computed(() => Number(vehicleStatus.value?.leftTurnSignal) === 1)
const isRightTurnOn = computed(() => Number(vehicleStatus.value?.rightTurnSignal) === 1)
const isHazardOn = computed(() => isLeftTurnOn.value && isRightTurnOn.value)

/** 踏板等：0~1 或 0~100 → 整数字符串，无数据为 -- */
const formatPercentInt = (val: any) => {
  if (val == null) return '--'
  const n = Number(val)
  if (!Number.isFinite(n)) return '--'
  const pct = n > 1.001 ? n : n * 100
  return String(Math.round(Math.max(0, Math.min(100, pct))))
}

const getDictValue = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.value || val.getValue?.() || ''
}

const normalizeState = (val: any) => getDictValue(val).toString().toLowerCase()
const isActiveState = (val: any) => normalizeState(val) === 'active'
const isVehicleOnline = computed(() => vehicle.value?.state?.value === 'online')

const canCloudRelease = computed(() => {
  const v = vehicle.value
  if (!v) return false
  return isControlling.value || (isActiveState(v.sessionState) && !!v.boundCockpitId)
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
const normalizePedal = (val: any): number | undefined => {
  if (val == null) return undefined
  const n = Number(val)
  if (!Number.isFinite(n)) return undefined
  // 兼容 0~100 或 0~1
  if (n > 1.001) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

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

const applyChassisStatusToVehicleStatus = (properties: Record<string, any>) => {
  // properties 可能包含：
  // - chassis_status: { vcu_xxx: ... }
  // - 或直接平铺 vcu_xxx 字段
  const chassis = (properties as any).chassis_status
  const raw = chassis && typeof chassis === 'object' ? chassis : properties

  const speed = raw.vcu_vcu_vehicle_spd
  const gear = raw.vcu_veh_curr_gear ?? raw.vcu_curr_gear_ctrl_mod
  const steering = raw.vcu_steer_angle
  const acc = raw.vcu_vcu_manual_acc_pedal_pos
  const brk = raw.vcu_vcu_manual_brk_pedal_pos
  const drivemodeRaw = raw.vcu_vcu_pt_ctrl_auto_sts

  const patch: Record<string, any> = {}
  const speedNum = Number(speed)
  if (Number.isFinite(speedNum)) patch.speed = speedNum * VEHICLE_SPEED_SCALE // 1 = 直接显示原始值
  const gearNum = mapGear(gear)
  if (gearNum != null) patch.gear = gearNum
  const steerNum = Number(steering)
  if (Number.isFinite(steerNum)) patch.steering = steerNum
  const accNorm = normalizePedal(acc)
  if (accNorm != null) patch.accelerator = accNorm
  const brkNorm = normalizePedal(brk)
  if (brkNorm != null) patch.brake = brkNorm
  // 驾驶模式：0=Manual, 1=Auto（仅车端有上报时更新，避免缺字段误显示为 0）
  if (drivemodeRaw != null && drivemodeRaw !== '') {
    const dm = Number(drivemodeRaw)
    if (Number.isFinite(dm)) patch.drivemode = dm
  }

  // 转向灯：cgw_left_turn_light_sts / cgw_right_turn_light_sts (0=off, 1=on)
  const leftTurn = raw.cgw_left_turn_light_sts
  const rightTurn = raw.cgw_right_turn_light_sts
  if (leftTurn != null) patch.leftTurnSignal = Number(leftTurn)
  if (rightTurn != null) patch.rightTurnSignal = Number(rightTurn)

  return patch
}

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
        isControlling.value = false
        closeWebSocket()
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
    const result = await getCockpitDevices({
      terms: keyword
        ? [{ column: 'name', termType: 'like', value: `*${keyword}*` }]
        : [],
    })
    const data = result?.result || []
    cockpitDevices.value = (Array.isArray(data) ? data : []).map((item: any) => {
      const name = (item.name || '').trim()
      const id = (item.id || '').trim()
      const label = name ? `${name}(${id})` : id
      return { label, value: id }
    })
  } catch (e) {
    console.error('加载驾驶舱失败:', e)
  } finally {
    cockpitLoading.value = false
  }
}

const handleCockpitSearch = (value: string) => {
  loadCockpitDevices(value)
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
    if (result.success) {
      onlyMessage($t('parallel-driving.vehicle-list.takeover-success'))
      isControlling.value = true
      await loadVehicle(true)
      initWebSocket()
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
const initWebSocket = () => {
  const deviceId = vehicle.value?.deviceId
  if (!deviceId) { closeWebSocket(); return }
  const cockpitId = isControlling.value ? selectedCockpitId.value : undefined
  if (isControlling.value && !selectedCockpitId.value) { closeWebSocket(); return }
  closeParallelDrivingWebSocket()
  initParallelDrivingWebSocket(
    deviceId,
    cockpitId,
    (data) => {
      if (data.type === 'vehicle-status' && data.properties) {
        const mapped = applyChassisStatusToVehicleStatus(data.properties)
        vehicleStatus.value = {
          ...vehicleStatus.value,
          ...mapped,
          timestamp: data.timestamp,
        }
      }
    },
    () => {},
    () => {},
    () => {}
  )
}

const closeWebSocket = () => {
  closeParallelDrivingWebSocket()
  vehicleStatus.value = {}
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

watch(vehicleId, (id) => {
  loadVehicle()
  if (id) startPolling()
  else stopPolling()
}, { immediate: true })

watch(
  () => [vehicle.value?.deviceId, isControlling.value, selectedCockpitId.value, vehicle.value?.state?.value],
  () => {
    if (!vehicle.value?.deviceId) { closeWebSocket(); return }
    // 接管模式：需要 cockpitId 且匹配
    if (isControlling.value && selectedCockpitId.value && vehicle.value.boundCockpitId === selectedCockpitId.value) {
      initWebSocket()
    // 监控模式：车辆在线即可（仅 vehicleId，无需 cockpitId）
    } else if (vehicle.value.state?.value === 'online') {
      initWebSocket()
    } else {
      closeWebSocket()
    }
  },
  { immediate: true }
)

onMounted(() => {
  loadCockpitDevices()
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  try {
    const saved = localStorage.getItem('parallelDriving.cockpitDeviceId')
    if (saved) selectedCockpitId.value = saved
  } catch (e) {
    // ignore
  }
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  if (document.fullscreenElement) document.exitFullscreen?.()
  stopPolling()
  closeWebSocket()
  sectionRO?.disconnect()
})
</script>

<style scoped lang="less">
.vehicle-detail {
  padding: 0;
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
  width: 220px;
}

.rc-group-actions {
  gap: 6px;
}

.rc-group-fs {
  margin-left: auto;
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

/* hud-metrics / hud-chassis-plain 已替换为 hud-stat 结构 */

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
  z-index: 3;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 32px;
  pointer-events: none;
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

.status-hud-xiaomi .hud-stat-brake.is-active {
  color: #ff6b6b;
  text-shadow: 0 0 12px rgba(255, 107, 107, 0.45);
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
 *  三栏底部对齐，960:768 等比，中间自然更高。
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
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 0;
  height: 100%;
  gap: 2px;
  background: #0a0a0a;
  padding: 2px;
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

/* ── 正常状态 (D/N/P)：前=主画面, 后=PiP ── */
.layout-e-layer-front {
  position: absolute;
  inset: 0;
  z-index: 1;
}
.layout-e-layer-back {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20%;
  aspect-ratio: 960 / 768;
  z-index: 3;
  border-radius: 4px;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  background: #000;
}
.layout-e-layer-back :deep(.video-badge) {
  font-size: 10px;
  padding: 1px 4px;
}

/* ── 倒车状态 (R)：后=主画面, 前=PiP ── */
.layout-e-center.is-reverse .layout-e-layer-back {
  inset: 0;
  width: auto;
  aspect-ratio: auto;
  z-index: 1;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
.layout-e-center.is-reverse .layout-e-layer-back :deep(.video-badge) {
  font-size: inherit;
  padding: inherit;
}
.layout-e-center.is-reverse .layout-e-layer-front {
  inset: auto;
  top: 6px;
  left: 6px;
  width: 20%;
  aspect-ratio: 960 / 768;
  z-index: 3;
  border-radius: 4px;
  border: 1.5px solid rgba(255, 77, 79, 0.6);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.7),
    0 0 8px rgba(255, 77, 79, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.3);
  background: #000;
}
.layout-e-center.is-reverse .layout-e-layer-front :deep(.video-badge) {
  font-size: 10px;
  padding: 1px 4px;
}

/* PiP 内视频紧凑裁剪，主画面 contain */
.layout-e-layer-back :deep(video) { object-fit: cover; }
.layout-e-center.is-reverse .layout-e-layer-back :deep(video) { object-fit: contain; }
.layout-e-center.is-reverse .layout-e-layer-front :deep(video) { object-fit: cover; }

/* ── PiP 档位角标：浮于 PiP 小窗右下角 ── */
.layout-e-pip-badge {
  position: absolute;
  z-index: 4;
  pointer-events: none;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 2px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 0, 0, 0.6);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  /* 定位到 PiP 区域内的右下角：PiP top:6 left:6 w:20% AR:1.25 */
  top: calc(6px + 20% / 1.25 - 20px);
  left: calc(6px + 20% - 28px);
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.layout-e-pip-badge.is-reverse {
  color: rgba(255, 77, 79, 0.95);
  text-shadow: 0 0 6px rgba(255, 77, 79, 0.4);
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
.layout-e-hud .hud-stat-sep {
  height: 24px;
  margin: 0 8px;
}
.layout-e-hud .hud-stat {
  min-width: 40px;
}
.layout-e-hud .hud-bar {
  width: 140px;
  height: 3px;
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
.layout-c-video-wrap .webrtc-player,
.layout-c-video-wrap :deep(.webrtc-player),
.layout-c-video-wrap .video-placeholder,
.layout-c-video-wrap :deep([class*="player"]) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.layout-c-video-wrap video,
.layout-c-video-wrap :deep(video) {
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
@rc-text-dim:      rgba(255, 255, 255, 0.62);
@rc-text-label:    rgba(255, 255, 255, 0.62);
@rc-border:        rgba(255, 255, 255, 0.08);
@rc-border-hover:  rgba(255, 255, 255, 0.18);
@rc-surface:       rgba(255, 255, 255, 0.055);
@rc-surface-hover: rgba(255, 255, 255, 0.09);

.pd-vehicle-detail-fs.fs-layout-dark {

  /* ── 视频区 ── */
  .video-section {
    flex: 1; min-height: 0; min-width: 0; width: 100%;
    margin-top: 0 !important; padding-top: 0 !important;
    border: none !important;
    background-color: #0d0d0d !important;
    display: flex; flex-direction: column; overflow: hidden;
  }

  /* ── 布局通用：占满 ── */
  .layout-mode-a,
  .layout-mode-b,
  .layout-mode-c {
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

  /* ── 控制条 ── */
  .remote-control-form {
    flex-shrink: 0;
    margin-bottom: 4px !important;
    padding: 0 12px;
    height: 42px;
    display: flex !important;
    align-items: center;
    gap: 0 12px;
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

  .rc-label {
    font-size: 13px;
    color: @rc-text-label;
    white-space: nowrap;
    font-weight: 500;
    letter-spacing: 0.02em;
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
  .rc-select { width: 200px !important; }
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

  /* ── Checkbox → pill 分段（与布局 radio 一致） ── */
  .rc-checkbox-group {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    background: rgba(0, 0, 0, 0.32);
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
    background: rgba(0, 0, 0, 0.32);
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

</style>
