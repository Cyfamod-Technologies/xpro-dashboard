<script setup lang="ts">
import { initialsOf, isBlockingReason, reasonLabel } from "@/features/discovery/featured-providers"
import type { AdminFeaturedRow, AdminFeaturedState } from "@/features/discovery/featured-providers"
import { FeaturedProvidersApiError, featuredProvidersApi } from "@/services/featured-providers-api"

const state = ref<AdminFeaturedState>()
const pinnedIds = ref<string[]>([])
const hiddenIds = ref<string[]>([])
const loading = ref(true)
const loadError = ref("")
const saving = ref(false)
const saveError = ref("")
const conflict = ref(false)
const saved = ref(false)

const rowsById = computed(() => {
  const map = new Map<string, AdminFeaturedRow>()
  const current = state.value
  for (const row of [...(current?.candidates ?? []), ...(current?.pinned ?? []), ...(current?.hidden ?? [])])
    map.set(row.providerId, row)

  return map
})
const rowsOf = (ids: string[]) => ids.map(id => rowsById.value.get(id)).filter((row): row is AdminFeaturedRow => !!row)
const pinned = computed(() => rowsOf(pinnedIds.value))
const hidden = computed(() => rowsOf(hiddenIds.value))
const limit = computed(() => state.value?.limit ?? 0)
const atLimit = computed(() => pinnedIds.value.length >= limit.value)
const dirty = computed(() => {
  const current = state.value
  if (!current) return false

  return (
    pinnedIds.value.join("|") !== current.pinned.map(row => row.providerId).join("|") ||
    hiddenIds.value.join("|") !== current.hidden.map(row => row.providerId).join("|")
  )
})

const choices = computed(() =>
  (state.value?.candidates ?? [])
    .filter(row => !pinnedIds.value.includes(row.providerId) && !hiddenIds.value.includes(row.providerId))
    .map(row => ({
      title: `${row.name}${row.businessName ? ` (${row.businessName})` : ""} · ${row.trade}`,
      value: row.providerId,
    })),
)

const reset = (next: AdminFeaturedState) => {
  state.value = next
  pinnedIds.value = next.pinned.map(row => row.providerId)
  hiddenIds.value = next.hidden.map(row => row.providerId)
}

const load = async () => {
  loading.value = true
  loadError.value = ""
  saveError.value = ""
  conflict.value = false
  try {
    reset(await featuredProvidersApi.adminState())
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : "Featured providers could not be loaded."
  } finally {
    loading.value = false
  }
}

onMounted(load)

const pin = (id: string | null) => {
  if (id && !atLimit.value) pinnedIds.value = [...pinnedIds.value, id]
}
const unpin = (id: string) => {
  pinnedIds.value = pinnedIds.value.filter(item => item !== id)
}
const move = (index: number, offset: -1 | 1) => {
  const next = [...pinnedIds.value]
  const target = index + offset
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  pinnedIds.value = next
}
const hide = (id: string | null) => {
  if (id) hiddenIds.value = [...hiddenIds.value, id]
}
const unhide = (id: string) => {
  hiddenIds.value = hiddenIds.value.filter(item => item !== id)
}

const discard = () => {
  if (!state.value) return
  reset(state.value)
  saveError.value = ""
}

const save = async () => {
  if (!state.value || !dirty.value) return
  saving.value = true
  saveError.value = ""
  conflict.value = false
  try {
    reset(
      await featuredProvidersApi.save({
        revision: state.value.revision,
        pinned: pinnedIds.value,
        hidden: hiddenIds.value,
      }),
    )
    saved.value = true
  } catch (cause) {
    if (cause instanceof FeaturedProvidersApiError && cause.status === 409) conflict.value = true
    else saveError.value = cause instanceof Error ? cause.message : "Your changes could not be saved."
  } finally {
    saving.value = false
  }
}

const blocked = (row: AdminFeaturedRow) => row.ineligibleReasons.some(isBlockingReason)
</script>

