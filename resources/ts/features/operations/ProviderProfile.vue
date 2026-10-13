<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { BankInput, ProviderInput } from '@/features/operations/types'
import { serviceLines } from '@/features/workspace/config'
import { when } from '@/features/operations/types'
import { prepareFiles } from '@/features/operations/files'
import { isNuban, maskAccount } from '@/features/operations/banks'
import { payoutReady, profileChangeRows } from '@/features/operations/workflow'
import Attachments from '@/features/operations/Attachments.vue'
import BankForm from '@/features/operations/BankForm.vue'

const props = defineProps<{ availability?: boolean }>()
const ops = useOperationsStore()
const files = ref<File[]>([])
const portfolioFiles = ref<File[]>([])
const photoFile = ref<File[]>([])
const profile = ops.profile
const known: BankInput | undefined = profile?.payout.pending ?? profile?.payout.current ?? undefined
// Changes already waiting for XPro review are shown (and resubmitted) as the form's proposed values.
const proposed = profile?.pendingChanges ?? profile
const form = reactive<ProviderInput>({ phone: profile?.phone ?? '', trade: proposed?.trade ?? '', city: profile?.city ?? '', services: [...(proposed?.services ?? [])], experience: profile?.experience ?? 0, bio: profile?.bio ?? '', documents: [...(proposed?.documents ?? [])], portfolio: [...(profile?.portfolio ?? [])], photo: proposed?.photo ?? null, bank: { bankCode: known?.bankCode ?? '', accountNumber: known?.accountNumber ?? '', accountName: known?.accountName ?? '' } })
const current = computed(() => ops.profile?.payout.current ?? null)
const awaitingBank = computed(() => ops.profile?.payout.review?.state === 'pending' ? ops.profile.payout.pending : null)
const changingBank = ref(false)
const keepCurrent = computed(() => Boolean(current.value) && !changingBank.value && !awaitingBank.value)
const changeRows = computed(() => ops.profile ? profileChangeRows(ops.profile) : [])
const changesAwaiting = computed(() => ops.profile?.pendingChanges && ops.profile.changesReview?.state === 'pending')
const changesRejected = computed(() => ops.profile?.changesReview?.state === 'rejected' ? ops.profile.changesReview.note : '')
const bankReady = computed(() => Boolean(awaitingBank.value) || keepCurrent.value || (Boolean(form.bank.bankCode) && isNuban(form.bank.accountNumber) && form.bank.accountName.trim().length >= 3))

const checklist = computed(() => [
  { label: 'Profile details', done: Boolean(form.trade.trim() && form.city.trim() && form.phone.trim() && form.services.length && form.bio.trim()) },
  { label: 'Documents', done: form.documents.length + files.value.length > 0 },
  { label: 'Face photo', done: Boolean(form.photo) },
  { label: 'Bank details', done: bankReady.value },
  { label: 'Submitted', done: ['pending', 'approved', 'rejected'].includes(ops.profile?.verification ?? '') },
  { label: 'Verified (identity)', done: ops.profile?.verification === 'approved' },
  { label: 'Bank verified', done: Boolean(ops.profile) && payoutReady(ops.profile!) },
])

const choosePhoto = async (value: File | File[] | null) => {
  const file = Array.isArray(value) ? value[0] : value

  if (!file)
    return
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      throw new Error('Use a PNG, JPG or WebP photo.')
    form.photo = (await prepareFiles([file]))[0]
  }
  catch (cause) { ops.error = cause instanceof Error ? cause.message : 'Unable to read this photo.' }
}

const useDifferentAccount = () => {
  changingBank.value = true
  form.bank = { bankCode: '', accountNumber: '', accountName: '' }
}

const keepAccount = () => {
  changingBank.value = false
  if (current.value)
    form.bank = { bankCode: current.value.bankCode, accountNumber: current.value.accountNumber, accountName: current.value.accountName }
}

