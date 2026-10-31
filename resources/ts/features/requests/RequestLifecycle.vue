<script setup lang="ts">
import type { RequestView, ScheduleView } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { useAuthStore } from "@/stores/auth"
import type { V1Actor, V1Request } from "@/features/v1/types"
import { v1Capabilities } from "@/features/v1/access"
import { v1Api } from "@/services/v1-api"
import V1ApproveDialog from "@/features/v1/V1ApproveDialog.vue"
import V1AssignStaff from "@/features/v1/V1AssignStaff.vue"
import V1Conversation from "@/features/v1/V1Conversation.vue"
import V1DecisionPanel from "@/features/v1/V1DecisionPanel.vue"
import V1DenyDialog from "@/features/v1/V1DenyDialog.vue"
import V1ReplaceProviderDialog from "@/features/v1/V1ReplaceProviderDialog.vue"
import V1RequestSummary from "@/features/v1/V1RequestSummary.vue"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{
  request: RequestView
  v1Request?: V1Request
  v1Viewer?: V1Actor
  viewerId?: string
}>()
const emit = defineEmits<{ refresh: [] }>()
const auth = useAuthStore()
const v1Current = ref<V1Request | undefined>(props.v1Request)
const v1ApproveOpen = ref(false)
const v1DenyOpen = ref(false)
const v1ReplaceOpen = ref(false)
const v1Notice = ref("")
const v1Error = ref("")
const isV1 = computed(() => Boolean(props.v1Request && props.v1Viewer))
const v1Caps = computed(() => v1Capabilities(props.v1Viewer ?? null))
watch(
  () => props.v1Request,
  value => {
    v1Current.value = value
  },
)
const applyV1 = (updated: V1Request) => {
  v1Current.value = updated
  v1Notice.value = "Request updated."
  v1Error.value = ""
  emit("refresh")
}
const refreshV1 = async () => {
  if (!props.v1Request) return
  try {
    v1Current.value = await v1Api.getRequest(props.v1Request.id)
    v1Error.value = ""
  } catch (cause) {
    v1Error.value = getErrorMessage(cause, "The request could not be refreshed.")
  }
}
const activeTab = ref("messages")
const busy = ref(false)
const error = ref("")
const notice = ref("")
const schedules = ref<ScheduleView[]>([])
const updates = ref<Awaited<ReturnType<typeof requestsApi.updates>>>([])
const messages = ref<Awaited<ReturnType<typeof requestsApi.messages>>>([])
const activity = ref<Awaited<ReturnType<typeof requestsApi.activity>>>()
const escalations = ref<Awaited<ReturnType<typeof requestsApi.requestEscalations>>>([])
const loadWarning = ref("")
const startAt = ref("")
const endAt = ref("")
const scheduleNote = ref("")
const progressStatus = ref<"in_progress" | "blocked" | "completion_pending">("in_progress")
const progressNote = ref("")
const progressFiles = ref<File[]>([])
const progressKey = ref(globalThis.crypto.randomUUID())
const reviewNote = ref("")
const holdKind = ref("staff")
const holdReason = ref("")
const customerHoldNote = ref("")
const noShowNote = ref("")
const completionNote = ref("")
const issueNote = ref("")
const cancellationNote = ref("")
const ownershipNote = ref("")
const handoffStaffId = ref("")
const escalationTarget = ref<"operations" | "super_admin">("operations")
const escalationNote = ref("")
const editTitle = ref(props.request.title ?? "")
const editDescription = ref(props.request.description ?? "")
const editNote = ref("")
const messageText = ref("")
const messageFiles = ref<File[]>([])
const channel = ref<"customer" | "provider" | "internal">(auth.user?.role === "provider" ? "provider" : "customer")
const cancellationReasonCode = ref("customer_changed_mind")

