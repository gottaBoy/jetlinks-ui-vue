<template>
  <div
    class="hud-stat hud-stat-steer"
    :class="['steer-' + steerDir, { 'is-steer-deg-hidden': !showSteerDegree }]"
  >
    <span class="hud-stat-label">转向</span>
    <div class="hud-steer-stack">
      <span class="hud-stat-value hud-steer-value">
        <span
          class="hud-steer-dir-visual"
          :class="'dir-' + steerDir"
          role="img"
          :aria-label="steerAriaLabel"
        >
          <svg v-if="steerDir === 'left'" class="hud-steer-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M14.5 5.5L8 12l6.5 6.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M5 12h5.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else-if="steerDir === 'right'" class="hud-steer-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M9.5 5.5L16 12l-6.5 6.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M19 12h-5.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.25"
              stroke-linecap="round"
            />
          </svg>
          <svg v-else class="hud-steer-icon hud-steer-icon-straight" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M12 5.5v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span v-if="showSteerDegree" class="hud-steer-deg">{{ steerDegreeText }}</span>
      </span>
      <div
        v-if="showKnuckleRow"
        class="hud-steer-knuckle-row"
        :title="knuckleTitle"
      >
        <span class="hud-steer-knuckle-label">{{ knuckleLabel }}</span>
        <span class="hud-steer-knuckle-deg">{{ steerKnuckleDegreeText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    steerDir: 'left' | 'right' | 'center'
    steerDegreeText: string
    steerKnuckleDegreeText: string
    steerAriaLabel: string
    /** 是否显示方向盘转角（转向角）数字 */
    showSteerDegree?: boolean
    /** 是否显示前轮（转向节）转角一行 */
    showKnuckleRow?: boolean
  }>(),
  { showSteerDegree: true, showKnuckleRow: true }
)

const { t } = useI18n()

const knuckleLabel = computed(() => t('parallel-driving.vehicle-detail.hud-wheel-angle'))

const knuckleTitle = computed(() =>
  t('parallel-driving.vehicle-detail.hud-wheel-angle-hint')
)
</script>

<style scoped>
/* 与 detail/index.vue status-hud-xiaomi 转向块一致（子组件内需自包含，避免 scoped 无法命中内部节点） */
.hud-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 36px;
}

.hud-stat-steer {
  min-width: calc(22px + 4px + 5ch);
}

.hud-stat-steer.is-steer-deg-hidden {
  min-width: 22px;
}

.hud-stat-label {
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.42);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1;
}

.hud-steer-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hud-steer-value {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.02em;
}

.hud-steer-dir-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  transition: filter 0.2s ease;
}

.hud-steer-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.hud-steer-deg {
  font-variant-numeric: tabular-nums;
  display: inline-block;
  min-width: 5ch;
  text-align: right;
}

.hud-steer-knuckle-row {
  display: inline-flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  line-height: 1;
}

.hud-steer-knuckle-label {
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.42);
  letter-spacing: 0.04em;
}

.hud-steer-knuckle-deg {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.72);
  min-width: 3.5ch;
  text-align: right;
}

.hud-stat-steer.steer-left .hud-steer-value,
.hud-stat-steer.steer-right .hud-steer-value {
  color: #4fc3f7;
}

.hud-stat-steer.steer-left .hud-steer-dir-visual,
.hud-stat-steer.steer-right .hud-steer-dir-visual {
  filter: drop-shadow(0 0 7px rgba(79, 195, 247, 0.4));
}

.hud-stat-steer.steer-center .hud-steer-value {
  color: rgba(255, 255, 255, 0.9);
}

.hud-stat-steer.steer-center .hud-steer-icon-straight {
  opacity: 0.92;
}

.hud-stat-steer.steer-left .hud-steer-knuckle-deg,
.hud-stat-steer.steer-right .hud-steer-knuckle-deg {
  color: rgba(129, 212, 250, 0.88);
}

@media (prefers-reduced-motion: reduce) {
  .hud-steer-dir-visual {
    transition: none;
  }
}
</style>
