<script setup lang="ts">
import type { ApprovalView, NotificationView, SettingView } from "@/features/requests/api-types"
import { requestsApi } from "@/services/requests-api"
import { useAuthStore } from "@/stores/auth"

const props = defineProps<{ section: "notifications" | "approvals" | "settings" }>()
const router = useRouter()
const auth = useAuthStore()
const items = ref<NotificationView[]>([])
const approvals = ref<ApprovalView[]>([])
const settings = ref<SettingView[]>([])
const counts = ref({ open: 0, overdue: 0 })
const filter = ref<"can_act" | "mine" | "all" | "overdue">("can_act")
const loading = ref(false)
const saving = ref("")
const error = ref("")
const reason = ref("")
const settingValue = reactive<Record<string, string>>({})
const history = ref<Awaited<ReturnType<typeof requestsApi.settingsHistory>>>()
const switchSettings = [
  {
    key: "provider.requireEmailVerification",
    title: "Provider email verification",
    label: "Require provider email verification",
    description:
      "When enabled, a provider must have a verified email before submitting their profile. Enabled by default.",
    note: "Turning this off lets providers with an unverified email submit their profile for review.",
  },
  {
    key: "provider.requirePhoneVerification",
    title: "Provider phone verification",
    label: "Require provider phone verification",
    description:
      "When enabled, every provider must verify their phone number by SMS before submitting or saving their profile. Disabled by default.",
    note: "Configure SMS delivery before enabling this requirement. Save to apply your change to all providers.",
  },
]
const switchKeys = switchSettings.map(item => item.key)
const switchDraft = reactive<Record<string, boolean>>({})
const switchCards = computed(() =>
  switchSettings.flatMap(item => {
    const setting = settings.value.find(candidate => candidate.key === item.key)

    return setting ? [{ ...item, setting }] : []
  }),
)
const otherSettings = computed(() => settings.value.filter(setting => !switchKeys.includes(setting.key)))
const canManageSettings = computed(() => auth.user?.scopes.includes("settings.manage") ?? false)
const title = (kind: string) => kind.replaceAll("_", " ")
const requestPath = computed(() =>
  auth.user?.role === "admin" ? "/admin/requests" : auth.user?.role === "provider" ? "/jobs" : "/requests",
)

