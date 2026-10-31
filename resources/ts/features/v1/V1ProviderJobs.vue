<script setup lang="ts">
import { contactMethodLabels, formatDateTime, formatDay, preview } from "@/features/v1/helpers"
import { formatFileSize } from "@/features/operations/file-rules"
import type { V1Job } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

// Read-only jobs a staff member assigned to this provider. V1-ASSUMPTION A3: brief, place, date and customer contact
// only; no customer price. No chat, schedule or progress controls.
const route = useRoute()
const router = useRouter()

const jobs = ref<V1Job[]>([])
const loading = ref(true)
const error = ref("")

const selectedId = computed(() => (typeof route.query.request === "string" ? route.query.request : ""))
const selected = computed(() => jobs.value.find(job => job.id === selectedId.value))

onMounted(async () => {
  try {
    jobs.value = await v1Api.providerJobs()
  } catch (cause) {
    error.value = getErrorMessage(cause, "Your jobs could not be loaded.")
  } finally {
    loading.value = false
  }
})

const open = (id: string) => router.push({ query: { request: id } })
const back = () => router.push({ query: {} })
</script>

<template>
  <div>
    <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
    <VProgressLinear v-if="loading" indeterminate />

    <template v-else-if="selected">
      <VBtn variant="text" prepend-icon="tabler-arrow-left" class="mb-3" @click="back">All jobs</VBtn>
      <VCard>
        <VCardText>
          <div class="text-caption text-medium-emphasis">{{ selected.id }} · {{ selected.service }}</div>
          <h2 class="text-h5 mb-4">{{ selected.title }}</h2>
          <VRow dense>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Location</div>
              <div class="text-body-1">{{ selected.location }}</div>
              <div class="text-body-2">{{ selected.address }}</div>
            </VCol>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Date</div>
              <div class="text-body-1">{{ formatDay(selected.date) }}</div>
              <div class="text-body-2">Assigned {{ formatDateTime(selected.assignedAt) }}</div>
            </VCol>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Customer</div>
              <div class="text-body-1">{{ selected.customer.name }}</div>
              <div class="text-body-2">
                {{ selected.customer.phone }} · prefers {{ contactMethodLabels[selected.customer.contactMethod] }}
              </div>
            </VCol>
          </VRow>
          <VDivider class="my-4" />
          <div class="text-caption text-medium-emphasis">Brief</div>
          <p class="text-body-1 mb-0 brief">{{ selected.description }}</p>
          <template v-if="selected.attachments.length">
            <VDivider class="my-4" />
            <div class="text-caption text-medium-emphasis mb-2">Files</div>
            <div v-for="file in selected.attachments" :key="file.id" class="d-flex align-center gap-2 text-body-2 mb-1">
              <VIcon icon="tabler-paperclip" size="18" />
              {{ file.name }} · {{ formatFileSize(file.size) }}
            </div>
          </template>
        </VCardText>
      </VCard>
    </template>

    <template v-else-if="!loading">
      <VAlert v-if="selectedId" type="warning" variant="tonal" class="mb-4">
        That job isn't assigned to you.
        <template #append>
          <VBtn size="small" variant="text" @click="back">All jobs</VBtn>
        </template>
      </VAlert>
      <VCard>
        <VCardText>
          <VList v-if="jobs.length" lines="three" class="pa-0">
            <VListItem v-for="job in jobs" :key="job.id" @click="open(job.id)">
              <VListItemTitle class="font-weight-medium">{{ job.title }}</VListItemTitle>
              <VListItemSubtitle>{{ job.id }} · {{ job.service }} · {{ job.location }}</VListItemSubtitle>
              <VListItemSubtitle>{{ preview(job.description, 100) }}</VListItemSubtitle>
              <template #append>
                <VChip size="small" variant="tonal" color="primary" label>{{ formatDay(job.date) }}</VChip>
              </template>
            </VListItem>
          </VList>
          <p v-else-if="!error" class="text-medium-emphasis text-center py-8 mb-0">
            No jobs assigned to you yet. Xpro staff assign jobs to verified, available providers.
          </p>
        </VCardText>
      </VCard>
    </template>
  </div>
</template>

<style scoped>
.brief {
  white-space: pre-line;
}
</style>
