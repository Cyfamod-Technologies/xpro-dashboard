<script setup lang="ts">
import { isNuban, nigerianBanks, resolveAccountDemo } from "@/features/operations/banks"
import type { BankInput } from "@/features/operations/types"
import { providersApi } from "@/services/providers-api"

const props = defineProps<{ holderName: string }>()
const bank = defineModel<BankInput>({ required: true })
const checking = ref(false)
const error = ref("")
const banks = ref(nigerianBanks)
const usePrototype = import.meta.env.VITE_ENABLE_MOCKS !== "false"
const verified = computed(() => bank.value.accountName.trim().length >= 3)
const canVerify = computed(() => Boolean(bank.value.bankCode) && isNuban(bank.value.accountNumber) && !verified.value)

// Any change to the bank or number clears the resolved name, so it must be verified again.
const change = (patch: Partial<BankInput>) => {
  bank.value = { ...bank.value, ...patch, accountName: "" }
  error.value = ""
}

const verify = async () => {
  const { bankCode, accountNumber } = bank.value

  checking.value = true
  error.value = ""
  try {
    const accountName = usePrototype
      ? await resolveAccountDemo(bankCode, accountNumber, props.holderName)
      : (await providersApi.resolveBank(bankCode, accountNumber)).data.accountName

    if (bank.value.bankCode === bankCode && bank.value.accountNumber === accountNumber)
      bank.value = { ...bank.value, accountName }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "We could not verify this account."
  } finally {
    checking.value = false
  }
}

onMounted(async () => {
  if (usePrototype) return
  try {
    banks.value = (await providersApi.banks()).data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to load the bank list."
  }
})
</script>

<template>
  <VRow>
    <VCol cols="12" sm="6">
      <VSelect
        :model-value="bank.bankCode"
        :items="banks"
        item-title="name"
        item-value="code"
        label="Bank"
        @update:model-value="change({ bankCode: String($event ?? '') })"
      /> </VCol
    ><VCol cols="12" sm="6">
      <VTextField
        :model-value="bank.accountNumber"
        label="Account number"
        inputmode="numeric"
        maxlength="10"
        hint="10 digits"
        @update:model-value="
          change({
            accountNumber: String($event ?? '')
              .replace(/\D/g, '')
              .slice(0, 10),
          })
        "
      /> </VCol
    ><VCol cols="12" sm="6">
      <VBtn variant="outlined" :loading="checking" :disabled="!canVerify" @click="verify">
        {{ verified ? "Account verified" : "Verify account" }}
      </VBtn>
      <p class="text-caption text-medium-emphasis mt-2 mb-0">
        {{ usePrototype ? "Demo account verification is simulated." : "Account name is verified by the server." }}
      </p> </VCol
    ><VCol cols="12" sm="6">
      <VTextField
        :model-value="bank.accountName"
        label="Account name"
        readonly
        :error-messages="error"
        :hint="verified ? 'Confirmed by the bank lookup' : 'Appears after you verify the account'"
        persistent-hint
      />
    </VCol>
  </VRow>
</template>
