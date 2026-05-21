<template>
  <!--
    远控独立页：复用 VehicleRemoteDeck，presentation 固定为 remote-focus。
    脚本内会强制 layoutMode = 'e'（左中右）并隐藏布局切换，与车辆详情页互不干扰。
  -->
  <VehicleRemoteDeck presentation="remote-focus" />
</template>

<script setup lang="ts">
import VehicleRemoteDeck from '../VehicleRemoteDeck.vue'
</script>
