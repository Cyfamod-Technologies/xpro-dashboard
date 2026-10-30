<script setup lang="ts">
import { fullName, staffActions } from "@/features/staff/staff-helpers"
import type { StaffActionContext, StaffActionKey } from "@/features/staff/staff-helpers"
import type { StaffMemberView } from "@/services/staff-api"

const props = defineProps<{ member: StaffMemberView; context: StaffActionContext }>()

defineEmits<{ open: []; action: [StaffActionKey] }>()

const entries = computed(() => staffActions(props.member, props.context))
</script>

<template>
  <VMenu>
    <template #activator="{ props: menu }">
      <VBtn
        v-bind="menu"
        icon="tabler-dots-vertical"
        variant="text"
        size="small"
        :aria-label="`Actions for ${fullName(member)}`"
        @click.stop
      />
    </template>
    <VList density="compact">
      <VListItem prepend-icon="tabler-user" title="Open details" @click="$emit('open')" />
      <VListItem
        v-for="entry in entries"
        :key="entry.key"
        :prepend-icon="entry.icon"
        :title="entry.label"
        :subtitle="entry.disabledReason"
        :disabled="Boolean(entry.disabledReason)"
        :base-color="entry.color"
        @click="$emit('action', entry.key)"
      />
    </VList>
  </VMenu>
</template>