const can = (action: string) => props.request.allowedActions.includes(action)
const role = computed(() => auth.user?.role)
const messageChannels = computed(() => {
  const choices: Array<{ title: string; value: "customer" | "provider" | "internal"; permission: string }> = [
    { title: "Customer", value: "customer", permission: "message.customer" },
    { title: "Provider", value: "provider", permission: "message.provider" },
    { title: "Internal", value: "internal", permission: "message.internal" },
  ]
  if (role.value === "customer") return choices.filter(item => item.value === "customer")
  if (role.value === "provider") return []

  return choices.filter(item => item.value === "customer" && auth.user?.scopes.includes(item.permission))
})
watch(
  messageChannels,
  choices => {
    if (!choices.some(item => item.value === channel.value) && choices[0]) channel.value = choices[0].value
  },
  { immediate: true },
)
const pendingCancellation = computed(() => props.request.cancellations?.find(item => item.status === "pending"))
// `/cancel` is the free cancellation (`request.cancel`); a paid or active request goes through `/cancellations`.
const submitCancellation = () =>
  can("request.cancel")
    ? requestsApi.cancel(props.request.id, cancellationNote.value, props.request.version)
    : requestsApi.requestCancellation(
        props.request.id,
        { reasonCode: cancellationReasonCode.value, note: cancellationNote.value },
        props.request.version,
      )
const formatWAT = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(value),
  )
const currentSchedule = computed(
  () => schedules.value.find(item => item.status === "confirmed") ?? schedules.value.at(-1),
)
const asWAT = (value: string) => new Date(`${value}:00+01:00`).toISOString()

async function load() {
  if (isV1.value) return
  const id = props.request.id
  schedules.value = props.request.schedules ?? (props.request.schedule ? [props.request.schedule] : [])
  // V1 exposes the customer conversation only; the other lifecycle APIs stay available for later releases.
  const results = await Promise.allSettled([
    Promise.resolve([]),
    role.value === "provider" ? Promise.resolve([]) : requestsApi.messages(id, { channel: "customer" }),
    Promise.resolve(undefined),
    Promise.resolve([]),
  ])
  const failed: string[] = []
  if (results[0].status === "fulfilled") updates.value = results[0].value
  else if (can("progress.add") || can("progress.review")) failed.push("progress updates")
  if (results[1].status === "fulfilled") messages.value = results[1].value
  else failed.push("messages")
  if (results[2].status === "fulfilled") activity.value = results[2].value
  else failed.push("activity")
  if (results[3].status === "fulfilled") escalations.value = results[3].value
  else failed.push("escalations")
  loadWarning.value = failed.length ? `Could not load ${failed.join(", ")}. Refresh to try again.` : ""
}

async function loadMessages() {
  try {
    messages.value = await requestsApi.messages(props.request.id, { channel: channel.value })
  } catch {
    messages.value = []
  }
}

async function run(action: () => Promise<unknown>, success: string) {
  busy.value = true
  error.value = ""
  notice.value = ""
  try {
    await action()
    notice.value = success
    await load()
    emit("refresh")
  } catch (cause) {
    if (cause instanceof RequestsApiError && cause.code === "VERSION_CONFLICT") {
      error.value = "This request has changed. Refresh and retry."
      progressKey.value = globalThis.crypto.randomUUID()
      await load()
      emit("refresh")
    } else error.value = cause instanceof Error ? cause.message : "The request could not be completed."
  } finally {
    busy.value = false
  }
}

async function uploadFiles(files: File[], purpose: "progress_evidence" | "message_attachment") {
  const ids: Array<{ id: string }> = []
  for (const file of files) {
    const upload = await requestsApi.createUpload({ name: file.name, size: file.size, type: file.type, purpose })
    const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })
    if (!response.ok) throw new Error(`Could not upload ${file.name}.`)
    await requestsApi.completeUpload(upload.id)
    ids.push({ id: upload.id })
  }

  return ids
}

async function addProgress() {
  busy.value = true
  error.value = ""
  try {
    const attachments = await uploadFiles(progressFiles.value, "progress_evidence")
    await requestsApi.addProgress(
      props.request.id,
      { status: progressStatus.value, note: progressNote.value, attachments },
      props.request.version,
      progressKey.value,
    )
    progressFiles.value = []
    progressNote.value = ""
    progressKey.value = globalThis.crypto.randomUUID()
    notice.value = "Progress update submitted for review."
    await load()
    emit("refresh")
  } catch (cause) {
    if (cause instanceof RequestsApiError && cause.code === "VERSION_CONFLICT") {
      error.value = "This request has changed. Refresh and retry."
      progressKey.value = globalThis.crypto.randomUUID()
      await load()
      emit("refresh")
    } else error.value = cause instanceof Error ? cause.message : "The update could not be submitted."
  } finally {
    busy.value = false
  }
}

