<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { BankInput } from "@/features/operations/types"
import { when } from "@/features/operations/types"
import { isNuban } from "@/features/operations/banks"
import BankForm from "@/features/operations/BankForm.vue"

const ops = useOperationsStore()
const empty = (): BankInput => ({ bankCode: "", accountNumber: "", accountName: "" })
const form = ref<BankInput>(empty())
const payout = computed(() => ops.profile?.payout)
const awaiting = computed(() => Boolean(payout.value?.pending) && payout.value?.review?.state === "pending")
const rejected = computed(() =>
  payout.value?.review?.state === "rejected" && payout.value.review.note ? payout.value.review.note : "",
)
const status = computed(() =>
  awaiting.value
    ? {
        label: payout.value?.current ? "Change awaiting review · payouts paused" : "Awaiting XPro review",
        color: "warning",
      }
    : payout.value?.current
      ? { label: "Verified", color: "success" }
      : { label: "Not set", color: "default" },
)
const ready = computed(
  () => Boolean(form.value.bankCode) && isNuban(form.value.accountNumber) && form.value.accountName.trim().length >= 3,
)

const submit = async () => {
  if (await ops.run({ type: "payout.update", bank: { ...form.value } })) form.value = empty()
}
</script>

<template>
  <VAlert v-if="!ops.profile" color="info" variant="tonal">
    Complete your provider profile first, then add your bank details.
    <VBtn to="/verification" size="small" variant="text"> Open profile </VBtn>
  </VAlert>
  <template v-else-if="payout">
    <VCard class="mb-5">
      <VCardText>
        <div class="d-flex justify-space-between align-start flex-wrap gap-3 mb-3">
          <h2 class="text-h5">Current payout account</h2>
          <VChip :color="status.color" variant="tonal">
            {{ status.label }}
          </VChip>
        </div>
        <template v-if="payout.current">
          <p class="mb-1">{{ payout.current.bankName }} · {{ payout.current.accountNumber }}</p>
          <p class="text-body-2 text-medium-emphasis mb-0">
            {{ payout.current.accountName }}
          </p>
        </template>
        <p v-else class="text-medium-emphasis mb-0">No verified bank account yet.</p>
        <VAlert v-if="awaiting && payout.pending" color="warning" variant="tonal" class="mt-4">
          <strong>Pending change:</strong> {{ payout.pending.bankName }} · {{ payout.pending.accountNumber }} ·
          {{ payout.pending.accountName }}<br />{{
            payout.current
              ? "Payouts are paused until XPro verifies your new bank details."
              : "Payouts are paused until XPro verifies your bank details."
          }}
        </VAlert>
        <VAlert v-else-if="rejected" color="error" variant="tonal" class="mt-4">
          XPro did not approve your last bank details: {{ rejected }}
        </VAlert>
        <VAlert v-else-if="!payout.current" color="warning" variant="tonal" class="mt-4">
          Payouts are paused until XPro verifies your bank details.
        </VAlert>
      </VCardText>
    </VCard>
    <VCard class="mb-5">
      <VCardText>
        <h2 class="text-h5 mb-1">
          {{ payout.current ? "Change bank details" : "Add bank details" }}
        </h2>
        <p class="text-body-2 text-medium-emphasis">
          {{
            payout.current
              ? "New details are reviewed by XPro Finance. Your current account stays on record, but payouts are paused until the change is verified."
              : "New details are reviewed by XPro Finance."
          }}
        </p>
        <VAlert v-if="awaiting" color="info" variant="tonal" class="mb-3">
          Your previous bank change is still awaiting XPro review. </VAlert
        ><BankForm v-model="form" :holder-name="ops.actor?.name ?? ''" /><VBtn
          :disabled="!ready || awaiting"
          :loading="ops.busy"
          @click="submit"
        >
          Submit for XPro review
        </VBtn>
      </VCardText>
    </VCard>
    <VCard v-if="payout.history.length">
      <VCardText>
        <h2 class="text-h5 mb-4">Payout details history</h2>
        <p v-for="(entry, index) in payout.history" :key="index">
          {{ entry.action }}<template v-if="entry.note"> · {{ entry.note }} </template><br /><small
            class="text-medium-emphasis"
            >{{ entry.by }} · {{ when(entry.createdAt) }}</small
          >
        </p>
      </VCardText>
    </VCard>
  </template>
</template>
