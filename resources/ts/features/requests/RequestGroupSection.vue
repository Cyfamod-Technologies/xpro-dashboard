<script setup lang="ts">
import type { RequestSummary } from "@/features/requests/api-types"
import type { GroupEntry } from "@/features/requests/request-groups"
import { cancellableSiblings, planReviewAll, servicesLabel } from "@/features/requests/request-groups"
import RequestListCard from "@/features/requests/RequestListCard.vue"

/**
 * A project bundle in the request list (Spec 04 §4.1a): the project title, `XPG-nnnnn` ref and service count,
 * then each request as its own card. Each request keeps its own status, stage and link.
 */
const props = defineProps<{
  entry: GroupEntry<RequestSummary>
  section: string

  /** Customer: offer "Cancel all in this project". */
  canCancelAll: boolean

  /** Staff holding `request.review`: offer "Review all" when something in the group is in intake review. */
  canReviewAll: boolean
}>()
const emit = defineEmits<{ open: [id: string]; cancelAll: []; reviewAll: [] }>()

const headingId = computed(() => `request-group-${props.entry.groupId}`)
const hasCancellable = computed(() => cancellableSiblings(props.entry.items).length > 0)
const hasReviewable = computed(() => planReviewAll(props.entry.items).length > 0)
</script>

<template>
  <VCard tag="section" :aria-labelledby="headingId" variant="outlined">
    <VCardText>
      <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
        <div class="group-heading">
          <p class="text-body-2 text-medium-emphasis mb-1">
            {{ entry.ref }}<template v-if="entry.ref"> · </template>{{ servicesLabel(entry.items.length) }}
          </p>
          <h3 :id="headingId" class="text-h5 mb-0">{{ entry.title }}</h3>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <VBtn v-if="canReviewAll && hasReviewable" color="primary" @click="emit('reviewAll')">Review all</VBtn>
          <VBtn v-if="canCancelAll" color="error" variant="tonal" :disabled="!hasCancellable" @click="emit('cancelAll')"
            >Cancel all in this project</VBtn
          >
        </div>
      </div>
      <VRow>
        <VCol v-for="item in entry.items" :key="item.id" cols="12" md="6">
          <RequestListCard :item="item" :section="section" @open="emit('open', $event)" />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>

<style scoped>
.group-heading {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}
</style>