async function load() {
  loading.value = true
  error.value = ""
  try {
    if (props.section === "notifications") {
      const response = await requestsApi.notifications({ page: 1, itemsPerPage: 50 })
      items.value = response.items
    } else if (props.section === "approvals") {
      const response = await requestsApi.approvals({ filter: filter.value, page: 1 })
      approvals.value = response.data
      counts.value = response.counts
    } else {
      settings.value = await requestsApi.settings()
      for (const setting of settings.value) settingValue[setting.key] = JSON.stringify(setting.value, null, 2) ?? "null"
      for (const card of switchCards.value) switchDraft[card.key] = card.setting.value === true
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The workspace data could not be loaded."
  } finally {
    loading.value = false
  }
}

async function markRead(id?: string) {
  saving.value = id ?? "all"
  try {
    await requestsApi.markNotificationsRead(id)
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Notifications could not be updated."
  } finally {
    saving.value = ""
  }
}
const markAllRead = () => markRead()

async function save(setting: SettingView) {
  saving.value = setting.key
  error.value = ""
  try {
    const value: unknown =
      setting.key in switchDraft ? switchDraft[setting.key] : JSON.parse(settingValue[setting.key] ?? "null")
    await requestsApi.saveSettings({
      changes: [{ key: setting.key, value, expectedVersion: setting.version }],
      reason: reason.value,
    })
    reason.value = ""
    await load()
  } catch (cause) {
    error.value =
      cause instanceof SyntaxError
        ? `Enter valid JSON for ${setting.key}.`
        : cause instanceof Error
          ? cause.message
          : "Settings could not be saved."
  } finally {
    saving.value = ""
  }
}

async function loadHistory(key?: string) {
  try {
    history.value = await requestsApi.settingsHistory({ key, page: 1 })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Settings history could not be loaded."
  }
}

watch(() => [props.section, filter.value], load, { immediate: true })
let poll: ReturnType<typeof setInterval> | undefined
watch(
  () => props.section,
  section => {
    if (poll) clearInterval(poll)
    if (section === "notifications") poll = setInterval(load, 30_000)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})
</script>

<template>
  <div>
    <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
    <VProgressLinear v-if="loading" indeterminate class="mb-4" />

    <template v-if="section === 'notifications'">
      <div class="d-flex justify-end mb-4">
        <VBtn
          variant="outlined"
          :disabled="!items.some(item => !item.readAt)"
          :loading="saving === 'all'"
          @click="markAllRead"
          >Mark all read</VBtn
        >
      </div>
      <VList v-if="items.length" lines="two"
        ><VListItem
          v-for="item in items"
          :key="item.id"
          :title="item.title"
          :subtitle="`${item.message} · ${new Date(item.createdAt).toLocaleString()}`"
          :class="{ 'font-weight-bold': !item.readAt }"
        >
          <template #append
            ><div class="d-flex ga-2">
              <VBtn
                v-if="item.requestId"
                size="small"
                variant="text"
                @click="router.push({ path: requestPath, query: { request: item.requestId } })"
                >Open request</VBtn
              ><VBtn v-if="!item.readAt" size="small" :loading="saving === item.id" @click="markRead(item.id)"
                >Mark read</VBtn
              >
            </div></template
          >
        </VListItem></VList
      >
      <VCard v-else><VCardText class="text-medium-emphasis">You are all caught up.</VCardText></VCard>
    </template>

    <template v-else-if="section === 'approvals'">
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <VSelect
          v-model="filter"
          :items="[
            { title: 'You can act', value: 'can_act' },
            { title: 'All open', value: 'all' },
            { title: 'Overdue', value: 'overdue' },
          ]"
          label="Queue"
          hide-details
          class="filter"
        /><VChip color="primary" variant="tonal">{{ counts.open }} open</VChip
        ><VChip color="error" variant="tonal">{{ counts.overdue }} overdue</VChip>
      </div>
      <VList v-if="approvals.length" lines="two"
        ><VListItem
          v-for="item in approvals"
          :key="item.id"
          :title="`${title(item.kind)} · ${item.requestId || item.itemId}`"
          :subtitle="`Due ${item.dueAt ? new Date(item.dueAt).toLocaleString() : 'not set'}${item.blockedReason ? ` · ${item.blockedReason}` : ''}`"
        >
          <template #append
            ><div class="d-flex align-center ga-2">
              <VChip v-if="item.overdue" color="error" size="small">Overdue</VChip
              ><VChip v-if="item.canDecide" color="success" size="small" variant="tonal">You can act</VChip
              ><VBtn
                v-if="item.requestId"
                size="small"
                variant="outlined"
                @click="router.push({ path: '/admin/requests', query: { request: item.requestId } })"
                >Review</VBtn
              >
            </div></template
          >
        </VListItem></VList
      >
      <VCard v-else><VCardText class="text-medium-emphasis">No approval items match this filter.</VCardText></VCard>
    </template>

    <template v-else>
      <VTextField v-model="reason" label="Required reason for changes" class="mb-4" />
      <VCard v-for="card in switchCards" :key="card.key" class="mb-4">
        <VCardText>
          <h3 class="text-h6 mb-2">{{ card.title }}</h3>
          <p class="text-body-2 text-medium-emphasis">{{ card.description }}</p>
          <VSwitch
            v-model="switchDraft[card.key]"
            :label="card.label"
            color="primary"
            :disabled="!canManageSettings || !!saving"
            hide-details
            class="mb-3"
          />
          <p class="text-body-2 text-medium-emphasis mb-4">{{ card.note }}</p>
          <div class="d-flex flex-wrap gap-2">
            <VBtn
              :disabled="
                !canManageSettings ||
                reason.trim().length < 5 ||
                switchDraft[card.key] === card.setting.value ||
                !!saving
              "
              :loading="saving === card.key"
              @click="save(card.setting)"
              >Save requirement</VBtn
            >
            <VBtn variant="outlined" @click="loadHistory(card.key)">History</VBtn>
          </div>
        </VCardText>
      </VCard>
      <VCard v-for="setting in otherSettings" :key="setting.key" class="mb-4"
        ><VCardText>
          <div class="d-flex justify-space-between align-center flex-wrap ga-2 mb-2">
            <h3 class="text-h6">{{ setting.key }}</h3>
            <VChip size="small" variant="tonal">{{ setting.riskClass }} · v{{ setting.version }}</VChip>
          </div>
          <VTextarea v-model="settingValue[setting.key]" label="Value (JSON)" rows="3" auto-grow />
          <div class="d-flex ga-2">
            <VBtn :disabled="!reason.trim()" :loading="saving === setting.key" @click="save(setting)">Save setting</VBtn
            ><VBtn variant="outlined" @click="loadHistory(setting.key)">History</VBtn>
          </div>
        </VCardText></VCard
      >
      <VList v-if="history?.items.length" class="mt-5"
        ><VListItem
          v-for="(entry, index) in history.items"
          :key="index"
          :title="String(entry.key || 'Setting change')"
          :subtitle="JSON.stringify(entry) ?? ''"
      /></VList>
      <VCard v-else-if="!settings.length"
        ><VCardText class="text-medium-emphasis">No request-flow settings were returned.</VCardText></VCard
      >
    </template>
  </div>
</template>

<style scoped>
.filter {
  max-inline-size: 15rem;
}
</style>
