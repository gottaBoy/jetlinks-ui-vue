<script setup lang="ts">
/** 手刹(EPB)、喇叭 — 0 熄灭、1 点亮；远近光见上方 HudHeadlightBeamIcon */
defineProps<{
  epbOn: boolean
  hornOn: boolean
}>()
</script>

<template>
  <div class="hud-aux-row" role="group" aria-label="手刹、喇叭（图标：灭=0，亮=1）">
    <span
      class="hud-aux-ico hud-aux-ico-epb"
      :class="{ 'is-lit': epbOn }"
      title="EPB/手刹 vcu_epb_park_brk_st(s) 0=未拉起 1=拉起"
      role="img"
    >
      <svg class="hud-aux-svg" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.5" />
        <text
          x="12"
          y="15.2"
          text-anchor="middle"
          font-size="10.5"
          font-weight="800"
          fill="currentColor"
          font-family="system-ui, -apple-system, sans-serif"
        >P</text>
      </svg>
    </span>
    <span
      class="hud-aux-ico hud-aux-ico-horn"
      :class="{ 'is-lit': hornOn }"
      title="喇叭 cgw_horn_ctrl_sts 0=off 1=on"
      role="img"
    >
      <svg
        class="hud-aux-svg hud-aux-horn-svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M3.5 9.2H2.1c-.3 0-.5.2-.5.5v4.4c0 .3.2.5.5.5h1.4l3.2 1.2V7.8L3.5 9.2zM8.4 5.1v13.5l4.1 1.5c.2.1.4 0 .5-.2.1 0 .1-.1.1-.2V3.4c0-.1 0-.2-.1-.2-.1-.2-.3-.2-.5-.1L8.4 5.1z"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
          d="M16 6.2c1.2.4 1.8 1.1 1.8 1.5v8.2c0 .4-.6 1.1-1.8 1.4"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.1"
          stroke-linecap="round"
          opacity="0.55"
          d="M18.2 4.2c1.4.4 2.1 1.2 2.1 1.6v12c0 .4-.7 1.1-2.1 1.4"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.hud-aux-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-top: 2px;
}

.hud-aux-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  min-width: 20px;
  color: rgba(255, 255, 255, 0.28);
  transition: color 0.2s ease, filter 0.2s ease;
}

.hud-aux-svg {
  width: 22px;
  height: 22px;
  display: block;
}

.hud-aux-ico-epb.is-lit,
.hud-aux-ico-horn.is-lit {
  color: rgba(255, 210, 100, 0.98);
  filter: drop-shadow(0 0 8px rgba(255, 200, 90, 0.55));
}

@media (prefers-reduced-motion: reduce) {
  .hud-aux-ico {
    transition: none;
  }
}
</style>
