<script setup lang="ts">
import type { LocationKind, LocationView } from "@/features/requests/api-types"
import { requestsApi } from "@/services/requests-api"

const props = defineProps<{ canManage: boolean }>()
const rows = ref<LocationView[]>([])
const states = ref<LocationView[]>([])
const parentLgas = ref<LocationView[]>([])
const path = ref<LocationView[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref("")
const notice = ref("")
const dialog = ref(false)
const editing = ref<LocationView | null>(null)
const kind = ref<LocationKind>("state")
const name = ref("")
const aliasesText = ref("")
const active = ref(true)
const serviceable = ref(false)
const sort = ref(0)
const stateId = ref("")
const parentId = ref("")

const parent = computed(() => {
  if (kind.value === "state") return undefined

  return kind.value === "lga"
    ? states.value.find(item => item.id === parentId.value)
    : parentLgas.value.find(item => item.id === parentId.value)
})
const parentUnavailable = computed(() => {
  if (!serviceable.value) return false
  const state = kind.value === "lga" ? parent.value : states.value.find(item => item.id === stateId.value)

  return Boolean(
    (state && (!state.active || !state.serviceable)) ||
    (kind.value === "area" && parent.value && (!parent.value.active || !parent.value.serviceable)),
  )
})
const currentKind = computed<LocationKind>(() => {
  const current = path.value.at(-1)

  if (!current) return "state"

  return current.kind === "state" ? "lga" : "area"
})
const currentParentId = computed(() => path.value.at(-1)?.id)
const parentLabel = computed(() => (kind.value === "lga" ? "State" : "LGA"))
const parentOptions = computed(() => (kind.value === "lga" ? states.value : parentLgas.value))
const pathLabel = computed(() => path.value.map(item => item.name).join(" / ") || "All states")

async function loadLevel(parentLocationId?: string) {
  loading.value = true
  error.value = ""
  try {
    const result = await requestsApi.adminLocations(parentLocationId)
    rows.value = result
    if (!parentLocationId) states.value = result
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Locations could not be loaded."
  } finally {
    loading.value = false
  }
}

async function loadParentLgas(parentStateId: string) {
  try {
    parentLgas.value = parentStateId ? await requestsApi.adminLocations(parentStateId) : []
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The parent locations could not be loaded."
    parentLgas.value = []
  }
}

async function openPlace(place: LocationView) {
  if (!place.hasChildren) return
  path.value = [...path.value, place]
  await loadLevel(place.id)
}

async function goTo(index: number) {
  path.value = path.value.slice(0, index + 1)
  await loadLevel(path.value.at(-1)?.id)
}

const goToStates = () => {
  path.value = []
  loadLevel()
}

function resetForm() {
  editing.value = null
  name.value = ""
  aliasesText.value = ""
  active.value = true
  serviceable.value = false
  sort.value = rows.value.length
  stateId.value = ""
  parentId.value = ""
}

async function openCreate() {
  resetForm()
  kind.value = currentKind.value
  if (kind.value === "lga") {
    stateId.value = currentParentId.value ?? ""
    parentId.value = currentParentId.value ?? ""
  } else if (kind.value === "area") {
    stateId.value = path.value[0]?.id ?? ""
    parentId.value = currentParentId.value ?? ""
    await loadParentLgas(stateId.value)
  }
  dialog.value = true
}

async function changeState(value: string | null) {
  stateId.value = value ?? ""
  parentId.value = ""
  await loadParentLgas(stateId.value)
}

async function openEdit(place: LocationView) {
  resetForm()
  editing.value = place
  kind.value = place.kind
  name.value = place.name
  aliasesText.value = place.aliases.join(", ")
  active.value = place.active
  serviceable.value = place.serviceable
  sort.value = place.sort
  parentId.value = place.parentId ?? ""
  if (place.kind === "lga") stateId.value = place.parentId ?? ""
  if (place.kind === "area") {
    stateId.value = path.value[0]?.id ?? ""
    await loadParentLgas(stateId.value)
  }
  dialog.value = true
}

async function save() {
  if (!name.value.trim() || (kind.value !== "state" && !parentId.value)) return
  saving.value = true
  error.value = ""
  notice.value = ""
  const body = {
    kind: kind.value,
    name: name.value.trim(),
    ...(kind.value === "state" ? {} : { parentId: parentId.value }),
    aliases: aliasesText.value
      .split(",")
      .map(value => value.trim())
      .filter(Boolean),
    active: active.value,
    serviceable: serviceable.value,
    sort: Math.max(0, Math.round(Number(sort.value) || 0)),
  }
  try {
    if (editing.value) await requestsApi.updateLocation(editing.value.id, body)
    else await requestsApi.createLocation(body)
    dialog.value = false
    notice.value = `${kind.value === "state" ? "State" : kind.value === "lga" ? "LGA" : "Area"} ${editing.value ? "updated" : "added"}.`
    await loadLevel(currentParentId.value)
    if (!path.value.length) states.value = rows.value
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The location could not be saved."
  } finally {
    saving.value = false
  }
}

watch(
  () => props.canManage,
  allowed => {
    if (allowed) loadLevel()
  },
  { immediate: true },
)
</script>

<template>
  <div class="location-management">
    <VAlert v-if="!canManage" type="warning" variant="tonal">
      You need the Settings management permission to view or change locations.
    </VAlert>
    <template v-else>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>
      <VAlert v-if="notice" type="success" variant="tonal" class="mb-4">{{ notice }}</VAlert>

      <VCard class="mb-5">
        <VCardText class="d-flex flex-wrap align-center justify-space-between ga-4">
          <div>
            <div class="text-overline text-primary">SERVICE COVERAGE</div>
            <h2 class="text-h5 mb-1">Locations</h2>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Manage the places customers can choose, from states down to service areas.
            </p>
          </div>
          <VBtn prepend-icon="tabler-plus" @click="openCreate">Add {{ currentKind }}</VBtn>
        </VCardText>
      </VCard>

      <VCard>
        <div class="location-toolbar pa-4 pa-sm-5">
          <div class="d-flex align-center flex-wrap ga-2">
            <VBtn variant="text" :disabled="!path.length" prepend-icon="tabler-map-2" @click="goToStates">
              All states
            </VBtn>
            <template v-for="(place, index) in path" :key="place.id">
              <VIcon icon="tabler-chevron-right" size="16" />
              <VBtn variant="text" :disabled="index === path.length - 1" @click="goTo(index)">
                {{ place.name }}
              </VBtn>
            </template>
          </div>
          <span class="text-body-2 text-medium-emphasis">{{ pathLabel }}</span>
        </div>

        <VProgressLinear v-if="loading" indeterminate />
        <VList v-if="rows.length" lines="two" class="py-0">
          <VListItem v-for="place in rows" :key="place.id" class="location-row">
            <template #title>
              <div class="d-flex align-center flex-wrap ga-2">
                <strong>{{ place.name }}</strong>
                <VChip size="x-small" variant="tonal">{{ place.kind.toUpperCase() }}</VChip>
                <VChip size="x-small" :color="place.active ? 'success' : 'default'" variant="tonal">
                  {{ place.active ? "Active" : "Inactive" }}
                </VChip>
                <VChip size="x-small" :color="place.serviceable ? 'primary' : 'default'" variant="tonal">
                  {{ place.serviceable ? "Served" : "Not served" }}
                </VChip>
              </div>
            </template>
            <template #subtitle>
              {{ place.aliases.length ? `Also known as ${place.aliases.join(", ")}` : "No alternate names" }}
            </template>
            <template #append>
              <div class="d-flex align-center ga-1">
                <VBtn
                  v-if="place.hasChildren"
                  icon="tabler-chevron-right"
                  variant="text"
                  :aria-label="`Open ${place.name}`"
                  @click="openPlace(place)"
                />
                <VBtn icon="tabler-edit" variant="text" :aria-label="`Edit ${place.name}`" @click="openEdit(place)" />
              </div>
            </template>
          </VListItem>
        </VList>
        <VCardText v-else-if="!loading" class="text-medium-emphasis">
          No {{ currentKind === "state" ? "states" : currentKind === "lga" ? "LGAs" : "areas" }} here yet. Add the first
          one to open service in this {{ path.at(-1)?.kind ?? "country" }}.
        </VCardText>
      </VCard>

      <VAlert type="info" variant="tonal" class="mt-4">
        A place appears in the customer form only when it and every parent are active and marked as served.
      </VAlert>

      <VDialog v-model="dialog" max-width="620">
        <VCard>
          <VCardTitle class="pa-5">{{ editing ? `Edit ${editing.name}` : `Add ${kind}` }}</VCardTitle>
          <VCardText class="d-flex flex-column ga-3">
            <VTextField :model-value="kind.toUpperCase()" label="Location type" readonly />
            <template v-if="kind === 'area'">
              <VSelect
                v-model="stateId"
                :items="states.map(item => ({ title: item.name, value: item.id }))"
                label="State *"
                :disabled="saving"
                @update:model-value="changeState"
              />
            </template>
            <VSelect
              v-if="kind !== 'state'"
              v-model="parentId"
              :items="parentOptions.map(item => ({ title: item.name, value: item.id }))"
              :label="`${parentLabel} *`"
              :disabled="saving || (kind === 'area' && !stateId)"
            />
            <VTextField v-model="name" label="Name *" maxlength="100" :disabled="saving" />
            <VTextarea
              v-model="aliasesText"
              label="Alternate names"
              hint="Separate aliases with commas."
              persistent-hint
              rows="2"
              :disabled="saving"
            />
            <VTextField v-model="sort" label="Sort order" type="number" min="0" :disabled="saving" />
            <div class="d-flex flex-wrap ga-6">
              <VSwitch v-model="active" label="Active" color="success" hide-details :disabled="saving" />
              <VSwitch v-model="serviceable" label="Served by XPro" color="primary" hide-details :disabled="saving" />
            </div>
            <VAlert v-if="parentUnavailable" type="warning" variant="tonal" density="compact">
              This place is marked as served, but a parent is inactive or not served. Customers still won’t see it until
              every parent is active and served too.
            </VAlert>
          </VCardText>
          <VCardActions class="px-5 pb-5">
            <VSpacer />
            <VBtn variant="text" :disabled="saving" @click="dialog = false">Cancel</VBtn>
            <VBtn :loading="saving" :disabled="!name.trim() || (kind !== 'state' && !parentId)" @click="save">
              {{ editing ? "Save changes" : "Add location" }}
            </VBtn>
          </VCardActions>
        </VCard>
      </VDialog>
    </template>
  </div>
</template>

<style scoped>
.location-toolbar {
  align-items: center;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  justify-content: space-between;
}

.location-row + .location-row {
  border-block-start: 1px solid rgba(var(--v-border-color), 0.12);
}
</style>
