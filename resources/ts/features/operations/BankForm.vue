<script setup lang="ts">
import { isNuban, nigerianBanks, resolveAccountDemo } from "@/features/operations/banks"
import type { BankInput } from "@/features/operations/types"
import { providersApi } from "@/services/providers-api"
import { isDemoMode } from "@/utils/demo-mode"

const props = defineProps<{ holderName: string }>()
const bank = defineModel<BankInput>({ required: true })
const checking = ref(false)
const error = ref("")
const banks = ref(isDemoMode ? nigerianBanks : [])
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
    const accountName = isDemoMode
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
  if (isDemoMode) return
  try {
    banks.value = (await providersApi.banks()).data
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to load the bank list."
  }
})
</script>

<template>
  <div>
    <VRow>
      <VCol cols="12" md="6">
        <VAutocomplete
          :model-value="bank.bankCode"
          :items="banks"
          item-title="name"
          item-value="code"
          label="Bank"
          placeholder="Search for your bank"
          no-data-text="No bank matches your search."
          auto-select-first
          @update:model-value="change({ bankCode: String($event ?? '') })"
        />
      </VCol>
      <VCol cols="12" md="6">
        <VTextField
          :model-value="bank.accountNumber"
          label="Account number"
          inputmode="numeric"
          maxlength="10"
          hint="10 digits"
          persistent-hint
          @update:model-value="
            change({
              accountNumber: String($event ?? '')
                .replace(/\D/g, '')
                .slice(0, 10),
            })
          "
        />
      </VCol>
    </VRow>
    <div class="account-result mt-4" :class="{ 'account-result--verified': verified }" aria-live="polite">
      <VAvatar :color="verified ? 'success' : undefined" variant="tonal" size="40" class="flex-shrink-0">
        <VIcon :icon="verified ? 'tabler-circle-check' : 'tabler-user-search'" size="22" />
      </VAvatar>
      <div class="flex-grow-1">
        <div class="text-caption text-medium-emphasis">Account name</div>
        <div v-if="verified" class="text-subtitle-1 font-weight-medium">
          {{ bank.accountName }}
        </div>
        <div v-else class="text-body-2 text-medium-emphasis">
          Select your bank, enter your account number, then verify to see the account name.
        </div>
        <div v-if="error" class="text-body-2 text-error mt-1" role="alert">
          {{ error }}
        </div>
      </div>
      <VBtn
        v-if="!verified"
        variant="outlined"
        prepend-icon="tabler-shield-check"
        :loading="checking"
        :disabled="!canVerify"
        @click="verify"
      >
        Verify account
      </VBtn>
      <VChip v-else color="success" variant="tonal" size="small" prepend-icon="tabler-check"> Verified </VChip>
    </div>
    <p class="text-caption text-medium-emphasis mt-2 mb-3">
      {{ isDemoMode ? "Demo account verification is simulated." : "The account name is looked up from your bank." }}
    </p>
  </div>
</template>

<style scoped>
.account-result {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border: 1px dashed rgba(var(--v-border-color), 0.4);
  border-radius: 8px;
}
.account-result--verified {
  border-style: solid;
  border-color: rgba(var(--v-theme-success), 0.4);
  background: rgba(var(--v-theme-success), 0.06);
}
</style>
