<script setup lang="ts">
import { usePublicServices } from "@/features/discovery/public-services"

const props = defineProps<{ modelValue?: string; all?: boolean; label?: string }>()
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

const { services } = usePublicServices()

const model = computed({
  get: () => props.modelValue,
  set: value => emit("update:modelValue", value ?? ""),
})

const tabs = computed(() => [
  ...(props.all ? [{ name: "", label: "All services", icon: "tabler-layout-grid" }] : []),
  ...services.value.map(item => ({ name: item.name, label: item.name, icon: item.icon })),
])
</script>

<template>
  <VTabs
    v-model="model"
    :aria-label="label ?? 'Browse by service'"
    class="service-tabs"
    color="primary-darken-1"
    :mandatory="all ? false : 'force'"
  >
    <VTab v-for="item in tabs" :key="item.name" :value="item.name" class="service-tab" stacked>
      <span class="service-tab__badge">
        <VIcon :icon="item.icon" size="24" />
      </span>
      {{ item.label }}
    </VTab>
  </VTabs>
</template>

<style lang="scss" scoped>
.service-tabs {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  block-size: auto !important;

  :deep(.v-tab.v-btn) {
    block-size: auto;
    flex: 1 0 120px;
    gap: 8px;
    letter-spacing: normal;
    min-inline-size: 120px;
    white-space: nowrap;
    padding-block: 6px 14px;
    text-transform: none;
  }

  :deep(.v-tab .v-btn__content) {
    white-space: nowrap;
  }

  :deep(.v-tab:not(.v-tab--selected)) {
    color: rgb(var(--v-theme-secondary));
  }
}

.service-tab__badge {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 50%;
  block-size: 48px;
  display: flex;
  inline-size: 48px;
  justify-content: center;
}
</style>
