<script setup lang="ts">
import { initialsOf, isBlockingReason, reasonLabel } from "@/features/discovery/featured-providers"
import type { AdminFeaturedRow, AdminFeaturedState } from "@/features/discovery/featured-providers"
import { automaticSlots, changeCount, matchesSearch, moveId } from "@/features/operations/featured-slots"
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

const search = ref("")
const pool = computed(() =>
  (state.value?.candidates ?? []).filter(
    row =>
      !pinnedIds.value.includes(row.providerId) &&
      !hiddenIds.value.includes(row.providerId) &&
      matchesSearch(row, search.value),
  ),
)
const freeSlots = computed(() => automaticSlots(limit.value, pinnedIds.value.length))
const edits = computed(() => {
  const current = state.value
  if (!current) return 0

  return (
    changeCount(
      current.pinned.map(row => row.providerId),
      pinnedIds.value,
    ) +
    changeCount(
      current.hidden.map(row => row.providerId),
      hiddenIds.value,
    )
  )
})

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

const pin = (id: string) => {
  if (!atLimit.value) pinnedIds.value = [...pinnedIds.value, id]
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
const hide = (id: string) => {
  hiddenIds.value = [...hiddenIds.value, id]
}
const unhide = (id: string) => {
  hiddenIds.value = hiddenIds.value.filter(item => item !== id)
}

const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)
const drop = (to: number) => {
  if (dragFrom.value !== null) pinnedIds.value = moveId(pinnedIds.value, dragFrom.value, to)
  dragFrom.value = null
  dragOver.value = null
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
    <p class="text-body-2 text-medium-emphasis mb-1">
      Pin providers to the slots you want. Empty slots are filled automatically.
    </p>
    <VExpansionPanels variant="accordion" class="mb-5 featured-help">
      <VExpansionPanel title="How automatic filling works" elevation="0">
        <VExpansionPanelText>
          Pinned providers show first, in your order. Remaining slots (up to {{ limit }}) are filled with approved,
          active providers who have a complete profile and no open reliability review or recent no-show, ranked by
          completed jobs and recent activity and spread across trades. Hidden providers never show.
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>

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
      <VCol cols="12" md="6">
        <VCard>
          <VCardText>
            <h2 class="text-h5 mb-3">Providers</h2>
            <AppTextField
              v-model="search"
              placeholder="Search name, business, trade or city"
              prepend-inner-icon="tabler-search"
              clearable
              class="mb-3"
              aria-label="Search providers"
            />
            <p v-if="!pool.length" class="text-body-2 text-medium-emphasis mb-0">
              {{ search ? "No providers match your search." : "Every provider is pinned or hidden." }}
            </p>
            <div v-for="row in pool" :key="row.providerId" class="pool-row">
              <VAvatar color="primary" variant="tonal" size="36">
                <span aria-hidden="true">{{ initialsOf(row.name) }}</span>
              </VAvatar>
              <div class="flex-grow-1 min-width-0">
                <div class="text-body-2 font-weight-medium text-truncate">
                  {{ row.name
                  }}<span v-if="row.businessName" class="text-medium-emphasis"> · {{ row.businessName }}</span>
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ row.trade }} · {{ row.city }} · {{ row.completedJobs }} jobs
                </div>
                <div v-if="row.ineligibleReasons.length" class="d-flex flex-wrap gap-1 mt-1">
                  <VChip
                    v-for="reason in row.ineligibleReasons"
                    :key="reason"
                    size="x-small"
                    variant="tonal"
                    :color="isBlockingReason(reason) ? 'error' : 'warning'"
                  >
                    {{ reasonLabel(reason) }}
                  </VChip>
                </div>
              </div>
              <div class="d-flex flex-column align-end">
                <VBtn
                  variant="outlined"
                  size="small"
                  :disabled="atLimit"
                  :aria-label="`Pin ${row.name}`"
                  @click="pin(row.providerId)"
                >
                  Pin
                </VBtn>
                <VBtn variant="text" size="x-small" :aria-label="`Hide ${row.name}`" @click="hide(row.providerId)">
                  Hide
                </VBtn>
              </div>
            </div>
            <p v-if="atLimit" class="text-caption text-medium-emphasis mt-2 mb-0">
              All {{ limit }} slots are pinned. Unpin a provider to add another.
            </p>

            <template v-if="hidden.length">
              <VDivider class="my-4" />
              <h3 class="text-subtitle-1 mb-2">Hidden ({{ hidden.length }})</h3>
              <div v-for="row in hidden" :key="row.providerId" class="pool-row">
                <div class="flex-grow-1 min-width-0">
                  <div class="text-body-2 text-truncate">{{ row.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ row.trade }} · {{ row.city }}</div>
                </div>
                <VBtn variant="text" size="small" @click="unhide(row.providerId)"> Unhide </VBtn>
              </div>
            </template>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="6">
        <VCard>
          <VCardText>
            <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3">
              <h2 class="text-h5">Public page slots</h2>
              <span class="text-body-2 text-medium-emphasis">{{ pinnedIds.length }} of {{ limit }} pinned</span>
            </div>
            <div
              v-for="(row, index) in pinned"
              :key="row.providerId"
              class="slot"
              :class="{ 'slot--over': dragOver === index && dragFrom !== index }"
              draggable="true"
              @dragstart="dragFrom = index"
              @dragover.prevent="dragOver = index"
              @dragleave="dragOver = null"
              @drop.prevent="drop(index)"
              @dragend="((dragFrom = null), (dragOver = null))"
            >
              <span class="slot-number">{{ index + 1 }}</span>
              <VIcon icon="tabler-menu-2" size="18" class="text-disabled slot-grip" aria-hidden="true" />
              <div class="flex-grow-1 min-width-0">
                <div class="text-body-2 font-weight-medium text-truncate">
                  {{ row.name
                  }}<span v-if="row.businessName" class="text-medium-emphasis"> · {{ row.businessName }}</span>
                </div>
                <div class="text-caption text-medium-emphasis">{{ row.trade }} · {{ row.city }}</div>
                <div v-if="row.ineligibleReasons.length" class="d-flex flex-wrap gap-1 mt-1">
                  <VChip
                    v-for="reason in row.ineligibleReasons"
                    :key="reason"
                    size="x-small"
                    variant="tonal"
                    :color="isBlockingReason(reason) ? 'error' : 'warning'"
                  >
                    {{ reasonLabel(reason) }}
                  </VChip>
                  <VChip v-if="blocked(row)" size="x-small" color="error">Not shown publicly</VChip>
                </div>
              </div>
              <div class="d-flex align-center">
                <VBtn
                  icon="tabler-arrow-up"
                  variant="text"
                  size="x-small"
                  :disabled="index === 0"
                  :aria-label="`Move ${row.name} up`"
                  @click="move(index, -1)"
                />
                <VBtn
                  icon="tabler-arrow-down"
                  variant="text"
                  size="x-small"
                  :disabled="index === pinned.length - 1"
                  :aria-label="`Move ${row.name} down`"
                  @click="move(index, 1)"
                />
                <VBtn variant="text" size="small" @click="unpin(row.providerId)"> Unpin </VBtn>
              </div>
            </div>
            <div
              v-for="n in freeSlots"
              :key="`free-${n}`"
              class="slot slot--empty"
              @dragover.prevent="dragOver = pinnedIds.length - 1"
              @drop.prevent="drop(pinnedIds.length - 1)"
            >
              <span class="slot-number">{{ pinnedIds.length + n }}</span>
              <span class="text-body-2 text-medium-emphasis">Filled automatically</span>
            </div>
          </VCardText>
        </VCard>

        <VExpansionPanels variant="accordion" class="mt-5">
          <VExpansionPanel elevation="0">
            <VExpansionPanelTitle>
              <span class="text-subtitle-1">Public page preview</span>
              <span class="text-caption text-medium-emphasis ms-2">last saved</span>
            </VExpansionPanelTitle>
            <VExpansionPanelText>
              <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-2">
                <span class="text-body-2 text-medium-emphasis">Refreshes after you save.</span>
                <a href="/providers" target="_blank" rel="noopener" class="text-body-2">Open public page</a>
              </div>
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
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCol>
    </VRow>

    <div class="save-bar" :class="{ 'save-bar--dirty': dirty }" role="status">
      <span class="text-body-2">{{
        dirty ? `${edits} unsaved ${edits === 1 ? "change" : "changes"}` : "No unsaved changes"
      }}</span>
      <div class="d-flex gap-2">
        <VBtn variant="outlined" size="small" :disabled="!dirty || saving" @click="discard"> Discard </VBtn>
        <VBtn size="small" :disabled="!dirty || saving" :loading="saving" @click="save"> Save changes </VBtn>
      </div>
    </div>

    <VSnackbar v-model="saved" color="success" :timeout="3000"> Featured providers saved. </VSnackbar>
  </template>
</template>

<style scoped>
.pool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.pool-row:first-of-type {
  border-top: none;
}

.slot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.slot[draggable="true"] {
  cursor: grab;
}

.slot--over {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.slot--empty {
  border-style: dashed;
}

.slot-number {
  width: 20px;
  flex: none;
  text-align: center;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.save-bar {
  position: sticky;
  bottom: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding: 10px 16px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.save-bar--dirty {
  border-color: rgb(var(--v-theme-primary));
}
</style>
