<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { ProviderInput } from '@/features/operations/types'
import { serviceLines } from '@/features/workspace/config'
import { when } from '@/features/operations/types'
import { prepareFiles } from '@/features/operations/files'
import Attachments from '@/features/operations/Attachments.vue'

const props = defineProps<{ availability?: boolean }>()
const ops = useOperationsStore()
const files = ref<File[]>([])
const portfolioFiles = ref<File[]>([])
const profile = ops.profile
const form = reactive<ProviderInput>({ phone: profile?.phone ?? '', trade: profile?.trade ?? '', city: profile?.city ?? '', services: [...(profile?.services ?? [])], experience: profile?.experience ?? 0, bio: profile?.bio ?? '', documents: [...(profile?.documents ?? [])], portfolio: [...(profile?.portfolio ?? [])] })

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
        </VRow><VAlert
          v-if="ops.profile?.verification === 'approved'"
          color="info"
          variant="tonal"
          class="mb-4"
        >
          Updating your profile sends it back for review before it appears publicly again.
        </VAlert><VBtn
          :disabled="ops.profile?.verification === 'pending'"
          :loading="ops.busy"
          @click="submit"
        >
          {{ ops.profile?.verification === 'pending' ? 'Awaiting XPro review' : 'Submit profile for review' }}
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