<template>
  <div v-if="loading" class="d-flex justify-center py-10">
    <VProgressCircular indeterminate color="primary" aria-label="Loading featured providers" />
  </div>
  <VAlert v-else-if="loadError || !state" type="error" variant="tonal">
    <div class="d-flex flex-wrap align-center justify-space-between gap-3">
      <span>{{ loadError || "Featured providers could not be loaded." }}</span>
      <VBtn variant="outlined" color="error" @click="load"> Retry </VBtn>
    </div>
  </VAlert>
  <template v-else>
    <p class="text-body-2 text-medium-emphasis mb-5">
      Pinned providers show first in your order. Remaining slots (up to {{ limit }}) are filled automatically with
      approved, active providers who have a complete profile and no open reliability review or recent no-show, ranked by
      completed jobs and recent activity and spread across trades. Hidden providers never show.
    </p>

    <VAlert v-if="conflict" type="warning" variant="tonal" class="mb-5">
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>Someone else changed this list. Reload to see the latest.</span>
        <VBtn variant="outlined" color="warning" @click="load"> Reload </VBtn>
      </div>
    </VAlert>
    <VAlert v-if="saveError" type="error" variant="tonal" class="mb-5">
      {{ saveError }}
    </VAlert>

    <VRow>
      <VCol cols="12" lg="7">
        <VCard class="mb-5">
          <VCardText>
            <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3">
              <h2 class="text-h5">Pinned</h2>
              <span class="text-body-2 text-medium-emphasis">{{ pinnedIds.length }} of {{ limit }} pinned</span>
            </div>
            <VAlert v-if="!pinned.length" variant="tonal" color="info" class="mb-3">
              No providers pinned. The public page is filled automatically.
            </VAlert>
            <VList v-else lines="three" density="comfortable" class="py-0 mb-3">
              <VListItem v-for="(row, index) in pinned" :key="row.providerId" class="px-0">
                <template #title>
                  <strong>{{ row.name }}</strong>
                  <span v-if="row.businessName" class="text-medium-emphasis"> · {{ row.businessName }}</span>
                </template>
                <template #subtitle>
                  <div>{{ row.trade }} · {{ row.city }} · {{ row.completedJobs }} completed jobs</div>
                  <div v-if="row.ineligibleReasons.length" class="d-flex flex-wrap gap-1 mt-1">
                    <VChip
                      v-for="reason in row.ineligibleReasons"
                      :key="reason"
                      size="small"
                      variant="tonal"
                      :color="isBlockingReason(reason) ? 'error' : 'warning'"
                    >
                      {{ reasonLabel(reason) }}
                    </VChip>
                  </div>
                  <div v-if="blocked(row)" class="text-error mt-1">Not shown publicly</div>
                </template>
                <template #append>
                  <div class="d-flex flex-wrap justify-end align-center">
                    <VBtn
                      icon="tabler-arrow-up"
                      variant="text"
                      size="small"
                      :disabled="index === 0"
                      :aria-label="`Move ${row.name} up`"
                      @click="move(index, -1)"
                    />
                    <VBtn
                      icon="tabler-arrow-down"
                      variant="text"
                      size="small"
                      :disabled="index === pinned.length - 1"
                      :aria-label="`Move ${row.name} down`"
                      @click="move(index, 1)"
                    />
                    <VBtn variant="text" size="small" @click="unpin(row.providerId)"> Unpin </VBtn>
                  </div>
                </template>
              </VListItem>
            </VList>
            <VAutocomplete
              :model-value="null"
              :items="choices"
              label="Pin a provider"
              placeholder="Search name, business or trade"
              :disabled="atLimit"
              :hint="atLimit ? `Pin limit reached (${limit}). Unpin a provider to add another.` : undefined"
              persistent-hint
              no-data-text="No matching providers"
              @update:model-value="pin"
            />
          </VCardText>
        </VCard>

        <VCard>
          <VCardText>
            <h2 class="text-h5 mb-3">Hidden</h2>
            <VAlert v-if="!hidden.length" variant="tonal" color="info" class="mb-3">
              No providers hidden.
            </VAlert>
            <VList v-else lines="two" density="comfortable" class="py-0 mb-3">
              <VListItem v-for="row in hidden" :key="row.providerId" class="px-0">
                <template #title>
                  <strong>{{ row.name }}</strong>
                  <span v-if="row.businessName" class="text-medium-emphasis"> · {{ row.businessName }}</span>
                </template>
                <template #subtitle> {{ row.trade }} · {{ row.city }} </template>
                <template #append>
                  <VBtn variant="text" size="small" @click="unhide(row.providerId)"> Unhide </VBtn>
                </template>
              </VListItem>
            </VList>
            <VAutocomplete
              :model-value="null"
              :items="choices"
              label="Hide a provider"
              placeholder="Search name, business or trade"
              no-data-text="No matching providers"
              @update:model-value="hide"
            />
          </VCardText>
        </VCard>

        <div class="d-flex flex-wrap gap-3 mt-5">
          <VBtn :disabled="!dirty || saving" :loading="saving" @click="save"> Save changes </VBtn>
          <VBtn variant="outlined" :disabled="!dirty || saving" @click="discard"> Discard </VBtn>
        </div>
      </VCol>

      <VCol cols="12" lg="5">
        <VCard>
          <VCardText>
            <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-1">
              <h2 class="text-h5">Public page preview</h2>
              <a href="/providers" target="_blank" rel="noopener" class="text-body-2">Open public page</a>
            </div>
            <p class="text-body-2 text-medium-emphasis">
              The preview reflects the last saved state and refreshes after you save.
            </p>
            <VAlert v-if="!state.preview.length" variant="tonal" color="info">
              No providers would show on the public page right now.
            </VAlert>
            <VList v-else lines="two" density="comfortable" class="py-0">
              <VListItem v-for="item in state.preview" :key="item.id" class="px-0">
                <template #prepend>
                  <VAvatar color="primary" variant="tonal" size="40">
                    <VImg v-if="item.photoUrl" :src="item.photoUrl" :alt="`Photo of ${item.displayName}`" cover />
                    <span v-else aria-hidden="true">{{ initialsOf(item.displayName) }}</span>
                  </VAvatar>
                </template>
                <VListItemTitle>{{ item.displayName }}</VListItemTitle>
                <VListItemSubtitle>{{ item.trade }}</VListItemSubtitle>
                <template #append>
                  <VChip size="small" variant="tonal" :color="item.source === 'pinned' ? 'primary' : 'default'">
                    {{ item.source === "pinned" ? "Pinned" : "Automatic" }}
                  </VChip>
                </template>
              </VListItem>
            </VList>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VSnackbar v-model="saved" color="success" :timeout="3000"> Featured providers saved. </VSnackbar>
  </template>
</template>