async function sendMessage() {
  await run(async () => {
    const attachments = await uploadFiles(messageFiles.value, "message_attachment")

    return requestsApi.sendMessage(
      props.request.id,
      { channel: channel.value, text: messageText.value, attachments },
      props.request.version,
    )
  }, "Message sent.")
  if (!error.value) messageText.value = ""
  if (!error.value) messageFiles.value = []
}

async function openFile(id: string) {
  try {
    const { url } = await requestsApi.fileLink(id)
    window.location.assign(url)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The file is unavailable."
  }
}

watch(channel, loadMessages)
watch(() => props.request.id, load, { immediate: true })
watch(() => props.request.version, load)
</script>

<template>
  <div v-if="isV1 && v1Current" class="mt-6">
    <VAlert v-if="v1Error" type="error" variant="tonal" class="mb-4">{{ v1Error }}</VAlert>
    <VAlert v-if="v1Notice" type="success" variant="tonal" class="mb-4">{{ v1Notice }}</VAlert>
    <V1DecisionPanel :request="v1Current" :viewer="v1Viewer!" class="mb-4" />
    <VCard v-if="v1Viewer !== 'customer'" variant="outlined" class="mb-4">
      <VCardText>
        <VRow>
          <VCol cols="12" md="6">
            <V1AssignStaff v-if="v1Caps.canAssignStaff" :request="v1Current" @updated="applyV1" @refresh="refreshV1" />
            <div v-else>
              <div class="text-caption text-medium-emphasis">Assigned staff</div>
              <div class="text-body-1">{{ v1Current.assignee?.name ?? "Not assigned" }}</div>
            </div>
          </VCol>
          <VCol cols="12" md="6">
            <div class="text-caption text-medium-emphasis mb-2">Decision</div>
            <div v-if="v1Caps.canDecide && v1Current.status === 'submitted'" class="d-flex flex-wrap gap-2">
              <VBtn color="primary" prepend-icon="tabler-check" @click="v1ApproveOpen = true">Approve request</VBtn>
              <VBtn color="error" variant="outlined" prepend-icon="tabler-x" @click="v1DenyOpen = true">
                Deny request
              </VBtn>
            </div>
            <p v-else-if="v1Current.status === 'submitted'" class="text-body-2 text-medium-emphasis mb-0">
              Only an admin can approve or deny. Staff can chat with the customer and send quotes.
            </p>
            <div
              v-else-if="v1Current.status === 'approved' && v1Caps.canReplaceProvider"
              class="d-flex flex-wrap align-center gap-3"
            >
              <span class="text-body-2">Provider: {{ v1Current.provider?.providerName }}</span>
              <VBtn variant="outlined" prepend-icon="tabler-replace" @click="v1ReplaceOpen = true">
                Replace provider
              </VBtn>
            </div>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">The decision is final and can't be changed.</p>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
    <template v-if="v1Viewer === 'customer'">
      <V1RequestSummary :request="v1Current" />
      <VCard variant="outlined" class="mt-4">
        <VCardText class="d-flex flex-wrap align-center justify-space-between gap-4">
          <div>
            <h3 class="text-h6 mb-1">Chat for this request</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">Open Messages to talk with Xpro about this request.</p>
          </div>
          <VBtn :to="{ path: '/messages', query: { request: v1Current.id } }" prepend-icon="tabler-message-circle">
            View chat for this request
          </VBtn>
        </VCardText>
      </VCard>
    </template>
    <VRow v-else>
      <VCol cols="12" lg="6">
        <V1RequestSummary :request="v1Current" show-customer />
        <VCard v-if="v1Current.activity.length" variant="outlined" class="mt-4">
          <VCardText>
            <h3 class="text-h6 mb-3">History</h3>
            <div v-for="entry in [...v1Current.activity].reverse()" :key="entry.id" class="mb-3">
              <div class="text-body-2">{{ entry.text }}</div>
              <div class="text-caption text-medium-emphasis">{{ entry.at }}</div>
            </div>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" lg="6">
        <V1Conversation
          :request-id="v1Current.id"
          :status="v1Current.status"
          :viewer="v1Viewer!"
          :viewer-id="viewerId ?? auth.user?.id ?? ''"
        />
      </VCol>
    </VRow>
    <V1ApproveDialog
      v-model="v1ApproveOpen"
      :request="v1Current"
      @updated="applyV1"
      @approved="applyV1"
      @refresh="refreshV1"
    />
    <V1DenyDialog v-model="v1DenyOpen" :request="v1Current" @denied="applyV1" @refresh="refreshV1" />
    <V1ReplaceProviderDialog v-model="v1ReplaceOpen" :request="v1Current" @replaced="applyV1" @refresh="refreshV1" />
  </div>
  <VCard v-else class="mt-6">
    <VCardText>
      <h2 class="text-h5 mb-4">Request lifecycle</h2>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
      <VAlert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</VAlert>
      <VAlert v-if="loadWarning" type="warning" variant="tonal" class="mb-4">{{ loadWarning }}</VAlert>
      <VCard v-if="can('request.update')" variant="tonal" class="mb-5"
        ><VCardText>
          <h3 class="text-subtitle-1 mb-3">Edit request brief</h3>
          <VTextField v-model="editTitle" label="Request title" />
          <VTextarea v-model="editDescription" label="Project brief" rows="4" />
          <VTextField v-if="role === 'admin'" v-model="editNote" label="Required staff edit note" />
          <VBtn
            :disabled="!editTitle.trim() || !editDescription.trim() || (role === 'admin' && !editNote.trim())"
            :loading="busy"
            @click="
              run(
                () =>
                  requestsApi.update(
                    request.id,
                    { title: editTitle, description: editDescription, ...(role === 'admin' ? { note: editNote } : {}) },
                    request.version,
                  ),
                'Request details updated.',
              )
            "
            >Save changes</VBtn
          >
        </VCardText></VCard
      >
      <VCard
        v-if="
          role === 'admin' &&
          (can('request.claim') ||
            can('request.release') ||
            can('request.handoff') ||
            can('request.reassign') ||
            can('request.escalate'))
        "
        variant="tonal"
        class="mb-5"
        ><VCardText>
          <h3 class="text-subtitle-1 mb-3">Ownership and escalation</h3>
          <VTextField v-model="ownershipNote" label="Ownership or escalation note" />
          <div class="d-flex flex-wrap ga-2 mb-3">
            <VBtn
              v-if="can('request.claim')"
              :loading="busy"
              @click="run(() => requestsApi.claim(request.id, request.version), 'Request claimed.')"
              >Claim</VBtn
            ><VBtn
              v-if="can('request.release') && request.staffOwnerId"
              :disabled="!ownershipNote.trim()"
              :loading="busy"
              @click="
                run(
                  () =>
                    requestsApi.releaseOwnership(
                      request.id,
                      { note: ownershipNote, expectedOwnerId: request.staffOwnerId! },
                      request.version,
                    ),
                  'Ownership released.',
                )
              "
              >Release</VBtn
            >
          </div>
          <div v-if="can('request.handoff') || can('request.reassign')" class="d-flex flex-wrap ga-2">
            <VTextField v-model="handoffStaffId" label="Staff user ID" /><VBtn
              v-if="can('request.handoff')"
              :disabled="!handoffStaffId.trim() || !ownershipNote.trim()"
              :loading="busy"
              @click="
                run(
                  () =>
                    requestsApi.handoff(
                      request.id,
                      { toStaffId: handoffStaffId, note: ownershipNote },
                      request.version,
                    ),
                  'Request handed off.',
                )
              "
              >Hand off</VBtn
            ><VBtn
              v-if="can('request.reassign') && request.staffOwnerId"
              :disabled="!handoffStaffId.trim() || !ownershipNote.trim()"
              :loading="busy"
              @click="
                run(
                  () =>
                    requestsApi.reassign(
                      request.id,
                      { staffId: handoffStaffId, note: ownershipNote, expectedOwnerId: request.staffOwnerId! },
                      request.version,
                    ),
                  'Request reassigned.',
                )
              "
              >Reassign</VBtn
            >
          </div>
          <div v-if="can('request.escalate')" class="d-flex flex-wrap ga-2 mt-3">
            <VSelect
              v-model="escalationTarget"
              :items="[
                { title: 'Operations', value: 'operations' },
                { title: 'Super admin', value: 'super_admin' },
              ]"
              label="Escalate to"
            /><VTextField v-model="escalationNote" label="Escalation note" /><VBtn
              :disabled="!escalationNote.trim()"
              :loading="busy"
              @click="
                run(
                  () =>
                    requestsApi.escalateRequest(
                      request.id,
                      { target: escalationTarget, note: escalationNote },
                      request.version,
                    ),
                  'Request escalated.',
                )
              "
              >Escalate</VBtn
            >
          </div>
          <VList v-if="escalations.length"
            ><VListItem
              v-for="item in escalations"
              :key="item.id"
              :title="`Escalation to ${item.target.replaceAll('_', ' ')} · ${item.resolvedAt ? 'resolved' : 'open'}`"
              :subtitle="item.note"
          /></VList> </VCardText
      ></VCard>
      <VTabs v-if="role !== 'provider'" v-model="activeTab" class="mb-5" show-arrows>
        <VTab value="messages">Messages</VTab>
      </VTabs>

      <section v-if="activeTab === 'schedule'">
        <VAlert variant="tonal" color="info" class="mb-4">Times are entered in West Africa Time (UTC+1).</VAlert>
        <div v-if="can('schedule.propose')" class="d-flex flex-wrap ga-3 mb-5">
          <VTextField v-model="startAt" type="datetime-local" label="Start (WAT)" />
          <VTextField v-model="endAt" type="datetime-local" label="End (WAT)" />
          <VTextField v-model="scheduleNote" label="Instructions" />
          <VBtn
            :disabled="!startAt || !endAt || endAt <= startAt"
            :loading="busy"
            @click="
              run(
                () =>
                  requestsApi.proposeSchedule(
                    request.id,
                    { startAt: asWAT(startAt), endAt: asWAT(endAt), note: scheduleNote || undefined },
                    request.version,
                  ),
                'Schedule proposal sent.',
              )
            "
            >Propose</VBtn
          >
        </div>
        <VList v-if="schedules.length"
          ><VListItem
            v-for="(item, index) in schedules"
            :key="item.id || index"
            :title="`${formatWAT(item.startAt)} – ${new Date(item.endAt).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })} WAT`"
            :subtitle="`${item.status} · ${item.note || 'No note'}`"
          >
            <template #append
              ><div
                v-if="item.id && item.status === 'proposed' && (can('schedule.respond') || role === 'customer')"
                class="d-flex ga-2"
              >
                <VBtn
                  size="small"
                  :loading="busy"
                  @click="
                    run(
                      () => requestsApi.respondSchedule(request.id, item.id!, { accept: true }, request.version),
                      'Schedule response saved.',
                    )
                  "
                  >Accept</VBtn
                ><VBtn
                  size="small"
                  variant="tonal"
                  @click="
                    run(
                      () =>
                        requestsApi.requestScheduleChange(
                          request.id,
                          item.id!,
                          scheduleNote || 'Please propose another time.',
                          request.version,
                        ),
                      'Change requested.',
                    )
                  "
                  >Request change</VBtn
                >
              </div></template
            >
          </VListItem></VList
        >
        <p v-else class="text-medium-emphasis">No schedule has been proposed.</p>
        <VChip
          v-if="
            currentSchedule &&
            new Date(currentSchedule.startAt).getTime() >= Date.now() &&
            new Date(currentSchedule.startAt).getTime() - Date.now() < 48 * 3600_000
          "
          color="warning"
          variant="tonal"
          >Appointment within 48 hours</VChip
        >
      </section>

      <section v-else-if="activeTab === 'progress'">
        <div v-if="can('progress.add')" class="mb-5">
          <VSelect
            v-model="progressStatus"
            :items="[
              { title: 'Start or continue work', value: 'in_progress' },
              { title: 'Report a blocker', value: 'blocked' },
              { title: 'Report completion', value: 'completion_pending' },
            ]"
            label="Update type"
          />
          <VTextarea v-model="progressNote" label="Work update" rows="3" />
          <VFileInput v-model="progressFiles" multiple label="Evidence" accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4" />
          <VBtn :disabled="!progressNote.trim()" :loading="busy" @click="addProgress">Submit update</VBtn>
        </div>
        <VAlert v-if="can('request.hold')" variant="tonal" color="warning" class="mb-4">
          <VSelect
            v-model="holdKind"
            :items="['staff', 'no_show', 'provider_suspended', 'customer_suspended']"
            label="Hold type"
          />
          <VTextField v-model="holdReason" label="Internal reason" />
          <VTextField v-model="customerHoldNote" label="Customer-facing note" />
          <VBtn
            :disabled="!holdReason.trim()"
            :loading="busy"
            @click="
              run(
                () =>
                  requestsApi.hold(
                    request.id,
                    { kind: holdKind, reason: holdReason, customerNote: customerHoldNote || undefined },
                    request.version,
                  ),
                'Request put on hold.',
              )
            "
            >Place on hold</VBtn
          >
        </VAlert>
        <VBtn
          v-if="can('request.releaseHold')"
          class="mb-4"
          :loading="busy"
          @click="
            run(() => requestsApi.releaseHold(request.id, 'Hold cleared by staff.', request.version), 'Hold released.')
          "
          >Release hold</VBtn
        >
        <VCard v-if="can('noshow.record') && schedules.length" variant="tonal" class="mb-4"
          ><VCardText>
            <h3 class="text-subtitle-1 mb-3">Record a no-show</h3>
            <VTextField v-model="noShowNote" label="What happened?" />
            <VBtn
              :disabled="!noShowNote.trim() || !currentSchedule?.id"
              :loading="busy"
              @click="
                run(
                  () =>
                    requestsApi.recordNoShow(
                      request.id,
                      { scheduleId: currentSchedule!.id!, note: noShowNote },
                      request.version,
                    ),
                  'No-show recorded for review.',
                )
              "
              >Record allegation</VBtn
            >
          </VCardText></VCard
        >
        <VList v-if="request.noShows?.length" class="mb-4"
          ><VListItem
            v-for="item in request.noShows"
            :key="item.id"
            :title="`No-show ${item.status}`"
            :subtitle="item.note"
          >
            <template #append
              ><div class="d-flex ga-2">
                <VBtn
                  v-if="item.status === 'open' && can('noshow.confirm')"
                  size="small"
                  :loading="busy"
                  @click="
                    run(
                      () =>
                        requestsApi.decideNoShow(
                          request.id,
                          item.id,
                          {
                            outcome: 'confirm',
                            note: reviewNote || 'Confirmed after review.',
                            version: item.version ?? request.version,
                          },
                          request.version,
                        ),
                      'No-show confirmed.',
                    )
                  "
                  >Confirm</VBtn
                ><VBtn
                  v-if="item.status === 'open' && can('noshow.dismiss')"
                  size="small"
                  variant="tonal"
                  @click="
                    run(
                      () =>
                        requestsApi.decideNoShow(
                          request.id,
                          item.id,
                          {
                            outcome: 'dismiss',
                            note: reviewNote || 'Not confirmed after review.',
                            version: item.version ?? request.version,
                          },
                          request.version,
                        ),
                      'No-show dismissed.',
                    )
                  "
                  >Dismiss</VBtn
                ><VBtn
                  v-if="item.status === 'confirmed' && can('noshow.correct')"
                  size="small"
                  color="warning"
                  variant="tonal"
                  @click="
                    run(
                      () =>
                        requestsApi.correctNoShow(
                          request.id,
                          item.id,
                          {
                            note: reviewNote || 'Correction recorded by staff.',
                            version: item.version ?? request.version,
                          },
                          request.version,
                        ),
                      'No-show correction recorded.',
                    )
                  "
                  >Correct</VBtn
                >
              </div></template
            >
          </VListItem></VList
        >
        <VList v-if="updates.length"
          ><VListItem
            v-for="item in updates"
            :key="item.id"
            :title="`${item.target.replaceAll('_', ' ')} · ${item.state}`"
            :subtitle="`${item.note}${item.reviewNote ? ` · Review: ${item.reviewNote}` : ''} · ${new Date(item.createdAt).toLocaleString()}`"
          >
            <template #append
              ><div class="d-flex flex-wrap ga-2">
                <VBtn
                  v-for="file in item.attachments"
                  :key="file.id"
                  size="small"
                  variant="text"
                  @click="openFile(file.id)"
                  >{{ file.name }}</VBtn
                ><VBtn
                  v-if="item.state === 'pending' && can('progress.review')"
                  size="small"
                  :loading="busy"
                  @click="
                    run(
                      () => requestsApi.reviewProgress(request.id, item.id, { approve: true }, request.version),
                      'Update approved.',
                    )
                  "
                  >Approve</VBtn
                ><VBtn
                  v-if="item.state === 'pending' && can('progress.review')"
                  size="small"
                  color="error"
                  variant="tonal"
                  @click="
                    run(
                      () =>
                        requestsApi.reviewProgress(
                          request.id,
                          item.id,
                          { approve: false, note: reviewNote || 'Does not meet review requirements.' },
                          request.version,
                        ),
                      'Update returned.',
                    )
                  "
                  >Return</VBtn
                >
              </div></template
            >
          </VListItem></VList
        >
      </section>

      <section v-else-if="activeTab === 'completion'">
        <VAlert v-if="request.completion?.confirmationDueAt" type="info" variant="tonal" class="mb-4"
          >Please respond by {{ new Date(request.completion.confirmationDueAt).toLocaleString() }}. Evidence is attached
          to the completion update.</VAlert
        >
        <div v-if="can('completion.respond')" class="mb-5">
          <VTextarea v-model="completionNote" label="Confirmation or issue note" /><VBtn
            :loading="busy"
            @click="
              run(
                () =>
                  requestsApi.respondCompletion(
                    request.id,
                    { acknowledge: true, note: completionNote || undefined },
                    request.version,
                  ),
                'Completion acknowledged.',
              )
            "
            >Confirm completion</VBtn
          ><VBtn
            class="ms-2"
            variant="outlined"
            :loading="busy"
            @click="
              run(
                () => requestsApi.createIssue(request.id, { note: completionNote }, request.version),
                'Issue reported.',
              )
            "
            >Report an issue</VBtn
          >
        </div>
        <VAlert v-if="request.completion?.defectsWindowEndsAt" variant="tonal" color="warning" class="mb-4"
          >Report a problem by {{ new Date(request.completion.defectsWindowEndsAt).toLocaleDateString() }}.</VAlert
        >
        <div v-if="can('issue.raise')" class="mb-4">
          <VTextarea v-model="issueNote" label="Describe the problem" /><VBtn
            :disabled="!issueNote.trim()"
            :loading="busy"
            @click="
              run(() => requestsApi.createIssue(request.id, { note: issueNote }, request.version), 'Issue reported.')
            "
            >Report problem</VBtn
          >
        </div>
        <VList v-if="request.issues?.length"
          ><VListItem
            v-for="item in request.issues"
            :key="item.id"
            :title="`${item.status.replaceAll('_', ' ')} · ${item.id}`"
            :subtitle="item.note"
            ><template #append
              ><div class="d-flex ga-2">
                <VBtn
                  v-if="can('issue.accept')"
                  size="small"
                  @click="
                    run(
                      () => requestsApi.acceptIssue(request.id, item.id, undefined, request.version),
                      'Rework accepted.',
                    )
                  "
                  >Accept rework</VBtn
                ><VBtn
                  v-if="can('issue.resolve')"
                  size="small"
                  @click="
                    run(
                      () =>
                        requestsApi.resolveIssue(
                          request.id,
                          item.id,
                          { outcome: 'no_rework', note: completionNote, requireRework: false },
                          request.version,
                        ),
                      'Issue resolved.',
                    )
                  "
                  >Resolve</VBtn
                ><VBtn
                  v-if="can('issue.escalate')"
                  size="small"
                  variant="tonal"
                  @click="
                    run(
                      () =>
                        requestsApi.escalateIssue(
                          request.id,
                          item.id,
                          completionNote || 'Escalated for review.',
                          request.version,
                        ),
                      'Issue escalated.',
                    )
                  "
                  >Escalate</VBtn
                >
              </div></template
            ></VListItem
          ></VList
        >
        <VTextField
          v-if="can('request.close')"
          v-model="completionNote"
          label="Early close reason, if required"
          class="mt-4"
        /><VBtn
          v-if="can('request.close')"
          :loading="busy"
          @click="
            run(() => requestsApi.close(request.id, completionNote || undefined, request.version), 'Request closed.')
          "
          >Close request</VBtn
        >
        <VAlert v-if="can('completion.confirmOnBehalf')" variant="tonal" class="mt-4"
          ><VTextField v-model="completionNote" label="Reason for confirming on behalf" /><VBtn
            :disabled="!completionNote.trim()"
            @click="
              run(
                () => requestsApi.confirmCompletionOnBehalf(request.id, completionNote, request.version),
                'Completion confirmed on behalf.',
              )
            "
            >Confirm on behalf</VBtn
          ></VAlert
        >
      </section>

      <section v-else-if="activeTab === 'cancellation'">
        <VAlert v-if="request.overlays?.cancellation" type="warning" variant="tonal" class="mb-4"
          >Cancellation status: {{ request.overlays.cancellation }}. Work is paused while staff review the
          request.</VAlert
        >
        <VSelect
          v-if="can('cancellation.request') && !can('request.cancel')"
          v-model="cancellationReasonCode"
          :items="[
            'customer_changed_mind',
            'quote_declined',
            'no_response',
            'payment_lapsed',
            'no_provider',
            'provider_no_show',
            'provider_suspended',
            'customer_suspended',
            'scope_dispute',
            'duplicate',
            'other',
          ]"
          label="Cancellation reason code"
        />
        <VTextField v-model="cancellationNote" label="Cancellation reason" />
        <VBtn
          v-if="can('cancellation.request') || can('request.cancel')"
          color="error"
          variant="tonal"
          :disabled="!cancellationNote.trim()"
          :loading="busy"
          @click="
            run(() => submitCancellation(), can('request.cancel') ? 'Request cancelled.' : 'Cancellation request sent.')
          "
          >{{ can("request.cancel") ? "Cancel request" : "Request cancellation" }}</VBtn
        >
        <VBtn
          v-if="can('cancellation.withdraw') && pendingCancellation"
          class="ms-2"
          variant="outlined"
          :loading="busy"
          @click="
            run(
              () =>
                requestsApi.withdrawCancellation(
                  request.id,
                  pendingCancellation!.id,
                  cancellationNote || undefined,
                  request.version,
                ),
              'Cancellation request withdrawn.',
            )
          "
          >Withdraw request</VBtn
        >
        <VList v-if="request.cancellations?.length" class="mt-4"
          ><VListItem
            v-for="item in request.cancellations"
            :key="item.id"
            :title="`${item.status} · ${item.reasonCode || 'Reason pending'}`"
            :subtitle="item.note ?? undefined"
            ><template #append
              ><div v-if="can('cancellation.decide') && item.status === 'pending'" class="d-flex ga-2">
                <VBtn
                  size="small"
                  @click="
                    run(
                      () =>
                        requestsApi.decideCancellation(
                          request.id,
                          { approve: true, note: cancellationNote || undefined },
                          request.version,
                        ),
                      'Cancellation approved.',
                    )
                  "
                  >Approve</VBtn
                ><VBtn
                  size="small"
                  color="error"
                  variant="tonal"
                  :disabled="!cancellationNote.trim()"
                  @click="
                    run(
                      () =>
                        requestsApi.decideCancellation(
                          request.id,
                          { approve: false, note: cancellationNote },
                          request.version,
                        ),
                      'Cancellation declined.',
                    )
                  "
                  >Decline</VBtn
                >
              </div></template
            ></VListItem
          ></VList
        >
      </section>

      <section v-else-if="activeTab === 'activity'">
        <VList v-if="activity?.items.length"
          ><VListItem
            v-for="item in activity.items"
            :key="item.id"
            :title="item.action"
            :subtitle="`${item.actorType.replaceAll('_', ' ')} · ${new Date(item.at).toLocaleString()}`"
        /></VList>
        <p v-else class="text-medium-emphasis">No activity is available to display.</p>
      </section>

      <section v-else>
        <VSelect
          v-if="role === 'admin'"
          v-model="channel"
          :items="messageChannels.map(({ title, value }) => ({ title, value }))"
          label="Conversation"
        />
        <VList v-if="messages.length" class="mb-4"
          ><VListItem
            v-for="message in messages"
            :key="message.id"
            :title="message.author.label"
            :subtitle="`${message.text} · ${new Date(message.createdAt).toLocaleString()}`"
            ><template #append
              ><VBtn
                v-for="file in message.attachments"
                :key="file.id"
                size="small"
                variant="text"
                @click="openFile(file.id)"
                >{{ file.name }}</VBtn
              ></template
            ></VListItem
          ></VList
        >
        <VTextarea v-if="can('message.send')" v-model="messageText" label="Message" rows="3" />
        <VFileInput
          v-if="can('message.send')"
          v-model="messageFiles"
          label="Attach files"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.mp4"
        />
        <VBtn v-if="can('message.send')" :disabled="!messageText.trim()" :loading="busy" @click="sendMessage"
          >Send message</VBtn
        >
      </section>
    </VCardText>
  </VCard>
</template>
