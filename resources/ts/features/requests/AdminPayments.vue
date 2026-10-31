<script setup lang="ts">
import type { PaymentView, PayoutView, RefundView, RequestSummary } from "@/features/requests/api-types"
import { HOLDABLE_PAYOUT_STATUSES } from "@/features/requests/api-types"
import { RequestsApiError, requestsApi } from "@/services/requests-api"
import { providersApi } from "@/services/providers-api"

const props = defineProps<{ demo?: boolean }>()

const refunds = ref<RefundView[]>([])
const payouts = ref<PayoutView[]>([])
const requests = ref<RequestSummary[]>([])
const requestId = ref("")
const requestPayments = ref<PaymentView[]>([])
const loading = ref(false)
const savingId = ref("")
const error = ref("")
const note = ref("")
const transferReference = ref("")
const proofFileId = ref("")
const proofFile = ref<File | null>(null)

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
    const [refundResult, payoutResult, requestResult] = await Promise.all([
      requestsApi.refunds({ page: 1 }),
      requestsApi.payouts({ page: 1 }),
      requestsApi.list({ page: 1, itemsPerPage: 50 }),
    ])
    refunds.value = refundResult.items
    payouts.value = payoutResult.items
    requests.value = requestResult.items
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
    <VTextField v-model="transferReference" label="Offline transfer reference" class="mb-3" />
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
                      v-if="refund.status === 'approved' && refund.method === 'offline'"
                      size="small"
                      :disabled="!transferReference.trim() || !proofFileId.trim()"
                      :loading="savingId === refund.id"
                      @click="
                        act(refund.id, () =>
                          requestsApi.transferRefund(refund.id, { reference: transferReference, proofFileId, note }),
                        )
                      "
                      >Record transfer</VBtn
                    >
                    <VBtn
                      v-if="refund.status === 'processing' && refund.method === 'offline'"
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
