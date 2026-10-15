<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; complete: boolean; detail: string }>
}>()
</script>

<template>
  <VList lines="two" class="py-0">
    <VListItem v-for="item in items" :key="item.label" class="px-0">
      <template #prepend>
        <VAvatar :color="item.complete ? 'success' : 'warning'" variant="tonal" size="34" class="me-3">
          <VIcon :icon="item.complete ? 'tabler-check' : 'tabler-alert-triangle'" size="18" />
        </VAvatar>
      </template>
      <VListItemTitle class="font-weight-semibold">
        {{ item.label }}
      </VListItemTitle>
      <VListItemSubtitle>{{ item.detail }}</VListItemSubtitle>
    </VListItem>
  </VList>
</template>
