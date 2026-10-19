<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isWorkspaceRole, sectionPath } from "@/features/workspace/config"
import { when } from "@/features/operations/types"
import AssignmentSettingsCard from "@/features/operations/AssignmentSettingsCard.vue"

const props = defineProps<{ section: string }>()
const ops = useOperationsStore()
const search = ref("")
const unreadOnly = ref(false)
const resetDialog = ref(false)
const approvalOn = ref(ops.state.settings.quoteApprovalThreshold !== null)
const threshold = ref<number | string>(
  ops.state.settings.quoteApprovalThreshold === null ? "" : ops.state.settings.quoteApprovalThreshold / 100,
)
const prefs = reactive({
  name: "",
  phone: "",
  email: true,
  push: true,
  inApp: true,
  timezone: "Africa/Lagos",
  ...ops.preferences,
})
const audit = computed(() =>
  ops.state.audit.filter(item =>
    `${item.action} ${item.actor} ${item.resource} ${item.note}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
const notifications = computed(() => ops.notifications.filter(item => !unreadOnly.value || !item.read))
const canOpen = (requestId?: string) => Boolean(requestId) && ops.requests.some(item => item.id === requestId)

const requestPath = computed(() => {
  const role = ops.actor?.role

  return isWorkspaceRole(role) ? sectionPath(role, role === "provider" ? "jobs" : "requests") : "/"
})
</script>

<template>
  <template v-if="props.section === 'audit'">
    <VTextField
      v-model="search"
      label="Search activity, actor, note or request"
      prepend-inner-icon="tabler-search"
      class="mb-5"
    /><VCard>
      <VCardText>
        <div v-for="entry in audit" :key="entry.id" class="mb-5">
          <strong>{{ entry.action }}</strong>
          <p class="text-body-2 text-medium-emphasis mb-2">
            {{ entry.actor }} · {{ entry.resource }} · {{ when(entry.createdAt) }}
          </p>
          <p v-if="entry.note" class="text-body-2 mb-2">Note: {{ entry.note }}</p>
          <VBtn
            v-if="entry.requestId"
            :to="{ path: requestPath, query: { request: entry.requestId } }"
            size="small"
            variant="text"
          >
            View {{ entry.requestId }} </VBtn
          ><VDivider class="mt-3" />
        </div>
        <p v-if="!audit.length" class="text-medium-emphasis">No matching activity.</p>
      </VCardText>
    </VCard>
  </template>
  <template v-else-if="props.section === 'notifications'">
    <div class="d-flex justify-space-between align-center flex-wrap mb-5">
      <VCheckbox v-model="unreadOnly" label="Unread only" hide-details /><VBtn
        variant="outlined"
        :disabled="ops.busy"
        @click="ops.run({ type: 'notification.read' })"
      >
        Mark all as read
      </VBtn>
    </div>
    <VCard v-for="item in notifications" :key="item.id" class="mb-4">
      <VCardText>
        <VChip v-if="!item.read" size="small" color="primary" class="mb-3"> New </VChip>
        <h2 class="text-h6 mb-2">
          {{ item.title }}
        </h2>
        <p>{{ item.message }}</p>
        <small>{{ when(item.createdAt) }}</small>
        <div class="d-flex flex-wrap gap-3 mt-4">
          <VBtn
            v-if="canOpen(item.requestId)"
            :to="{ path: requestPath, query: { request: item.requestId } }"
            variant="text"
            @click="ops.run({ type: 'notification.read', notificationId: item.id })"
          >
            Open request </VBtn
          ><VBtn
            v-if="!item.read"
            variant="text"
            @click="ops.run({ type: 'notification.read', notificationId: item.id })"
          >
            Mark read
          </VBtn>
        </div>
      </VCardText> </VCard
    ><VAlert v-if="!notifications.length" variant="tonal" color="info"> You are all caught up. </VAlert>
  </template>
  <template v-else>
    <VCard class="mb-5">
      <VCardText>
        <h2 class="text-h5 mb-5">Account preferences</h2>
        <VRow>
          <VCol cols="12" sm="6"> <VTextField v-model="prefs.name" label="Display name" /> </VCol
          ><VCol cols="12" sm="6"> <VTextField v-model="prefs.phone" label="Contact phone" /> </VCol
          ><VCol cols="12" sm="6"> <VTextField :model-value="ops.actor?.email" label="Email address" readonly /> </VCol
          ><VCol cols="12" sm="6">
            <VSelect
              v-model="prefs.timezone"
              :items="[{ title: 'West Africa Time (WAT)', value: 'Africa/Lagos' }]"
              label="Timezone"
            />
          </VCol>
        </VRow>
        <h3 class="text-h6 mt-3">Notification preferences</h3>
        <VCheckbox v-model="prefs.inApp" label="In-app updates" hide-details /><VCheckbox
          v-model="prefs.email"
          label="Email updates"
          hide-details
        /><VCheckbox v-model="prefs.push" label="Push updates" hide-details />
        <p class="text-body-2 text-medium-emphasis my-4">
          Preferences are saved locally. Email and push delivery are simulated in this frontend preview.
        </p>
        <VBtn :loading="ops.busy" @click="ops.run({ type: 'preferences.save', input: prefs })"> Save preferences </VBtn>
      </VCardText> </VCard
    ><VCard v-if="ops.can('settings.manage')" class="mb-5">
      <VCardText>
        <h2 class="text-h5 mb-3">Quote approval</h2>
        <p class="text-body-2 text-medium-emphasis">
          Quotes at or above the threshold, published by anyone who is not a super admin, wait for super admin approval.
        </p>
        <VSwitch
          v-model="approvalOn"
          label="Require super admin approval for high-value quotes"
          hide-details
          class="mb-4"
        /><VTextField v-if="approvalOn" v-model="threshold" label="Threshold (₦)" type="number" min="1" /><VBtn
          :loading="ops.busy"
          @click="ops.run({ type: 'settings.save', quoteApprovalThreshold: approvalOn ? Number(threshold) : null })"
        >
          Save quote approval
        </VBtn>
      </VCardText> </VCard
    ><AssignmentSettingsCard v-if="ops.can('settings.manage')" /><VCard v-if="ops.can('settings.manage')">
      <VCardText>
        <h2 class="text-h5 mb-3">Prototype controls</h2>
        <p class="text-body-2 text-medium-emphasis">Sample activity is shared across demo accounts in this tab until it is closed.</p>
        <VCheckbox v-model="ops.failNext" label="Simulate failure on the next save" /><VBtn
          variant="outlined"
          color="warning"
          @click="resetDialog = true"
        >
          Restore sample records
        </VBtn>
      </VCardText> </VCard
    ><VDialog v-model="resetDialog" max-width="440">
      <VCard>
        <VCardText>
          <h2 class="text-h5 mb-3">Restore sample records?</h2>
          <p>This replaces requests and changes in this tab with the original sample data.</p>
          <div class="d-flex justify-end gap-3">
            <VBtn variant="text" @click="resetDialog = false"> Keep changes </VBtn
            ><VBtn
              color="warning"
              @click="
                () => {
                  ops.reset()
                  resetDialog = false
                }
              "
            >
              Restore samples
            </VBtn>
          </div>
        </VCardText>
      </VCard>
    </VDialog>
  </template>
</template>
