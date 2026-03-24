<template>
  <div class="bind-management-container">
    <RelationList ref="relationListRef" @add-relation="showBindModal" />

    <!-- 绑定表单弹框 -->
    <a-modal
      v-model:visible="bindModalVisible"
      :title="$t('parallel-driving.bind-form.title')"
      width="800px"
      :maskClosable="false"
      :confirmLoading="bindLoading"
      @ok="handleBindSubmit"
      @cancel="handleBindCancel"
    >
      <BindForm ref="bindFormRef" @success="handleBindSuccess" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BindForm from '../../components/BindForm.vue'
import RelationList from '../../components/RelationList.vue'

const { t: $t } = useI18n()
const relationListRef = ref<InstanceType<typeof RelationList>>()
const bindModalVisible = ref(false)
const bindFormRef = ref<InstanceType<typeof BindForm>>()
const bindLoading = ref(false)

const showBindModal = () => {
  bindModalVisible.value = true
}

const handleBindCancel = () => {
  bindModalVisible.value = false
  bindFormRef.value?.reset()
}

const handleBindSubmit = async () => {
  if (!bindFormRef.value) {
    return
  }
  // 触发表单提交
  await bindFormRef.value.submit()
}

const handleBindSuccess = () => {
  bindModalVisible.value = false
  relationListRef.value?.refresh()
  bindFormRef.value?.reset()
}
</script>

<style scoped lang="less">
.bind-management-container {
  padding: 16px;
}
</style>

