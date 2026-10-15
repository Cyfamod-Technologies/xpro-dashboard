<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { ServiceRequest } from "@/features/operations/types"
import { isFinished, money, statusLabelFor, when } from "@/features/operations/types"
import { currentAssignment, currentSchedule, visibleAssignments, visibleDetails } from "@/features/operations/workflow"
import { activeStaffWith } from "@/features/operations/staff"
import { modeLabels, offerExpiry } from "@/features/operations/dispatch"
import DispatchPanel from "@/features/operations/DispatchPanel.vue"
import Attachments from "@/features/operations/Attachments.vue"
import QuotePanel from "@/features/operations/QuotePanel.vue"
import SchedulePanel from "@/features/operations/SchedulePanel.vue"
import ProgressPanel from "@/features/operations/ProgressPanel.vue"
import ThreadPanel from "@/features/operations/ThreadPanel.vue"

const props = defineProps<{ request: ServiceRequest; initialPanel?: string }>()
const ops = useOperationsStore()
const panel = ref(props.initialPanel ?? "overview")
const note = ref("")
const now = useNow({ interval: 30000 })
const cancelDialog = ref(false)
const rejectDialog = ref(false)
const rejectNote = ref("")
const reassignTo = ref("")
const reassignNote = ref("")
const assignment = computed(() => currentAssignment(props.request))
const role = computed(() => ops.actor?.role)
const reviewNote = ref("")
const rejecting = ref<"" | "assignment" | "cancellation">("")
const assignments = computed(() => (ops.actor ? visibleAssignments(props.request, ops.actor) : []))
const details = computed(() => (ops.actor ? visibleDetails(props.request, ops.actor) : {}))
const shownAssignment = computed(() =>
  role.value === "customer" && assignment.value?.status === "pending_approval"
    ? undefined
    : assignments.value.find(item => item.id === assignment.value?.id),
)
const assignmentLabel = (status: string) =>
  role.value === "provider" && status === "pending_approval"
    ? "Awaiting XPro confirmation"
    : status.replaceAll("_", " ")
const pendingAssignment = computed(() =>
  assignment.value?.status === "pending_approval" ? assignment.value : undefined,
)
const pendingCancellation = computed(() =>
  props.request.cancellationRequest?.review.state === "pending" ? props.request.cancellationRequest : undefined,
)
const rejectedCancellation = computed(() =>
  props.request.cancellationRequest?.review.state === "rejected" ? props.request.cancellationRequest : undefined,
)
const addressShared = computed(
  () => role.value !== "provider" || currentSchedule(props.request)?.status === "confirmed",
)
const providerName = (id: string) => ops.state.providers.find(item => item.id === id)?.name ?? "Provider"
const active = computed(() => !isFinished(props.request.status) && props.request.status !== "acknowledged")
const ownerName = computed(() =>
  props.request.staffOwnerId ? (ops.staffById(props.request.staffOwnerId)?.name ?? "Former staff member") : "Unclaimed",
)
const owners = computed(() =>
  activeStaffWith(ops.state, "request.claim")
    .filter(item => item.id !== props.request.staffOwnerId)
    .map(item => ({ title: item.name, value: item.id })),
)
const canNote = computed(() => ops.can("request.review") || ops.can("request.flag"))
const offerClock = computed(() =>
  assignment.value?.status === "offered" ? offerExpiry(assignment.value.expiresAt, now.value.getTime()) : null,
)

const reassign = async () => {
  if (
    await ops.run({
      type: "request.reassign",
      requestId: props.request.id,
      staffId: reassignTo.value,
      note: reassignNote.value,
    })
  ) {
    reassignTo.value = ""
    reassignNote.value = ""
  }
}

const decideAssignment = async (approve: boolean) => {
  if (
    pendingAssignment.value &&
    (await ops.run({
      type: "assignment.review",
      requestId: props.request.id,
      assignmentId: pendingAssignment.value.id,
      approve,
      note: approve ? "" : reviewNote.value,
    }))
  ) {
    reviewNote.value = ""
    rejecting.value = ""
  }
}

