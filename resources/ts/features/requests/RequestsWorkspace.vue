<script setup lang="ts">
import type {
  AssignmentView,
  CustomerRequestLimitView,
  QuoteItemView,
  QuoteLineView,
  QuoteView,
  RankingRunView,
  RequestSummary,
  RequestView,
} from "@/features/requests/api-types"
import { REQUEST_STAGES } from "@/features/requests/api-types"
import type { GroupEntry } from "@/features/requests/request-groups"
import { groupRequests } from "@/features/requests/request-groups"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { providersApi } from "@/services/providers-api"
import { useAuthStore } from "@/stores/auth"
import CancelAllDialog from "@/features/requests/CancelAllDialog.vue"
import CustomerRequestLimit from "@/features/requests/CustomerRequestLimit.vue"
import RequestGroupPanel from "@/features/requests/RequestGroupPanel.vue"
import RequestGroupSection from "@/features/requests/RequestGroupSection.vue"
import RequestLifecycle from "@/features/requests/RequestLifecycle.vue"
import RequestListCard from "@/features/requests/RequestListCard.vue"
import ReviewAllDialog from "@/features/requests/ReviewAllDialog.vue"

const props = defineProps<{ section: string }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const summaries = ref<RequestSummary[]>([])
const request = ref<RequestView>()
// Only `GET /requests/:id` carries `customerRequestLimit`; command responses do not. Keep the last fetched value
// here, and replace it only from that fetch or from the limit endpoint's own response.
const customerLimit = ref<CustomerRequestLimitView>()
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const notice = ref("")
const query = ref("")
const stageFilter = ref("")
const nextActorOnly = ref(false)
const modeNote = ref("")
const dispatchMode = ref<"auto" | "manual">("auto")
const run = ref<RankingRunView>()
const providerId = ref("")
const offerNote = ref("")
const overrideNote = ref("")
const actionNote = ref("")
const crewSize = ref<number | null>(null)
const shareDescription = ref(false)
const shareAddress = ref(false)
const shareNote = ref("")
const customerQuoteNote = ref("")
const quoteItems = ref<QuoteItemView[]>([{ description: "", quantity: 1, unitPrice: 0 }])
const quoteNote = ref("")
const payoutAmount = ref<number | null>(null)
const payment = ref<Awaited<ReturnType<typeof requestsApi.payments>>>()
const checkoutBusy = ref(false)
const paymentNote = ref("")
const offlineAmount = ref<number | null>(null)
const offlineChannel = ref("bank_transfer")
const offlineReference = ref("")
const proofFileId = ref("")
const proofFile = ref<File | null>(null)
const intakeQuestion = ref("")
const offerBrief = ref("")
const rejectionReason = ref("")
const contactCheck = ref(false)
const paymentPoll = ref<ReturnType<typeof setInterval>>()
const expiryTick = ref(Date.now())
const expiryTimer = ref<ReturnType<typeof setInterval>>()
const sectionTitle = computed(
  () =>
    ({ dispatch: "Dispatch", quotes: "Quotes", payments: "Payments", payouts: "Earnings" })[props.section] ??
    "Requests",
)
// Requests made together (Spec 04 §4.1a) are listed under their project; the rest stay single rows.
const entries = computed(() => groupRequests(summaries.value))
const canCancelAll = computed(() => auth.user?.role === "customer")
const canReviewAll = computed(
  () => props.section === "requests" && auth.user?.role === "admin" && auth.user.scopes.includes("request.review"),
)
const bulkDialog = ref<{ kind: "cancel" | "review"; groupId: string; title: string }>()
const cancelAllOpen = computed({
  get: () => bulkDialog.value?.kind === "cancel",
  set: open => {
    if (!open) bulkDialog.value = undefined
  },
})
const reviewAllOpen = computed({
  get: () => bulkDialog.value?.kind === "review",
  set: open => {
    if (!open) bulkDialog.value = undefined
  },
})
const openBulk = (kind: "cancel" | "review", entry: GroupEntry<RequestSummary>) => {
  bulkDialog.value = { kind, groupId: entry.groupId, title: entry.title }
}
const selectedId = computed(() => (typeof route.query.request === "string" ? route.query.request : undefined))
const currentAssignments = computed<AssignmentView[]>(() => {
  const value = request.value?.assignment

  return Array.isArray(value) ? value : value ? [value] : []
})
const currentQuote = computed<QuoteView | undefined>(() => request.value?.quote ?? undefined)
// Staff and customers get `items`; the assigned provider gets `scope` (no prices); amounts can be hidden for staff.
const quoteLines = computed<QuoteLineView[]>(() => currentQuote.value?.items ?? currentQuote.value?.scope ?? [])
const stageItems = REQUEST_STAGES.map(value => ({ title: value.replaceAll("_", " "), value }))
// The server needs an override reason for an excluded provider or anyone other than the top suggestion.
const needsOverride = computed(() => {
  if (!run.value || !providerId.value) return false

  return (
    run.value.excluded.some(item => item.providerId === providerId.value) ||
    run.value.eligible[0]?.providerId !== providerId.value
  )
})
const quoteRevision = (quote: QuoteView) => {
  if (quote.revision === undefined) throw new Error("This quote cannot be changed from your account.")

  return quote.revision
}
const can = (action: string) => request.value?.allowedActions.includes(action) ?? false
const money = (value?: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(
        value / 100,
      )
const expiresIn = (value?: string) => {
  if (!value) return ""
  const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - expiryTick.value) / 60_000))

  return minutes < 60 ? `expires in ${minutes}m` : `expires in ${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
const fail = (value: unknown) => {
  if (value instanceof RequestsApiError && value.code === "VERSION_CONFLICT") {
    error.value = "This request has changed. Refresh and retry."

    return
  }
  error.value = value instanceof Error ? value.message : "The request could not be completed."
}

async function loadList() {
  loading.value = true
  error.value = ""
  try {
    const result = await requestsApi.list({
      q: query.value || undefined,
      stage: stageFilter.value || undefined,
      nextActor: nextActorOnly.value ? "me" : undefined,
      page: 1,
      itemsPerPage: 50,
    })
    summaries.value = result.items
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadDetail(id = selectedId.value) {
  if (paymentPoll.value) {
    clearInterval(paymentPoll.value)
    paymentPoll.value = undefined
  }
  if (!id) {
    request.value = undefined
    customerLimit.value = undefined
    payment.value = undefined

    return
  }
  loading.value = true
  error.value = ""
  try {
    request.value = await requestsApi.get(id)
    if (request.value.customerRequestLimit) customerLimit.value = request.value.customerRequestLimit
    else if (customerLimit.value && request.value.ownerId && customerLimit.value.userId !== request.value.ownerId)
      customerLimit.value = undefined
    dispatchMode.value = request.value.dispatch?.mode ?? "auto"
    if (request.value.quote) {
      const lines = request.value.quote.items ?? []

      quoteItems.value = lines.length
        ? lines.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? 0,
          }))
        : [{ description: "", quantity: 1, unitPrice: 0 }]
      quoteNote.value = request.value.quote.note ?? ""
      payoutAmount.value = request.value.quote.payoutAmount ?? request.value.quote.payoutSuggestion ?? null
    }
    if (props.section === "payments") {
      payment.value = await requestsApi.payments(id)
      if (payment.value.payments.some(row => row.status === "pending" || row.status === "recorded"))
        startPaymentPolling(id)
    }
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

function startPaymentPolling(id: string) {
  if (paymentPoll.value) clearInterval(paymentPoll.value)
  paymentPoll.value = setInterval(async () => {
    try {
      payment.value = await requestsApi.payments(id)
      if (payment.value.payments.some(row => row.status === "paid")) {
        clearInterval(paymentPoll.value)
        paymentPoll.value = undefined
        await loadDetail(id)
      }
    } catch (cause) {
      fail(cause)
    }
  }, 5000)
}

async function uploadPaymentProof() {
  if (!proofFile.value) return
  saving.value = true
  try {
    const uploaded = await providersApi.upload(proofFile.value, "payment_proof")
    proofFileId.value = uploaded.id
    notice.value = "Payment proof uploaded."
  } catch (cause) {
    fail(cause)
  } finally {
    saving.value = false
  }
}

function select(id?: string) {
  router.push({ path: route.path, query: id ? { request: id } : {} })
}
const backToList = () => select()
const refreshCurrent = () => loadDetail()

async function openFile(id: string) {
  try {
    const { url } = await requestsApi.fileLink(id)
    window.location.assign(url)
  } catch (cause) {
    fail(cause)
  }
}

async function perform(action: () => Promise<unknown>, success: string, refreshPayments = false) {
  if (!request.value) return
  saving.value = true
  error.value = ""
  notice.value = ""
  try {
    await action()
    await loadDetail()
    if (refreshPayments && selectedId.value) payment.value = await requestsApi.payments(selectedId.value)
    notice.value = success
  } catch (cause) {
    fail(cause)
    if (cause instanceof RequestsApiError && cause.code === "VERSION_CONFLICT") await loadDetail()
  } finally {
    saving.value = false
  }
}

async function refreshRun() {
  if (!request.value) return
  saving.value = true
  error.value = ""
  try {
    run.value = await requestsApi.rankingRun(request.value.id)
  } catch (cause) {
    fail(cause)
  } finally {
    saving.value = false
  }
}

async function createOrUpdateQuote() {
  if (!request.value) return
  const items = quoteItems.value.filter(item => item.description.trim() && item.quantity > 0 && item.unitPrice > 0)
  if (!items.length) {
    error.value = "Add at least one priced quote item."

    return
  }
  if (currentQuote.value) {
    await perform(
      () =>
        requestsApi.updateQuote(
          request.value!.id,
          currentQuote.value!.id,
          { revision: quoteRevision(currentQuote.value!), items, note: quoteNote.value || undefined },
          request.value!.version,
        ),
      "Draft saved.",
    )

    return
  }
  await perform(
    () =>
      requestsApi.createQuote(request.value!.id, { items, note: quoteNote.value || undefined }, request.value!.version),
    "Draft created.",
  )
}

async function beginCheckout() {
  if (!request.value) return
  checkoutBusy.value = true
  error.value = ""
  try {
    const result = await requestsApi.initiatePayment(request.value.id)
    startPaymentPolling(request.value.id)
    window.location.assign(result.authorizationUrl)
  } catch (cause) {
    fail(cause)
    checkoutBusy.value = false
  }
}

onMounted(() => {
  expiryTimer.value = setInterval(() => {
    expiryTick.value = Date.now()
  }, 30_000)
})
onBeforeUnmount(() => {
  if (paymentPoll.value) clearInterval(paymentPoll.value)
  if (expiryTimer.value) clearInterval(expiryTimer.value)
})

watch(
  () => props.section,
  () => {
    if (selectedId.value) loadDetail()
    else loadList()
  },
)
watch(selectedId, id => (id ? loadDetail(id) : loadList()), { immediate: true })
watch(query, () => {
  if (!selectedId.value) loadList()
})
watch([stageFilter, nextActorOnly], () => {
  if (!selectedId.value) loadList()
})
</script>

<template>
  <div>
    <template v-if="!request">
      <VCard class="mb-5"
        ><VCardText class="d-flex flex-wrap align-center justify-space-between ga-4">
          <div>
            <h2 class="text-h5">{{ sectionTitle }}</h2>
            <p class="text-medium-emphasis mb-0">Live requests from the XPro API.</p>
          </div>
          <div class="d-flex flex-wrap align-center ga-3">
            <VTextField
              v-model="query"
              label="Search requests"
              prepend-inner-icon="tabler-search"
              hide-details
              clearable
              class="search-field"
            /><VSelect
              v-model="stageFilter"
              :items="stageItems"
              label="Stage"
              clearable
              hide-details
              class="stage-filter"
            /><VCheckbox v-model="nextActorOnly" label="Waiting on me" hide-details />
          </div> </VCardText
      ></VCard>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
      <VProgressLinear v-if="loading" indeterminate class="mb-4" />
      <VRow v-else>
        <template v-for="entry in entries" :key="entry.kind === 'group' ? entry.groupId : entry.item.id">
          <VCol v-if="entry.kind === 'group'" cols="12">
            <RequestGroupSection
              :entry="entry"
              :section="props.section"
              :can-cancel-all="canCancelAll"
              :can-review-all="canReviewAll"
              @open="select"
              @cancel-all="openBulk('cancel', entry)"
              @review-all="openBulk('review', entry)"
            />
          </VCol>
          <VCol v-else cols="12" md="6">
            <RequestListCard :item="entry.item" :section="props.section" @open="select" />
          </VCol>
        </template>
        <VCol v-if="!summaries.length" cols="12"
          ><VCard><VCardText class="text-center text-medium-emphasis py-10">No requests found.</VCardText></VCard></VCol
        >
      </VRow>
      <CancelAllDialog
        v-if="bulkDialog?.kind === 'cancel'"
        v-model="cancelAllOpen"
        :group-id="bulkDialog.groupId"
        :title="bulkDialog.title"
        @finished="loadList"
      />
      <ReviewAllDialog
        v-if="bulkDialog?.kind === 'review'"
        v-model="reviewAllOpen"
        :group-id="bulkDialog.groupId"
        :title="bulkDialog.title"
        @finished="loadList"
      />
    </template>

    <template v-else>
      <VBtn variant="text" prepend-icon="tabler-arrow-left" class="mb-4" @click="backToList"
        >Back to {{ sectionTitle }}</VBtn
      >
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
      <VAlert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</VAlert>
      <VProgressLinear v-if="loading" indeterminate class="mb-4" />
      <VCard class="mb-5"
        ><VCardText>
          <div class="d-flex justify-space-between flex-wrap ga-3 mb-3">
            <span class="text-medium-emphasis">{{ request.id }} · {{ request.stage }}</span
            ><VChip color="primary" variant="tonal">{{ request.statusLabel ?? request.status }}</VChip>
          </div>
          <h2 class="text-h4 mb-2">{{ request.title || "Service request" }}</h2>
          <p class="text-medium-emphasis mb-3">
            {{ [request.service, request.locationLabel].filter(Boolean).join(" · ") }}
          </p>
          <p v-if="request.servicePath?.length" class="text-body-2 mb-3">
            <span class="text-medium-emphasis">Service:</span>
            {{ request.servicePath.map(step => step.name).join(" › ") }}
          </p>
          <dl v-if="request.answers?.length" class="answers mb-3">
            <template v-for="answer in request.answers" :key="answer.questionId">
              <dt>{{ answer.label }}</dt>
              <dd>{{ answer.display }}</dd>
            </template>
          </dl>
          <p v-if="request.description" class="mb-0">{{ request.description }}</p>
          <div v-if="request.attachments?.length" class="d-flex flex-wrap ga-2 mt-3">
            <VBtn
              v-for="file in request.attachments"
              :key="file.id"
              size="small"
              variant="text"
              @click="openFile(file.id)"
              >{{ file.name }}</VBtn
            >
          </div>
        </VCardText></VCard
      >
      <RequestGroupPanel v-if="request.group" :group="request.group" :siblings="request.siblings ?? []" />
      <CustomerRequestLimit v-if="customerLimit" :limit="customerLimit" @change="customerLimit = $event" />

      <template v-if="props.section === 'dispatch'">
        <VCard class="mb-5"
          ><VCardText>
            <h3 class="text-h5 mb-4">Dispatch controls</h3>
            <div class="d-flex flex-wrap align-center ga-3 mb-4">
              <VSelect
                v-model="dispatchMode"
                :items="[
                  { title: 'Automatic', value: 'auto' },
                  { title: 'Manual', value: 'manual' },
                ]"
                label="Dispatch mode"
                hide-details
                class="mode-field"
              />
              <VTextField v-model="modeNote" label="Reason for mode change" hide-details class="mode-field" />
              <VBtn
                v-if="can('dispatch.setMode')"
                :disabled="!modeNote.trim()"
                :loading="saving"
                @click="
                  perform(
                    () => requestsApi.setDispatchMode(request!.id, dispatchMode, modeNote, request!.version),
                    'Dispatch mode updated.',
                  )
                "
                >Save mode</VBtn
              >
              <VBtn v-if="can('dispatch.runs')" variant="outlined" :loading="saving" @click="refreshRun"
                >Refresh ranked list</VBtn
              >
              <VBtn
                v-if="can('assignment.auto')"
                color="primary"
                :loading="saving"
                @click="
                  perform(
                    () => requestsApi.autoAssign(request!.id, { note: actionNote }, request!.version),
                    'Automatic dispatch started.',
                  )
                "
                >Auto assign</VBtn
              >
            </div>
            <VTextField v-model="actionNote" label="Dispatch note" class="mb-4" />
            <template v-if="run">
              <h4 class="text-subtitle-1 mb-2">Eligible providers</h4>
              <VList v-if="run.eligible.length" lines="two" class="mb-4">
                <VListItem
                  v-for="candidate in run.eligible"
                  :key="candidate.providerId"
                  :title="candidate.providerName"
                  :subtitle="`Score ${candidate.total}`"
                  @click="providerId = candidate.providerId"
                >
                  <template #append
                    ><VBtn
                      v-if="can('assignment.offer')"
                      size="small"
                      :variant="providerId === candidate.providerId ? 'flat' : 'tonal'"
                      @click.stop="providerId = candidate.providerId"
                      >{{ providerId === candidate.providerId ? "Selected" : "Select" }}</VBtn
                    ></template
                  >
                </VListItem>
              </VList>
              <VAlert v-else type="info" variant="tonal" class="mb-4"
                >No eligible providers in this ranking run.</VAlert
              >
              <div v-if="can('assignment.offer')" class="d-flex flex-wrap ga-3 mb-4">
                <VTextField v-model="offerNote" label="Offer note" hide-details />
                <VTextField
                  v-model="overrideNote"
                  :label="needsOverride ? 'Override reason (required for this provider)' : 'Override reason'"
                  hide-details
                />
                <VBtn
                  :disabled="!providerId || (needsOverride && !overrideNote.trim())"
                  :loading="saving"
                  @click="
                    perform(
                      () =>
                        requestsApi.offer(
                          request!.id,
                          {
                            providerId,
                            rankingRunId: run!.runId,
                            note: offerNote || undefined,
                            overrideNote: overrideNote.trim() || undefined,
                          },
                          request!.version,
                        ),
                      'Provider offer sent.',
                    )
                  "
                  >Offer selected provider</VBtn
                >
              </div>
              <h4 v-if="run.excluded.length" class="text-subtitle-1 mt-4">Excluded providers</h4>
              <VList v-if="run.excluded.length"
                ><VListItem
                  v-for="provider in run.excluded"
                  :key="provider.providerId"
                  :title="provider.providerName"
                  :subtitle="`${provider.rule}: ${provider.reason}`"
                  @click="providerId = provider.providerId"
                >
                  <template #append
                    ><VBtn
                      v-if="can('assignment.offer')"
                      size="small"
                      variant="tonal"
                      @click.stop="providerId = provider.providerId"
                      >Select override</VBtn
                    ></template
                  >
                </VListItem></VList
              >
            </template>
          </VCardText></VCard
        >
        <VCard v-if="currentAssignments.length"
          ><VCardText
            ><h3 class="text-h5 mb-3">Assignments</h3>
            <VList
              ><VListItem
                v-for="item in currentAssignments"
                :key="item.id || item.providerId || item.status"
                :title="item.businessName || item.providerName || item.providerId || 'Assignment'"
                :subtitle="`${item.status}${item.expiresAt ? ` · ${expiresIn(item.expiresAt)} (${new Date(item.expiresAt).toLocaleString()})` : ''}${item.response ? ` · ${item.response}` : ''}${item.score ? ` · score ${item.score.total}` : ''}`"
              >
                <template #append
                  ><div class="d-flex ga-2">
                    <VBtn
                      v-if="item.id && can('assignment.respond') && item.status === 'offered'"
                      size="small"
                      color="success"
                      @click="
                        perform(
                          () =>
                            requestsApi.respondAssignment(
                              request!.id,
                              item.id!,
                              { accept: true, crewSize: crewSize || undefined },
                              request!.version,
                            ),
                          'Offer accepted.',
                        )
                      "
                      >Accept</VBtn
                    ><VBtn
                      v-if="item.id && can('assignment.review') && item.status === 'pending_approval'"
                      size="small"
                      color="success"
                      @click="
                        perform(
                          () =>
                            requestsApi.reviewAssignment(
                              request!.id,
                              item.id!,
                              {
                                approve: true,
                                note: actionNote || undefined,
                                overrideNote: overrideNote || undefined,
                                share: {
                                  description: shareDescription,
                                  attachmentIds: shareDescription
                                    ? (request!.attachments ?? []).map(file => file.id)
                                    : [],
                                },
                              },
                              request!.version,
                            ),
                          'Assignment confirmed.',
                        )
                      "
                      >Confirm</VBtn
                    ><VBtn
                      v-if="item.id && can('assignment.review') && item.status === 'pending_approval'"
                      size="small"
                      color="error"
                      variant="tonal"
                      @click="
                        perform(
                          () =>
                            requestsApi.reviewAssignment(
                              request!.id,
                              item.id!,
                              { approve: false, note: actionNote },
                              request!.version,
                            ),
                          'Acceptance rejected.',
                        )
                      "
                      >Reject</VBtn
                    ><VBtn
                      v-if="
                        item.id && can('assignment.withdraw') && ['offered', 'pending_approval'].includes(item.status)
                      "
                      size="small"
                      color="error"
                      variant="tonal"
                      @click="
                        perform(
                          () => requestsApi.withdrawAssignment(request!.id, item.id!, actionNote, request!.version),
                          'Offer withdrawn.',
                        )
                      "
                      >Withdraw</VBtn
                    ><VBtn
                      v-if="item.id && can('assignment.replace') && item.status === 'accepted'"
                      size="small"
                      color="warning"
                      variant="tonal"
                      @click="
                        perform(
                          () =>
                            requestsApi.replaceAssignment(
                              request!.id,
                              item.id!,
                              { note: actionNote, workStarted: request!.status === 'in_progress' },
                              request!.version,
                            ),
                          'Provider replacement started.',
                        )
                      "
                      >Replace</VBtn
                    >
                  </div></template
                >
              </VListItem></VList
            >
            <div class="d-flex flex-wrap ga-3 mt-4">
              <VTextField v-model.number="crewSize" type="number" min="1" label="Hire crew size" /><VTextarea
                v-model="actionNote"
                label="Review or withdrawal note"
                rows="2"
              /><VCheckbox
                v-model="shareDescription"
                label="Share description and request attachments on confirmation"
              /><VTextField v-model="overrideNote" label="Eligibility override reason" />
            </div>
            <div
              v-if="currentAssignments.some(item => item.status === 'accepted') && can('request.shareDetails')"
              class="mt-3"
            >
              <h4 class="text-subtitle-1">Share additional details</h4>
              <VCheckbox v-model="shareAddress" label="Share address and access details" /><VTextarea
                v-model="shareNote"
                label="Reason for sharing details"
                rows="2"
              /><VBtn
                :disabled="shareAddress && !shareNote.trim()"
                @click="
                  perform(
                    () =>
                      requestsApi.shareDetails(
                        request!.id,
                        {
                          fields: shareAddress ? ['address', 'access'] : [],
                          attachmentIds: [],
                          note: shareNote || undefined,
                        },
                        request!.version,
                      ),
                    'Details shared with provider.',
                  )
                "
                >Share details</VBtn
              >
            </div>
          </VCardText></VCard
        >
      </template>

      <template v-else-if="props.section === 'jobs'">
        <VCard v-if="currentAssignments.length"
          ><VCardText>
            <h3 class="text-h5 mb-3">Your offers and assignments</h3>
            <VTextarea v-model="actionNote" label="Response note" rows="2" />
            <VList lines="two"
              ><VListItem
                v-for="item in currentAssignments"
                :key="item.id || item.providerId || item.status"
                :title="item.businessName || item.providerName || 'Service offer'"
                :subtitle="`${item.status}${item.expiresAt ? ` · expires ${new Date(item.expiresAt).toLocaleString()}` : ''}`"
              >
                <template #append
                  ><div class="d-flex ga-2">
                    <VBtn
                      v-if="item.id && can('assignment.respond') && item.status === 'offered'"
                      size="small"
                      color="success"
                      :loading="saving"
                      @click="
                        perform(
                          () =>
                            requestsApi.respondAssignment(
                              request!.id,
                              item.id!,
                              { accept: true, note: actionNote || undefined },
                              request!.version,
                            ),
                          'Offer accepted.',
                        )
                      "
                      >Accept</VBtn
                    >
                    <VBtn
                      v-if="item.id && can('assignment.respond') && item.status === 'offered'"
                      size="small"
                      color="error"
                      variant="tonal"
                      :loading="saving"
                      @click="
                        perform(
                          () =>
                            requestsApi.respondAssignment(
                              request!.id,
                              item.id!,
                              { accept: false, note: actionNote || undefined },
                              request!.version,
                            ),
                          'Offer declined.',
                        )
                      "
                      >Decline</VBtn
                    >
                  </div></template
                >
              </VListItem></VList
            >
          </VCardText></VCard
        >
        <VCard v-else
          ><VCardText class="text-medium-emphasis"
            >No offers or assignments are available for this request.</VCardText
          ></VCard
        >
      </template>

      <template v-else-if="props.section === 'quotes'">
        <VCard class="mb-5"
          ><VCardText>
            <h3 class="text-h5 mb-4">Quote</h3>
            <VAlert v-if="currentQuote" variant="tonal" color="info" class="mb-4"
              >{{ currentQuote.status }} · version {{ currentQuote.version }} ·
              {{ currentQuote.amountsHidden ? "amounts hidden" : money(currentQuote.total) }}</VAlert
            >
            <VAlert v-if="currentQuote?.blockedReason" variant="tonal" color="warning" class="mb-4">{{
              currentQuote.blockedReason
            }}</VAlert>
            <div v-if="can('quote.contribute')" class="mb-5">
              <h4 class="text-subtitle-1">Provider costing</h4>
              <div v-for="(item, index) in quoteItems" :key="`cost-${index}`" class="d-flex flex-wrap ga-3 mb-3">
                <VTextField v-model="item.description" label="Cost item" />
                <VTextField v-model.number="item.quantity" label="Quantity" type="number" />
                <VTextField v-model.number="item.unitPrice" label="Unit price (kobo)" type="number" />
              </div>
              <VBtn
                variant="outlined"
                prepend-icon="tabler-plus"
                class="mb-3"
                @click="quoteItems.push({ description: '', quantity: 1, unitPrice: 0 })"
                >Add cost item</VBtn
              >
              <VTextarea v-model="quoteNote" label="Costing note" rows="2" />
              <VBtn
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.contribute(
                        request!.id,
                        {
                          items: quoteItems.filter(
                            item => item.description.trim() && item.quantity > 0 && item.unitPrice > 0,
                          ),
                          note: quoteNote || undefined,
                        },
                        request!.version,
                      ),
                    'Costing submitted.',
                  )
                "
                >Submit costing</VBtn
              >
            </div>
            <div v-if="can('quote.save')" class="mb-4">
              <div v-for="(item, index) in quoteItems" :key="index" class="d-flex flex-wrap ga-3 mb-3">
                <VTextField v-model="item.description" label="Item description" />
                <VTextField v-model.number="item.quantity" label="Quantity" type="number" />
                <VTextField v-model.number="item.unitPrice" label="Unit price (kobo)" type="number" />
                <VBtn
                  icon="tabler-trash"
                  variant="text"
                  aria-label="Remove quote item"
                  @click="quoteItems.splice(index, 1)"
                />
              </div>
              <VBtn
                variant="outlined"
                prepend-icon="tabler-plus"
                class="mb-3"
                @click="quoteItems.push({ description: '', quantity: 1, unitPrice: 0 })"
                >Add item</VBtn
              >
              <VTextarea v-model="quoteNote" label="Quote note" rows="2" />
              <VBtn :loading="saving" @click="createOrUpdateQuote">{{
                currentQuote ? "Save draft" : "Create draft"
              }}</VBtn>
            </div>
            <div v-if="currentQuote" class="d-flex flex-wrap ga-2">
              <VTextField v-if="can('quote.publish')" v-model="customerQuoteNote" label="Note for customer" />
              <VBtn
                v-if="can('quote.publish')"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.publishQuote(
                        request!.id,
                        currentQuote!.id,
                        { revision: quoteRevision(currentQuote!), customerNote: customerQuoteNote || undefined },
                        request!.version,
                      ),
                    'Quote published or sent for sign-off.',
                  )
                "
                >Publish quote</VBtn
              >
              <VBtn
                v-if="can('quote.approve')"
                color="success"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.approveQuote(
                        request!.id,
                        currentQuote!.id,
                        { revision: quoteRevision(currentQuote!) },
                        request!.version,
                      ),
                    'Quote approved.',
                  )
                "
                >Approve</VBtn
              >
              <VBtn
                v-if="can('quote.return')"
                color="warning"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.returnQuote(
                        request!.id,
                        currentQuote!.id,
                        { revision: quoteRevision(currentQuote!), note: quoteNote },
                        request!.version,
                      ),
                    'Quote returned for changes.',
                  )
                "
                >Return for changes</VBtn
              >
              <VBtn
                v-if="can('quote.respond')"
                color="success"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.respondQuote(
                        request!.id,
                        currentQuote!.id,
                        { decision: 'accepted' },
                        request!.version,
                      ),
                    'Quote accepted.',
                  )
                "
                >Accept quote</VBtn
              >
              <VBtn
                v-if="can('quote.respond')"
                variant="outlined"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.respondQuote(
                        request!.id,
                        currentQuote!.id,
                        { decision: 'revision_requested', note: quoteNote || undefined },
                        request!.version,
                      ),
                    'Changes requested.',
                  )
                "
                >Ask for changes</VBtn
              >
              <VBtn
                v-if="can('quote.respond')"
                color="error"
                variant="tonal"
                :loading="saving"
                @click="
                  perform(
                    () =>
                      requestsApi.respondQuote(
                        request!.id,
                        currentQuote!.id,
                        { decision: 'declined', note: quoteNote || undefined },
                        request!.version,
                      ),
                    'Quote declined.',
                  )
                "
                >Decline</VBtn
              >
            </div>
            <div v-if="currentQuote && can('quote.setPayout')" class="d-flex align-center ga-3 mt-5">
              <VTextField v-model.number="payoutAmount" label="Provider payout (kobo)" type="number" hide-details />
              <VBtn
                :disabled="!payoutAmount"
                :loading="saving"
                @click="
                  perform(
                    () => requestsApi.setQuotePayout(request!.id, currentQuote!.id, payoutAmount!, request!.version),
                    'Payout amount saved.',
                  )
                "
                >Save payout</VBtn
              >
            </div>
            <div v-if="quoteLines.length" class="mt-5">
              <div v-for="(item, index) in quoteLines" :key="index" class="d-flex justify-space-between border-b py-2">
                <span
                  >{{ item.description }} · {{ item.quantity
                  }}<template v-if="item.unitPrice != null"> × {{ money(item.unitPrice) }}</template></span
                ><strong v-if="item.unitPrice != null">{{ money(item.quantity * item.unitPrice) }}</strong>
              </div>
            </div>
          </VCardText></VCard
        >
      </template>

      <template v-else-if="props.section === 'payments'">
        <VCard
          ><VCardText>
            <div class="d-flex flex-wrap justify-space-between align-center ga-3 mb-4">
              <h3 class="text-h5 mb-0">Payment</h3>
              <VBtn v-if="can('payment.initiate')" :loading="checkoutBusy" @click="beginCheckout"
                >Pay {{ money(payment?.amountDue) }}</VBtn
              ><VBtn variant="outlined" :loading="loading" @click="refreshCurrent">Refresh status</VBtn>
            </div>
            <p v-if="payment?.dueAt" class="text-medium-emphasis">Due {{ new Date(payment.dueAt).toLocaleString() }}</p>
            <VAlert v-if="payment?.offlineInstructions" color="info" variant="tonal" class="mb-4">{{
              payment.offlineInstructions
            }}</VAlert>
            <VTable v-if="payment?.payments.length"
              ><thead>
                <tr>
                  <th>Reference</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in payment.payments" :key="item.id">
                  <td>{{ item.reference || item.id }}</td>
                  <td>{{ item.method }}</td>
                  <td>{{ item.status }}</td>
                  <td>{{ money(item.amount) }}</td>
                </tr>
              </tbody></VTable
            >
            <p v-else class="text-medium-emphasis mb-0">No payment has been recorded.</p>
            <div v-if="can('payment.recordOffline')" class="mt-6">
              <h4 class="text-subtitle-1 mb-3">Record offline payment</h4>
              <div class="d-flex flex-wrap ga-3">
                <VTextField v-model.number="offlineAmount" label="Amount (kobo)" type="number" />
                <VSelect
                  v-model="offlineChannel"
                  :items="[
                    { title: 'Bank transfer', value: 'bank_transfer' },
                    { title: 'Cash', value: 'cash' },
                    { title: 'Cheque', value: 'cheque' },
                  ]"
                  label="Channel"
                />
                <VTextField v-model="offlineReference" label="Reference" />
                <VFileInput v-model="proofFile" label="Payment proof" accept="image/*,.pdf" hide-details />
                <VBtn variant="outlined" :disabled="!proofFile" :loading="saving" @click="uploadPaymentProof"
                  >Upload proof</VBtn
                >
                <VChip v-if="proofFileId" color="success" variant="tonal">Proof uploaded</VChip>
                <VBtn
                  :disabled="!offlineAmount || !offlineReference || !proofFileId"
                  :loading="saving"
                  @click="
                    perform(
                      () =>
                        requestsApi.recordOfflinePayment(request!.id, {
                          amount: offlineAmount!,
                          channel: offlineChannel,
                          reference: offlineReference,
                          paidAt: new Date().toISOString(),
                          proofFileId,
                          note: paymentNote || undefined,
                        }),
                      'Offline payment recorded.',
                      true,
                    )
                  "
                  >Record payment</VBtn
                >
              </div>
            </div>
            <VTextField v-model="paymentNote" label="Reconciliation note" class="mt-4" />
            <div v-for="item in payment?.payments ?? []" :key="`payment-actions-${item.id}`" class="d-flex ga-2 mb-2">
              <VBtn
                v-if="can('payment.reconcile') && item.method === 'offline' && item.status === 'recorded'"
                size="small"
                :loading="saving"
                @click="perform(() => requestsApi.reconcilePayment(item.id, paymentNote), 'Payment reconciled.', true)"
                >Reconcile {{ item.reference || item.id }}</VBtn
              >
              <VBtn
                v-if="can('payment.rejectOffline') && item.method === 'offline' && item.status === 'recorded'"
                size="small"
                color="error"
                variant="tonal"
                :loading="saving"
                @click="perform(() => requestsApi.rejectPayment(item.id, paymentNote), 'Payment rejected.', true)"
                >Reject</VBtn
              >
            </div>
            <p class="text-caption text-medium-emphasis mt-4 mb-0">
              Payment status comes from the server. Returning from checkout does not mark a payment as paid.
            </p>
          </VCardText></VCard
        >
      </template>
      <template
        v-else-if="
          props.section === 'requests' && (can('request.clarify') || can('request.review') || can('request.reject'))
        "
      >
        <VCard class="mb-5"
          ><VCardText>
            <h3 class="text-h5 mb-4">Intake review</h3>
            <VTextField v-if="can('request.clarify')" v-model="intakeQuestion" label="Clarification question" />
            <VBtn
              v-if="can('request.clarify')"
              :disabled="!intakeQuestion.trim()"
              :loading="saving"
              @click="
                perform(() => requestsApi.clarify(request!.id, intakeQuestion, request!.version), 'Clarification sent.')
              "
              >Ask customer</VBtn
            >
            <VTextarea
              v-if="can('request.review')"
              v-model="offerBrief"
              class="mt-4"
              label="Offer brief"
              :counter="1000"
            />
            <VCheckbox
              v-if="can('request.review')"
              v-model="shareDescription"
              label="Share the description with the provider after assignment confirmation"
            />
            <VCheckbox
              v-if="can('request.review') && request.contactInBrief"
              v-model="contactCheck"
              label="I confirmed customer contact details needed in this brief"
            />
            <VBtn
              v-if="can('request.review')"
              :disabled="!offerBrief.trim()"
              :loading="saving"
              @click="
                perform(
                  () =>
                    requestsApi.reviewIntake(
                      request!.id,
                      {
                        offerBrief,
                        contactCheck,
                        shareOnConfirm: {
                          description: shareDescription,
                          attachmentIds: shareDescription ? (request!.attachments ?? []).map(file => file.id) : [],
                        },
                      },
                      request!.version,
                    ),
                  'Request approved for dispatch.',
                )
              "
              >Approve intake</VBtn
            >
            <VTextField v-if="can('request.reject')" v-model="rejectionReason" class="mt-4" label="Rejection reason" />
            <VBtn
              v-if="can('request.reject')"
              color="error"
              variant="tonal"
              :disabled="!rejectionReason.trim()"
              :loading="saving"
              @click="
                perform(
                  () => requestsApi.rejectIntake(request!.id, rejectionReason, request!.version),
                  'Request rejected.',
                )
              "
              >Reject request</VBtn
            >
          </VCardText></VCard
        >
      </template>
      <RequestLifecycle
        v-if="['requests', 'jobs', 'dispatch', 'quotes', 'payments'].includes(props.section)"
        :request="request"
        @refresh="refreshCurrent"
      />
    </template>
  </div>
</template>

<style scoped>
.search-field {
  max-inline-size: 24rem;
  min-inline-size: 16rem;
}
.mode-field {
  max-inline-size: 18rem;
  min-inline-size: 12rem;
}
.stage-filter {
  max-inline-size: 14rem;
  min-inline-size: 11rem;
}
.answers {
  display: grid;
  font-size: 0.875rem;
  gap: 6px 16px;
  grid-template-columns: auto 1fr;
  margin: 0;
}
.answers dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.answers dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
