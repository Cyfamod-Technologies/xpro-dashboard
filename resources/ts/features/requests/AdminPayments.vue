<script setup lang="ts">
import type {
  PaymentView,
  PayoutView,
  RefundReserveSummary,
  RefundView,
  RequestSummary,
} from "@/features/requests/api-types"
import { HOLDABLE_PAYOUT_STATUSES } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { providersApi } from "@/services/providers-api"

const props = defineProps<{ demo?: boolean }>()

const refunds = ref<RefundView[]>([])
const payouts = ref<PayoutView[]>([])
const requests = ref<RequestSummary[]>([])
const requestId = ref("")
const requestPayments = ref<PaymentView[]>([])
const refundReserve = ref<RefundReserveSummary | null>(null)
const loading = ref(false)
const savingId = ref("")
const error = ref("")
const note = ref("")
const transferReference = ref("")
const proofFileId = ref("")
const proofFile = ref<File | null>(null)
const reserveAmount = ref<number | null>(null)
const reserveReference = ref("")
const reserveProofFile = ref<File | null>(null)
const reserveProofFileId = ref("")

const fail = (cause: unknown) => {
  error.value =
    cause instanceof RequestsApiError
      ? cause.message
      : cause instanceof Error
        ? cause.message
        : "Finance queues could not be loaded."
}