const decideCancellation = async (approve: boolean) => {
  if (
    await ops.run({
      type: "cancellation.review",
      requestId: props.request.id,
      approve,
      note: approve ? "" : reviewNote.value,
    })
  ) {
    reviewNote.value = ""
    rejecting.value = ""
  }
}

const cancel = async () => {
  if (await ops.run({ type: "request.cancel", requestId: props.request.id, note: note.value }))
    cancelDialog.value = false
}

const reject = async () => {
  if (await ops.run({ type: "request.reject", requestId: props.request.id, note: rejectNote.value }))
    rejectDialog.value = false
}
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <div class="d-flex justify-space-between align-start flex-wrap gap-3">
        <div>
          <div class="text-body-2 text-medium-emphasis mb-2">{{ request.id }} · {{ request.service }}</div>
          <h2 class="text-h4 mb-2">
            {{ request.title }}
          </h2>
          <p class="text-medium-emphasis mb-0">{{ request.city }} · Submitted {{ when(request.createdAt) }}</p>
        </div>
        <VChip color="primary" variant="tonal">
          {{ statusLabelFor(request.status, role ?? "customer") }}
        </VChip>
      </div>
      <VAlert v-if="role === 'customer' && request.status === 'rejected'" variant="tonal" color="warning" class="mt-4">
        XPro was not able to accept this request. The reason is in your messages.
      </VAlert>
    </VCardText>
  </VCard>
  <VTabs v-model="panel" show-arrows class="mb-5">
    <VTab value="overview"> Brief & dispatch </VTab><VTab value="quotes"> Quotes </VTab
    ><VTab value="schedule"> Schedule </VTab><VTab value="progress"> Progress & completion </VTab
    ><VTab value="messages"> Messages </VTab>
  </VTabs>
  <div v-if="panel === 'overview'">
    <VRow>
      <VCol cols="12" md="7">
        <VCard>
          <VCardText>
            <h3 class="text-h5 mb-4">Request brief</h3>
            <p class="text-body-1 brief-copy">
              {{ request.description }}
            </p>
            <dl class="details">
              <dt>Site address</dt>
              <dd v-if="addressShared">
                {{ request.address }}
              </dd>
              <dd v-else>
                {{ request.city }}<br /><span class="text-medium-emphasis"
                  >Full address shared once the schedule is confirmed.</span
                >
              </dd>
              <dt>Contact</dt>
              <dd>{{ role === "provider" ? "XPro customer" : `${request.customer} · ${request.phone}` }}</dd>
              <template v-if="role !== 'provider'">
                <dt>Indicative budget</dt>
                <dd>{{ request.budget ? money(request.budget) : "To be confirmed" }}</dd> </template
              ><template v-if="role === 'admin'">
                <dt>Preferred contact</dt>
                <dd>{{ request.contactMethod ?? "phone" }}</dd>
              </template>
              <dt>Preferred start</dt>
              <dd>{{ request.startDate || "Flexible" }}</dd>
              <template v-for="(value, key) in details" :key="key">
                <dt>{{ String(key).replace(/([A-Z])/g, " $1") }}</dt>
                <dd>{{ value }}</dd>
              </template>
            </dl>
            <Attachments :files="request.attachments" />
          </VCardText>
        </VCard> </VCol
      ><VCol cols="12" md="5">
        <VCard class="mb-5">
          <VCardText>
            <h3 class="text-h5 mb-4">Provider assignment</h3>
            <template v-if="shownAssignment">
              <p>{{ providerName(shownAssignment.providerId) }} · {{ assignmentLabel(shownAssignment.status) }}</p>
              <p v-if="shownAssignment.note" class="text-body-2">
                {{ shownAssignment.note }}
              </p>
            </template>
            <p v-else class="text-medium-emphasis">XPro is reviewing the brief and coordinating a provider.</p>
            <VAlert v-if="role === 'provider' && pendingAssignment" variant="tonal" color="info" class="mb-4">
              You accepted this offer. Waiting for XPro to confirm.
            </VAlert>
            <div v-if="role === 'admin' && pendingAssignment" class="approval-box mb-4">
              <h4 class="text-h6 mb-2">Provider accepted — confirm assignment</h4>
              <p class="mb-1">
                {{ providerName(pendingAssignment.providerId) }}
              </p>
              <p class="text-body-2 text-medium-emphasis">
                {{ pendingAssignment.response || "No message from the provider." }}
              </p>
              <template v-if="ops.can('dispatch.manage')">
                <VTextarea
                  v-if="rejecting === 'assignment'"
                  v-model="reviewNote"
                  label="Reason for not confirming (shared with the provider)"
                  rows="2"
                />
                <div class="d-flex flex-wrap gap-2">
                  <VBtn
                    v-if="rejecting !== 'assignment'"
                    size="small"
                    :disabled="ops.busy"
                    @click="decideAssignment(true)"
                  >
                    Approve </VBtn
                  ><VBtn
                    v-if="rejecting !== 'assignment'"
                    size="small"
                    variant="outlined"
                    color="warning"
                    :disabled="ops.busy"
                    @click="
                      () => {
                        rejecting = 'assignment'
                        reviewNote = ''
                      }
                    "
                  >
                    Reject </VBtn
                  ><template v-else>
                    <VBtn size="small" color="warning" :disabled="ops.busy" @click="decideAssignment(false)">
                      Confirm rejection </VBtn
                    ><VBtn size="small" variant="text" @click="rejecting = ''"> Cancel </VBtn>
                  </template>
                </div>
              </template>
            </div>
            <div v-if="role === 'admin' && pendingCancellation" class="approval-box mb-4">
              <h4 class="text-h6 mb-2">Customer requested cancellation</h4>
              <p class="text-body-2 text-medium-emphasis">
                {{ pendingCancellation.note }}
              </p>
              <template v-if="ops.can('request.cancel')">
                <VTextarea
                  v-if="rejecting === 'cancellation'"
                  v-model="reviewNote"
                  label="Reason for declining (shared with the customer)"
                  rows="2"
                />
                <div class="d-flex flex-wrap gap-2">
                  <VBtn
                    v-if="rejecting !== 'cancellation'"
                    size="small"
                    color="error"
                    :disabled="ops.busy"
                    @click="decideCancellation(true)"
                  >
                    Approve </VBtn
                  ><VBtn
                    v-if="rejecting !== 'cancellation'"
                    size="small"
                    variant="outlined"
                    color="warning"
                    :disabled="ops.busy"
                    @click="
                      () => {
                        rejecting = 'cancellation'
                        reviewNote = ''
                      }
                    "
                  >
                    Reject </VBtn
                  ><template v-else>
                    <VBtn size="small" color="warning" :disabled="ops.busy" @click="decideCancellation(false)">
                      Confirm rejection </VBtn
                    ><VBtn size="small" variant="text" @click="rejecting = ''"> Cancel </VBtn>
                  </template>
                </div>
              </template>
            </div>
            <template v-if="ops.actor?.role === 'admin' && active">
              <div class="owner-row mb-4">
                <div class="d-flex align-center flex-wrap gap-2">
                  <span class="text-body-2 text-medium-emphasis">Owner</span
                  ><VChip size="small" variant="tonal" :color="request.staffOwnerId ? 'primary' : 'warning'">
                    {{ ownerName }} </VChip
                  ><VBtn
                    v-if="!request.staffOwnerId && ops.can('request.claim')"
                    size="small"
                    variant="outlined"
                    :disabled="ops.busy"
                    @click="ops.run({ type: 'request.claim', requestId: request.id })"
                  >
                    Claim request
                  </VBtn>
                </div>
                <div v-if="ops.can('request.reassign')" class="mt-3">
                  <VSelect v-model="reassignTo" :items="owners" label="Reassign owner" density="compact" /><VTextarea
                    v-model="reassignNote"
                    label="Reason for reassigning"
                    rows="2"
                  /><VBtn size="small" variant="outlined" :disabled="!reassignTo || ops.busy" @click="reassign">
                    Reassign owner
                  </VBtn>
                </div>
              </div>
              <VTextarea v-if="canNote" v-model="note" label="Review / flag note" rows="2" />
              <div
                v-if="['submitted', 'under_review'].includes(request.status) && ops.can('request.review')"
                class="d-flex flex-wrap gap-2 mt-4"
              >
                <VBtn
                  variant="outlined"
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'request.review', requestId: request.id, clarify: false, note })"
                >
                  Approve intake </VBtn
                ><VBtn
                  variant="text"
                  :disabled="ops.busy"
                  @click="ops.run({ type: 'request.review', requestId: request.id, clarify: true, note })"
                >
                  Ask for clarification </VBtn
                ><VBtn
                  variant="text"
                  color="error"
                  :disabled="ops.busy"
                  @click="
                    () => {
                      rejectNote = ''
                      rejectDialog = true
                    }
                  "
                >
                  Reject request
                </VBtn>
              </div>
              <p
                v-if="
                  ['submitted', 'under_review'].includes(request.status) &&
                  ops.can('request.review') &&
                  request.dispatch.mode === 'auto' &&
                  !assignment &&
                  !request.dispatch.needsManual
                "
                class="text-body-2 text-medium-emphasis mt-2"
              >
                Approving the intake sends the first offer automatically.
              </p>
              <div class="mt-4">
                <VBtn
                  v-if="ops.can('request.flag')"
                  size="small"
                  variant="text"
                  color="warning"
                  @click="ops.run({ type: 'request.flag', requestId: request.id, note })"
                >
                  Flag for attention </VBtn
                ><VBtn
                  v-if="request.flag && ops.can('request.flag')"
                  size="small"
                  variant="text"
                  @click="ops.run({ type: 'request.flag', requestId: request.id, note: '' })"
                >
                  Clear flag
                </VBtn>
                <p v-if="request.flag" class="text-body-2 mt-2">
                  {{ request.flag }}
                </p>
              </div>
            </template>
            <template v-if="ops.actor?.role === 'provider' && assignment?.status === 'offered'">
              <VAlert v-if="offerClock?.expired" variant="tonal" color="warning" class="mb-4">
                This offer has expired. XPro will offer the job to another provider.
              </VAlert>
              <p v-else-if="offerClock?.left" class="text-body-2 mb-4">
                Offer expires in {{ offerClock.left }} ({{ when(assignment.expiresAt) }} WAT). Reply before then.
              </p>
              <VTextarea
                v-model="note"
                label="Response / reason for declining"
                rows="2"
                :disabled="offerClock?.expired"
              />
              <div class="d-flex flex-wrap gap-2">
                <VBtn
                  :disabled="ops.busy || offerClock?.expired"
                  @click="
                    ops.run({
                      type: 'assignment.respond',
                      requestId: request.id,
                      assignmentId: assignment.id,
                      accept: true,
                      note,
                    })
                  "
                >
                  Accept job </VBtn
                ><VBtn
                  variant="outlined"
                  color="warning"
                  :disabled="ops.busy || offerClock?.expired"
                  @click="
                    ops.run({
                      type: 'assignment.respond',
                      requestId: request.id,
                      assignmentId: assignment.id,
                      accept: false,
                      note,
                    })
                  "
                >
                  Decline job
                </VBtn>
              </div>
            </template>
          </VCardText>
        </VCard>
        <VCard v-if="assignments.length && ops.actor?.role !== 'customer'">
          <VCardText>
            <h3 class="text-h6 mb-3">Assignment history</h3>
            <p v-for="item in assignments" :key="item.id" class="text-body-2">
              {{ providerName(item.providerId) }} · {{ assignmentLabel(item.status)
              }}<template v-if="role === 'admin'">
                · {{ modeLabels[item.source] }}, attempt {{ item.attempt }} </template
              ><br />{{ item.response || item.note }}
            </p>
          </VCardText>
        </VCard>
        <VAlert v-if="role === 'customer' && pendingCancellation" variant="tonal" color="warning" class="mt-5">
          Cancellation requested — awaiting XPro
        </VAlert>
        <VAlert
          v-else-if="role === 'customer' && rejectedCancellation && active"
          variant="tonal"
          color="info"
          class="mt-5"
        >
          XPro did not approve your cancellation request.{{
            rejectedCancellation.review.note ? ` ${rejectedCancellation.review.note}` : ""
          }}
        </VAlert>
        <VBtn
          v-if="
            active &&
            !(role === 'customer' && pendingCancellation) &&
            (role === 'customer' || ops.can('request.cancel'))
          "
          variant="text"
          color="error"
          class="mt-5"
          @click="
            () => {
              note = ''
              cancelDialog = true
            }
          "
        >
          {{ role === "customer" ? "Request cancellation" : "Cancel request" }}
        </VBtn> </VCol
      ><VCol v-if="role === 'admin' && active" cols="12">
        <DispatchPanel :request="request" />
      </VCol>
    </VRow>
  </div>
  <QuotePanel v-else-if="panel === 'quotes'" :request="request" />
  <SchedulePanel v-else-if="panel === 'schedule'" :request="request" />
  <ProgressPanel v-else-if="panel === 'progress'" :request="request" />
  <ThreadPanel v-else-if="panel === 'messages'" :request="request" />
  <VDialog v-model="rejectDialog" max-width="480">
    <VCard>
      <VCardText>
        <h3 class="text-h5 mb-3">Reject this request?</h3>
        <p>
          The customer will be told this request was not accepted, and your reason is shared with them. Any alerted or
          offered provider is released.
        </p>
        <VTextarea v-model="rejectNote" label="Reason for rejecting (shared with the customer)" /><VAlert
          v-if="ops.error"
          variant="tonal"
          color="error"
          class="mb-4"
        >
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="rejectDialog = false"> Keep request </VBtn
          ><VBtn color="error" :loading="ops.busy" @click="reject"> Reject request </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
  <VDialog v-model="cancelDialog" max-width="480">
    <VCard>
      <VCardText>
        <h3 class="text-h5 mb-3">
          {{ role === "customer" ? "Request cancellation?" : "Cancel this request?" }}
        </h3>
        <p>
          {{
            role === "customer"
              ? "XPro will review your request before anything is cancelled."
              : "This will withdraw the current assignment and cancel its schedules."
          }}
        </p>
        <VTextarea v-model="note" label="Reason for cancellation" /><VAlert
          v-if="ops.error"
          variant="tonal"
          color="error"
          class="mb-4"
        >
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="cancelDialog = false"> Keep request </VBtn
          ><VBtn color="error" :loading="ops.busy" @click="cancel">
            {{ role === "customer" ? "Send request" : "Confirm cancellation" }}
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.brief-copy {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.approval-box {
  border: 1px solid rgb(var(--v-theme-warning));
  border-radius: 8px;
  background: rgba(var(--v-theme-warning), 0.08);
  padding: 1rem;
}
.owner-row {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-block-end: 1rem;
}
.details dt {
  font-size: 0.8rem;
  opacity: 0.7;
  text-transform: capitalize;
  margin-block-start: 1rem;
}
.details dd {
  margin-block-start: 0.25rem;
  overflow-wrap: anywhere;
}
</style>
