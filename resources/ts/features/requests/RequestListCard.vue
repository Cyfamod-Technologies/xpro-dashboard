<script setup lang="ts">
import type { RequestSummary } from "@/features/requests/api-types"
import { nextActorLabel } from "@/features/requests/next-actor"

/** One request in the live list: its own status, stage label and link, whether or not it sits in a project group. */
defineProps<{ item: RequestSummary; section: string }>()
defineEmits<{ open: [id: string] }>()
</script>

<template>
  <VCard class="h-100"
    ><VCardText>
      <div class="d-flex justify-space-between ga-3 mb-3">
        <span class="text-medium-emphasis">{{ item.id }}</span
        ><VChip color="primary" variant="tonal">{{ item.statusLabel ?? item.stage }}</VChip>
      </div>
      <h3 class="text-h5 mb-2">{{ item.title || "Service request" }}</h3>
      <p class="text-medium-emphasis mb-4">
        {{ [item.service, item.locationLabel].filter(Boolean).join(" · ") }}
      </p>
      <p class="text-body-2">Next: {{ nextActorLabel(item.nextActor) }}</p>
      <VBtn variant="outlined" @click="$emit('open', item.id)">{{
        section === "quotes" ? "View quote" : section === "dispatch" ? "Dispatch" : "View request"
      }}</VBtn>
    </VCardText></VCard
  >
</template>