const submit = async () => {
  try {
    form.documents.push(...await prepareFiles(files.value))
    form.portfolio.push(...await prepareFiles(portfolioFiles.value))
    files.value = []
    portfolioFiles.value = []
    await ops.run({ type: 'provider.submit', input: form })
  }
  catch (cause) { ops.error = cause instanceof Error ? cause.message : 'Unable to read your documents.' }
}
</script>

<template>
  <VAlert
    variant="tonal"
    :color="ops.profile?.verification === 'approved' ? 'success' : 'warning'"
    class="mb-5"
  >
    Profile status: {{ ops.profile?.verification.replaceAll('_', ' ') ?? 'draft' }}. {{ ops.profile?.reviewNote }}
  </VAlert>
  <VAlert
    v-if="changesAwaiting"
    variant="tonal"
    color="warning"
    class="mb-5"
  >
    <strong>Changes awaiting XPro review.</strong> Your profile stays public with your current details until XPro approves them.
    <ul class="ps-5 mt-2">
      <li
        v-for="row in changeRows"
        :key="row.label"
      >
        {{ row.label }}: {{ row.current }} → {{ row.proposed }}
      </li>
    </ul>
  </VAlert>
  <VAlert
    v-else-if="changesRejected"
    variant="tonal"
    color="error"
    class="mb-5"
  >
    XPro did not approve your last profile changes: {{ changesRejected }}
  </VAlert>
  <VCard
    v-if="!props.availability"
    class="mb-5"
  >
    <VCardText>
      <h2 class="text-h5 mb-4">
        Onboarding checklist
      </h2>
      <div class="d-flex flex-wrap gap-x-6 gap-y-2">
        <span
          v-for="item in checklist"
          :key="item.label"
          class="d-flex align-center gap-2"
        >
          <VIcon
            :icon="item.done ? 'tabler-circle-check' : 'tabler-circle-dashed'"
            :color="item.done ? 'success' : undefined"
            :aria-label="item.done ? 'Done' : 'Pending'"
            role="img"
            size="20"
          />{{ item.label }}
        </span>
      </div>
    </VCardText>
  </VCard>
  <VCard v-if="props.availability">
    <VCardText>
      <h2 class="text-h5 mb-4">
        Available for assignments
      </h2><p class="text-medium-emphasis">
        Dispatch considers providers who are approved and available. Changing this does not cancel your current jobs.
      </p><VSwitch
        :model-value="ops.profile?.available ?? false"
        :disabled="!ops.profile || ops.busy"
        label="I am available for new work"
        @update:model-value="ops.run({ type: 'provider.availability', available: Boolean($event) })"
      />
    </VCardText>
  </VCard>
  <template v-else>
    <VCard class="mb-5">
      <VCardText>
        <h2 class="text-h5 mb-5">
          Your provider profile
        </h2><VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.trade"
              label="Trade / business specialism"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.city"
              label="Service area / city"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.phone"
              label="Private contact phone"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model.number="form.experience"
              label="Years of experience"
              type="number"
              min="0"
            />
          </VCol><VCol cols="12">
            <VSelect
              v-model="form.services"
              :items="serviceLines.map(item => item.name)"
              label="Services offered"
              multiple
              chips
            />
          </VCol><VCol cols="12">
            <VTextarea
              v-model="form.bio"
              label="Public introduction"
            />
          </VCol><VCol cols="12">
            <h3 class="text-h6 mb-3">
              Private verification documents
            </h3><p class="text-body-2 text-medium-emphasis">
              Identity, qualification or business documents are visible to XPro review staff.
            </p><Attachments :files="form.documents" /><VBtn
              v-if="form.documents.length"
              variant="text"
              size="small"
              @click="form.documents = []"
            >
              Remove existing documents
            </VBtn><VFileInput
              v-model="files"
              multiple
              label="Add verification documents"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
            />
          </VCol><VCol cols="12">
            <h3 class="text-h6 mb-3">
              Face photo
            </h3><p class="text-body-2 text-medium-emphasis">
              Used by XPro staff to verify your identity. Not shown publicly.
            </p><VImg
              v-if="form.photo?.dataUrl"
              :src="form.photo.dataUrl"
              :alt="form.photo.name"
              max-width="160"
              max-height="160"
              rounded
              class="my-3"
            /><Attachments
              v-else-if="form.photo"
              :files="[form.photo]"
            /><VFileInput
              v-model="photoFile"
              label="Upload a clear face photo"
              accept="image/png,image/jpeg,image/webp"
              @update:model-value="choosePhoto"
            />
          </VCol><VCol cols="12">
            <h3 class="text-h6 mb-3">
              Public portfolio
            </h3><p class="text-body-2 text-medium-emphasis">
              These samples appear on your public profile after approval.
            </p><Attachments :files="form.portfolio" /><VBtn
              v-if="form.portfolio.length"
              variant="text"
              size="small"
              @click="form.portfolio = []"
            >
              Remove existing portfolio
            </VBtn><VFileInput
              v-model="portfolioFiles"
              multiple
              label="Add public portfolio samples"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
            />
          </VCol>
        </VRow><VCard
          variant="outlined"
          class="mb-5"
        >
          <VCardText>
            <h3 class="text-h6 mb-1">
              Bank details
            </h3><p class="text-body-2 text-medium-emphasis">
              XPro pays you into this account once Finance has verified it. The account name must match your business or personal name.
            </p><template v-if="awaitingBank">
              <p class="mb-1">
                {{ awaitingBank.bankName }} · {{ maskAccount(awaitingBank.accountNumber) }}
              </p><p class="text-body-2 text-medium-emphasis">
                {{ awaitingBank.accountName }}
              </p><VAlert
                variant="tonal"
                color="warning"
              >
                Your bank change is awaiting XPro review. Payouts are paused until XPro verifies your new bank details. You can change bank details again once it is reviewed.
              </VAlert>
            </template><template v-else-if="keepCurrent">
              <p class="mb-1">
                {{ current!.bankName }} · {{ maskAccount(current!.accountNumber) }}
              </p><p class="text-body-2 text-medium-emphasis">
                {{ current!.accountName }}
              </p><VBtn
                variant="text"
                size="small"
                @click="useDifferentAccount"
              >
                Use a different account
              </VBtn>
            </template><template v-else>
              <BankForm
                v-model="form.bank"
                :holder-name="ops.actor?.name ?? ''"
              /><VBtn
                v-if="current"
                variant="text"
                size="small"
                @click="keepAccount"
              >
                Keep my current account
              </VBtn>
            </template>
          </VCardText>
        </VCard><VAlert
          v-if="ops.profile?.verification === 'approved'"
          color="info"
          variant="tonal"
          class="mb-4"
        >
          Changes to your phone, city, experience, bio and portfolio apply straight away. Changes to your trade, services, verification documents or face photo are reviewed by XPro first, and your profile stays public while they are reviewed.
        </VAlert><VBtn
          :disabled="ops.profile?.verification === 'pending' || !bankReady"
          :loading="ops.busy"
          @click="submit"
        >
          {{ ops.profile?.verification === 'pending' ? 'Awaiting XPro review' : ops.profile?.verification === 'approved' ? 'Save profile changes' : 'Submit profile for review' }}
        </VBtn>
      </VCardText>
    </VCard><VCard v-if="ops.profile?.history.length">
      <VCardText>
        <h2 class="text-h5 mb-4">
          Review history
        </h2><p
          v-for="(entry, index) in ops.profile.history"
          :key="index"
        >
          {{ entry.status.replaceAll('_', ' ') }} · {{ entry.note }}<br><small class="text-medium-emphasis">{{ when(entry.createdAt) }}</small>
        </p>
      </VCardText>
    </VCard>
  </template>
</template>
