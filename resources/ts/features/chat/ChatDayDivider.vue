<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="chat-day" role="separator" :aria-label="label">
    <span class="chat-day__pill">{{ label }}</span>
  </div>
</template>

<style scoped lang="scss">
.chat-day {
  display: flex;
  justify-content: center;
  margin-block: 12px 8px;
}

.chat-day__pill {
  padding: 2px 12px;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  line-height: 1.5;
}
</style>