async function load() {
  loading.value = true
  error.value = ""
  try {
    const [refundResult, payoutResult, requestResult, reserveResult] = await Promise.all([
      requestsApi.refunds({ page: 1 }),
      requestsApi.payouts({ page: 1 }),
      requestsApi.list({ page: 1, itemsPerPage: 50 }),
      requestsApi.refundReserve(),
    ])
    refunds.value = refundResult.items
    payouts.value = payoutResult.items
    requests.value = requestResult.items
    refundReserve.value = reserveResult
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadRequestPayments(id: string | null) {
  requestId.value = id ?? ""
  requestPayments.value = []
  if (!requestId.value) return
  loading.value = true
  error.value = ""
  try {
    requestPayments.value = (await requestsApi.payments(requestId.value)).payments
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function act(id: string, action: () => Promise<unknown>) {
  savingId.value = id
  error.value = ""
  try {
    await action()
    await load()
  } catch (cause) {
    fail(cause)
  } finally {
    savingId.value = ""
  }
}

async function uploadProof() {
  if (!proofFile.value) return
  savingId.value = "proof"
  error.value = ""
  try {
    proofFileId.value = (await providersApi.upload(proofFile.value, "payment_proof")).id
  } catch (cause) {
    fail(cause)
  } finally {
    savingId.value = ""
  }
}

async function uploadReserveProof() {
  if (!reserveProofFile.value) return
  savingId.value = "reserve-proof"
  error.value = ""
  try {
    reserveProofFileId.value = (await providersApi.upload(reserveProofFile.value, "payment_proof")).id
  } catch (cause) {
    fail(cause)
  } finally {
    savingId.value = ""
  }
}

async function recordReserveFunding() {
  if (!reserveAmount.value || reserveAmount.value <= 0 || !reserveReference.value.trim() || !reserveProofFileId.value)
    return
  savingId.value = "reserve-funding"
  error.value = ""
  try {
    await requestsApi.recordRefundReserveFunding({
      amount: Math.round(reserveAmount.value * 100),
      reference: reserveReference.value.trim(),
      proofFileId: reserveProofFileId.value,
    })
    reserveAmount.value = null
    reserveReference.value = ""
    reserveProofFile.value = null
    reserveProofFileId.value = ""
    await load()
  } catch (cause) {
    fail(cause)
  } finally {
    savingId.value = ""
  }
}

const formatNaira = (kobo: string) =>
  (Number(kobo) / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })

onMounted(async () => {
  if (!props.demo) await load()
})
</script>

<template>
  <VCard v-if="demo" max-width="900">
    <VCardText>
      <h2 class="text-h5 mb-2">Payments</h2>
      <p class="text-medium-emphasis mb-0">
        Payments are outside the V1 demo. No payments are collected or stored here.
      </p>
    </VCardText>
  </VCard>
  <div v-else>
    <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
    <VProgressLinear v-if="loading" indeterminate class="mb-4" />
    <VTextField v-model="note" label="Decision note or reason" class="mb-5" />
    <VAlert type="info" variant="tonal" class="mb-4">
      Refunds are sent from XPro's separate refund reserve by bank transfer. They do not reduce provider payouts.
    </VAlert>
    <VTextField v-model="transferReference" label="Bank transfer reference" class="mb-3" />
    <div class="d-flex flex-wrap align-center ga-3 mb-5">
      <VFileInput v-model="proofFile" label="Transfer proof" accept="image/*,.pdf" hide-details /><VBtn
        variant="outlined"
        :disabled="!proofFile"
        :loading="savingId === 'proof'"
        @click="uploadProof"
        >Upload proof</VBtn
      ><VChip v-if="proofFileId" color="success" variant="tonal">Proof uploaded</VChip>
    </div>
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardText>
            <div class="d-flex flex-wrap align-center justify-space-between ga-4 mb-4">
              <div>
                <h2 class="text-h5 mb-1">Refund reserve</h2>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  Move funds from XPro's operating account to the separate reserve, record the transfer and proof, then
                  have another staff member reconcile it.
                </p>
              </div>
              <div class="d-flex flex-wrap ga-5">
                <div>
                  <div class="text-caption text-medium-emphasis">Reserve balance</div>
                  <strong>{{ refundReserve ? formatNaira(refundReserve.reserveBalance) : "—" }}</strong>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Approved refunds outstanding</div>
                  <strong>{{ refundReserve ? formatNaira(refundReserve.outstandingRefunds) : "—" }}</strong>
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Available after refunds</div>
                  <strong>{{ refundReserve ? formatNaira(refundReserve.available) : "—" }}</strong>
                </div>
              </div>
            </div>
            <VRow align="center">
              <VCol cols="12" md="2">
                <VTextField
                  v-model.number="reserveAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  label="Amount moved (₦)"
                />
              </VCol>
              <VCol cols="12" md="3">
                <VTextField v-model="reserveReference" label="Bank transfer reference" />
              </VCol>
              <VCol cols="12" md="4">
                <VFileInput v-model="reserveProofFile" label="Funding proof" accept="image/*,.pdf" hide-details />
              </VCol>
              <VCol cols="12" md="3" class="d-flex flex-wrap ga-2">
                <VBtn
                  variant="outlined"
                  :disabled="!reserveProofFile"
                  :loading="savingId === 'reserve-proof'"
                  @click="uploadReserveProof"
                >
                  Upload proof
                </VBtn>
                <VBtn
                  color="primary"
                  :disabled="!reserveAmount || reserveAmount <= 0 || !reserveReference.trim() || !reserveProofFileId"
                  :loading="savingId === 'reserve-funding'"
                  @click="recordReserveFunding"
                >
                  Record funding
                </VBtn>
              </VCol>
            </VRow>
            <VAlert v-if="refundReserve?.pendingFunding.length" type="warning" variant="tonal" class="mt-4">
              Pending funding does not count toward the available reserve until a different staff member reconciles it.
            </VAlert>
            <VList v-if="refundReserve?.recentFunding.length" class="mt-3">
              <VListItem
                v-for="funding in refundReserve.recentFunding"
                :key="funding.id"
                :title="`${funding.reference} · ${formatNaira(String(funding.amount))}`"
                :subtitle="`${funding.status.replaceAll('_', ' ')} · recorded ${new Date(funding.createdAt).toLocaleString()}`"
              >
                <template #append>
                  <VBtn
                    v-if="funding.status === 'pending_reconciliation'"
                    size="small"
                    :disabled="!note.trim()"
                    :loading="savingId === funding.id"
                    @click="
                      act(funding.id, () =>
                        requestsApi.reconcileRefundReserveFunding(funding.id, note, funding.version),
                      )
                    "
                    >Reconcile funding</VBtn
                  >
                  <VBtn
                    v-if="funding.status === 'pending_reconciliation'"
                    size="small"
                    color="error"
                    variant="tonal"
                    :disabled="!note.trim()"
                    :loading="savingId === `${funding.id}-reject`"
                    @click="
                      act(`${funding.id}-reject`, () =>
                        requestsApi.rejectRefundReserveFunding(funding.id, note, funding.version),
                      )
                    "
                    >Reject</VBtn
                  >
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12">
        <VCard
          ><VCardText>
            <h2 class="text-h5 mb-4">Offline payment reconciliation</h2>
            <VSelect
              :model-value="requestId"
              :items="
                requests.map(item => ({ title: `${item.title || 'Service request'} · ${item.id}`, value: item.id }))
              "
              label="Choose a request"
              clearable
              @update:model-value="loadRequestPayments"
            />
            <VTable v-if="requestPayments.length"
              ><thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in requestPayments" :key="item.id">
                  <td>{{ item.reference || item.id }}</td>
                  <td>{{ item.status }}</td>
                  <td>
                    {{
                      item.amount == null
                        ? "—"
                        : (item.amount / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN" })
                    }}
                  </td>
                  <td>
                    <div class="d-flex ga-2">
                      <VBtn
                        v-if="item.method === 'offline' && item.status === 'recorded'"
                        size="small"
                        :disabled="!note.trim()"
                        :loading="savingId === item.id"
                        @click="
                          act(item.id, async () => {
                            await requestsApi.reconcilePayment(item.id, note)
                            await loadRequestPayments(requestId)
                          })
                        "
                        >Reconcile</VBtn
                      ><VBtn
                        v-if="item.method === 'offline' && item.status === 'recorded'"
                        size="small"
                        color="error"
                        variant="tonal"
                        :disabled="!note.trim()"
                        :loading="savingId === item.id"
                        @click="
                          act(item.id, async () => {
                            await requestsApi.rejectPayment(item.id, note)
                            await loadRequestPayments(requestId)
                          })
                        "
                        >Reject</VBtn
                      >
                    </div>
                  </td>
                </tr>
              </tbody></VTable
            >
            <p v-else-if="requestId" class="text-medium-emphasis mb-0">No payment records for this request.</p>
            <p v-else class="text-medium-emphasis mb-0">Select a request to inspect its payment records.</p>
          </VCardText></VCard
        >
      </VCol>
      <VCol cols="12" xl="6">
        <VCard
          ><VCardText>
            <h2 class="text-h5 mb-4">Refunds</h2>
            <VList v-if="refunds.length" lines="two">
              <VListItem
                v-for="refund in refunds"
                :key="refund.id"
                :title="`${refund.id} · ${refund.status}`"
                :subtitle="`${refund.reason || 'No reason supplied'} · ${refund.requestId || 'Request unavailable'}`"
              >
                <template #append
                  ><div class="d-flex flex-wrap ga-2">
                    <VBtn
                      v-if="refund.status === 'pending_approval'"
                      size="small"
                      color="success"
                      :disabled="!note.trim()"
                      :loading="savingId === refund.id"
                      @click="
                        act(refund.id, () => requestsApi.decideRefund(refund.id, { approve: true, reason: note }))
                      "
                      >Approve</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'pending_approval'"
                      size="small"
                      color="error"
                      variant="tonal"
                      :disabled="!note.trim()"
                      :loading="savingId === refund.id"
                      @click="
                        act(refund.id, () => requestsApi.decideRefund(refund.id, { approve: false, reason: note }))
                      "
                      >Reject</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'awaiting_second_approval'"
                      size="small"
                      color="success"
                      :loading="savingId === refund.id"
                      @click="
                        act(refund.id, () =>
                          requestsApi.secondApproveRefund(refund.id, { approve: true, reason: note }),
                        )
                      "
                      >Second approve</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'approved'"
                      size="small"
                      :disabled="!refundReserve || Number(refundReserve.available) < 0"
                      :loading="savingId === refund.id"
                      @click="act(refund.id, () => requestsApi.prepareRefundTransfer(refund.id, refund.version))"
                      >Authorize reserve payment</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'processing' && refund.transferPrepared"
                      size="small"
                      :disabled="!transferReference.trim() || !proofFileId.trim()"
                      :loading="savingId === refund.id"
                      @click="
                        act(refund.id, () =>
                          requestsApi.transferRefund(refund.id, { reference: transferReference, proofFileId, note }),
                        )
                      "
                      >Record bank transfer</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'processing' && refund.transferRecorded"
                      size="small"
                      :disabled="!note.trim()"
                      :loading="savingId === refund.id"
                      @click="act(refund.id, () => requestsApi.reconcileRefund(refund.id, note))"
                      >Reconcile</VBtn
                    >
                  </div></template
                >
              </VListItem>
            </VList>
            <p v-else class="text-medium-emphasis mb-0">No refunds in this queue.</p>
          </VCardText></VCard
        >
      </VCol>
      <VCol cols="12" xl="6">
        <VCard
          ><VCardText>
            <h2 class="text-h5 mb-4">Provider payouts</h2>
            <VList v-if="payouts.length" lines="two">
              <VListItem
                v-for="payout in payouts"
                :key="payout.id"
                :title="`${payout.providerName || payout.id} · ${payout.status}`"
                :subtitle="`${payout.requestId || 'Request unavailable'} · ${payout.maskedBankAccount || 'Bank details hidden'}`"
              >
                <template #append
                  ><div class="d-flex flex-wrap ga-2">
                    <VBtn
                      v-if="payout.status === 'pending_approval'"
                      size="small"
                      color="success"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.approvePayout(payout.id, note || undefined))"
                      >Approve</VBtn
                    >
                    <VBtn
                      v-if="payout.status === 'approved'"
                      size="small"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.transferPayout(payout.id, { method: 'paystack' }))"
                      >Pay by Paystack</VBtn
                    >
                    <VBtn
                      v-if="payout.status === 'awaiting_second_approval'"
                      size="small"
                      color="success"
                      :disabled="!note.trim()"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.secondApprovePayout(payout.id, { approve: true, note }))"
                      >Second approve</VBtn
                    >
                    <VBtn
                      v-if="payout.status === 'approved'"
                      size="small"
                      :disabled="!transferReference.trim() || !proofFileId.trim()"
                      :loading="savingId === payout.id"
                      @click="
                        act(payout.id, () =>
                          requestsApi.transferPayout(payout.id, {
                            method: 'offline',
                            reference: transferReference,
                            proofFileId,
                          }),
                        )
                      "
                      >Record offline transfer</VBtn
                    >
                    <VBtn
                      v-if="payout.status === 'on_hold'"
                      size="small"
                      :disabled="!note.trim()"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.releasePayout(payout.id, note))"
                      >Release hold</VBtn
                    >
                    <VBtn
                      v-if="HOLDABLE_PAYOUT_STATUSES.includes(payout.status)"
                      size="small"
                      color="warning"
                      variant="tonal"
                      :disabled="!note.trim()"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.holdPayout(payout.id, note))"
                      >Hold</VBtn
                    >
                    <VBtn
                      v-if="payout.status === 'processing' && payout.method === 'offline'"
                      size="small"
                      :disabled="!note.trim()"
                      :loading="savingId === payout.id"
                      @click="act(payout.id, () => requestsApi.reconcilePayout(payout.id, note))"
                      >Reconcile offline transfer</VBtn
                    >
                  </div></template
                >
              </VListItem>
            </VList>
            <p v-else class="text-medium-emphasis mb-0">No payouts in this queue.</p>
          </VCardText></VCard
        >
      </VCol>
    </VRow>
  </div>
</template>
