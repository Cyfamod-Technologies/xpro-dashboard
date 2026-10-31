<script setup lang="ts">
import type { RequestGroupRef, RequestSibling } from "@/features/requests/api-types"
import { stageText } from "@/features/requests/request-groups"

/** On a request that was made together with others: the other requests in the same project. Detail data only. */
defineProps<{ group: RequestGroupRef; siblings: RequestSibling[] }>()
const route = useRoute()
</script>

<template>
  <VCard tag="section" class="mb-5" aria-labelledby="request-group-panel-title">
    <VCardText>
      <h3 id="request-group-panel-title" class="text-subtitle-1 mb-2">Part of {{ group.title }} ({{ group.ref }})</h3>
      <VList v-if="siblings.length" density="compact" class="pa-0" aria-label="Other services in this project">
        <VListItem
          v-for="sibling in siblings"
          :key="sibling.id"
          :to="{ path: route.path, query: { request: sibling.id } }"
          :title="sibling.title"
          :subtitle="`${sibling.serviceName} · ${stageText(sibling.stage)}`"
        />
      </VList>
      <p v-else class="text-body-2 text-medium-emphasis mb-0">No other requests are listed for this project.</p>
    </VCardText>
  </VCard>
</template>
