<script setup lang="ts">
import { useDisplay } from 'vuetify'
import { serviceLines } from '@/features/workspace/config'
import ProviderResultCard from '@/features/discovery/ProviderResultCard.vue'
import ServiceTabs from '@/features/discovery/ServiceTabs.vue'
import type { PublicProvider } from '@/features/discovery/provider-utils'
import { useOperationsStore } from '@/stores/operations'

type Sort = 'recommended' | 'experience' | 'available'
type Experience = '0' | '5' | '10'

defineProps<{ services?: boolean }>()

const route = useRoute()
const router = useRouter()
const display = useDisplay()
const ops = useOperationsStore()

const serviceNames = serviceLines.map(item => item.name)

const sorts: { value: Sort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'available', label: 'Available now' },
]

const experiences: { value: Experience; label: string }[] = [
  { value: '0', label: 'Any' },
  { value: '5', label: '5+ years' },
  { value: '10', label: '10+ years' },
]

const text = (value: unknown) => typeof value === 'string' ? value : ''

const readQuery = () => {
  const raw = route.query.service
  const list = (Array.isArray(raw) ? raw : [raw]).filter((item): item is string => typeof item === 'string' && serviceNames.includes(item))
  const sort = text(route.query.sort)
  const exp = text(route.query.exp)

  return {
    services: [...new Set(list)],
    q: text(route.query.q),
    area: text(route.query.area),
    available: route.query.available === '1' || route.query.available === 'true',
    exp: (['5', '10'].includes(exp) ? exp : '0') as Experience,
    sort: (['experience', 'available'].includes(sort) ? sort : 'recommended') as Sort,
  }
}

const filters = reactive(readQuery())
const openPanels = ref(display.mdAndUp.value ? [0, 1, 2] : [])
const resultsRef = ref<HTMLElement>()

const toQuery = () => ({
  ...(filters.services.length ? { service: filters.services } : {}),
  ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
  ...(filters.area.trim() ? { area: filters.area.trim() } : {}),
  ...(filters.available ? { available: '1' } : {}),
  ...(filters.exp !== '0' ? { exp: filters.exp } : {}),
  ...(filters.sort !== 'recommended' ? { sort: filters.sort } : {}),
})

const sameQuery = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b)

// Filters -> URL
watch(filters, () => {
  if (!sameQuery(readQuery(), filters))
    router.replace({ query: toQuery() })
}, { deep: true })

// URL -> filters (for example when following a footer link while on this page)
watch(() => route.query, () => {
  if (route.path !== '/services' && route.path !== '/providers')
    return
  const next = readQuery()

  if (!sameQuery(next, filters))
    Object.assign(filters, next)
})

const matches = (item: PublicProvider, skipService = false) => {
  const term = filters.q.trim().toLowerCase()
  const area = filters.area.trim().toLowerCase()

  return (skipService || !filters.services.length || filters.services.some(service => item.services.includes(service as PublicProvider['services'][number])))
    && (!term || `${item.name} ${item.trade} ${item.bio} ${item.services.join(' ')}`.toLowerCase().includes(term))
    && (!area || item.city.toLowerCase().includes(area))
    && ((!filters.available && filters.sort !== 'available') || item.available)
    && item.experience >= Number(filters.exp)
}

const results = computed(() => {
  const list = ops.publicProviders.filter(item => matches(item))
  const recommended = (a: PublicProvider, b: PublicProvider) => b.rating - a.rating || b.reviewCount - a.reviewCount

  return [...list].sort(filters.sort === 'experience' ? (a, b) => b.experience - a.experience || recommended(a, b) : recommended)
})

const counts = computed(() => Object.fromEntries(serviceNames.map(name => [name, ops.publicProviders.filter(item => matches(item, true) && item.services.includes(name as PublicProvider['services'][number])).length])))

const tabService = computed({
  get: () => filters.services.length === 1 ? filters.services[0] : filters.services.length ? undefined : '',
  set: value => { filters.services = value ? [value] : [] },
})

const topServices = computed({
  get: () => filters.services,
  set: value => { filters.services = value },
})

const selectedLine = computed(() => filters.services.length === 1 ? serviceLines.find(item => item.name === filters.services[0]) : undefined)

const heading = computed(() => {
  const count = results.value.length
  const parts = [`${count} verified ${count === 1 ? 'provider' : 'providers'}`]

  if (filters.services.length)
    parts.push(`for ${filters.services.join(' and ')}`)
  if (filters.area.trim())
    parts.push(`in ${filters.area.trim()}`)

  return parts.join(' ')
})

const matchLocation = computed(() => ({ path: '/request', query: filters.services.length === 1 ? { service: filters.services[0] } : {} }))

const reset = () => Object.assign(filters, { services: [], q: '', area: '', available: false, exp: '0', sort: 'recommended' })
const search = () => resultsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const toggleService = (name: string, on: boolean | null) => {
  filters.services = on ? [...filters.services, name] : filters.services.filter(item => item !== name)
}
</script>

<template>
  <section class="search-band">
    <VForm
      aria-label="Search providers"
      class="xp-container search-fields"
      @submit.prevent="search"
    >
      <VSelect
        v-model="topServices"
        :items="serviceNames"
        label="Service"
        placeholder="Any service"
        persistent-placeholder
        multiple
        clearable
        hide-details
        class="field field--service"
      >
        <template #selection="{ item, index }">
          <span v-if="index === 0">{{ filters.services.length > 1 ? `${filters.services.length} services` : item.title }}</span>
        </template>
      </VSelect>
      <VTextField
        v-model="filters.q"
        label="Name, trade or skill"
        placeholder="e.g. tiler, structural engineer"
        persistent-placeholder
        prepend-inner-icon="tabler-search"
        clearable
        hide-details
        class="field field--grow"
      />
      <VTextField
        v-model="filters.area"
        label="Area"
        placeholder="e.g. Abuja"
        persistent-placeholder
        prepend-inner-icon="tabler-map-pin"
        clearable
        hide-details
        class="field"
      />
      <VBtn
        type="submit"
        size="large"
        class="go"
        prepend-icon="tabler-search"
      >
        Search
      </VBtn>
    </VForm>
  </section>

  <div
    v-if="services"
    class="xp-container pt-6"
  >
    <ServiceTabs
      v-model="tabService"
      all
    />
  </div>

  <div class="xp-container layout pt-6 pb-12">
    <aside
      aria-label="Filters"
      class="d-flex flex-column gap-4"
    >
      <VCard>
        <VCardText class="d-flex justify-space-between align-center py-3">
          <strong>Filters</strong>
          <VBtn
            variant="text"
            size="small"
            @click="reset"
          >
            Reset
          </VBtn>
        </VCardText>
      </VCard>
      <VExpansionPanels
        v-model="openPanels"
        multiple
        variant="accordion"
        class="filter-panels"
      >
        <VExpansionPanel title="Service">
          <VExpansionPanelText>
            <div
              v-for="name in serviceNames"
              :key="name"
              class="d-flex justify-space-between align-center"
            >
              <VCheckbox
                :model-value="filters.services.includes(name)"
                :label="name"
                density="compact"
                hide-details
                class="flex-grow-1"
                @update:model-value="toggleService(name, $event)"
              />
              <span class="text-body-2 text-medium-emphasis">{{ counts[name] }}</span>
            </div>
          </VExpansionPanelText>
        </VExpansionPanel>
        <VExpansionPanel title="Availability">
          <VExpansionPanelText>
            <VCheckbox
              v-model="filters.available"
              label="Available for requests"
              density="compact"
              hide-details
            />
          </VExpansionPanelText>
        </VExpansionPanel>
        <VExpansionPanel title="Experience">
          <VExpansionPanelText>
            <VRadioGroup
              v-model="filters.exp"
              density="compact"
              hide-details
              aria-label="Experience"
            >
              <VRadio
                v-for="item in experiences"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </VRadioGroup>
          </VExpansionPanelText>
        </VExpansionPanel>
      </VExpansionPanels>
    </aside>

    <section
      ref="resultsRef"
      aria-label="Results"
      class="d-flex flex-column gap-4 min-w-0"
    >
      <div class="d-flex flex-wrap justify-space-between align-baseline gap-2">
        <h1 class="text-h5">
          {{ heading }}
        </h1>
        <span class="text-body-2 text-medium-emphasis">Only XPro-verified providers are listed.</span>
      </div>
      <p
        v-if="selectedLine"
        class="text-body-2 text-medium-emphasis mb-0"
      >
        {{ selectedLine.name }}: {{ selectedLine.description }}
      </p>
      <VCard>
        <VTabs
          v-model="filters.sort"
          aria-label="Sort"
          color="primary-darken-1"
          grow
          hide-slider
          class="sort-tabs"
        >
          <VTab
            v-for="item in sorts"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </VTab>
        </VTabs>
      </VCard>

      <template v-if="results.length">
        <ProviderResultCard
          v-for="provider in results"
          :key="provider.id"
          :provider="provider"
          :selected-services="filters.services"
        />
      </template>
      <VCard v-else>
        <VCardText class="text-center py-10">
          <VAvatar
            color="primary"
            variant="tonal"
            size="64"
            class="mb-4"
          >
            <VIcon
              icon="tabler-search-off"
              size="32"
            />
          </VAvatar>
          <h2 class="text-h6 mb-2">
            No providers match these filters
          </h2>
          <p class="text-medium-emphasis mb-5">
            Try another service or area, or let XPro match you with a verified provider.
          </p>
          <div class="d-flex flex-wrap justify-center gap-3">
            <VBtn
              variant="outlined"
              @click="reset"
            >
              Reset filters
            </VBtn>
            <VBtn :to="matchLocation">
              Let XPro match me
            </VBtn>
          </div>
        </VCardText>
      </VCard>

      <VCard
        color="primary"
        variant="tonal"
      >
        <VCardText class="on-tonal d-flex flex-wrap justify-space-between align-center gap-3">
          <span class="match-copy">Not sure who to choose? Send your brief without a provider. XPro will match the right verified provider for you.</span>
          <VBtn
            :to="matchLocation"
            variant="outlined"
            class="bg-surface"
          >
            Let XPro match me
          </VBtn>
        </VCardText>
      </VCard>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.search-band {
  background: rgb(var(--v-theme-surface));
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.search-fields {
  align-items: stretch;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-block: 16px;
}

.field {
  flex: 1 1 200px;
  min-inline-size: 0;

  &--grow { flex-grow: 2; flex-basis: 260px; }
}

.go {
  block-size: 56px !important;
  flex: 0 0 160px;
}

.layout {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: 280px minmax(0, 1fr);
}

.filter-panels :deep(.v-expansion-panel-title) { font-weight: 600; }

.sort-tabs {
  :deep(.v-tab) { letter-spacing: normal; min-inline-size: 0; padding-inline: 8px; text-transform: none; }
  :deep(.v-tab--selected) { background: rgba(var(--v-theme-primary), 0.14); border-radius: 6px; }
}

.on-tonal { color: rgb(var(--v-theme-on-surface)) !important; }

.match-copy { max-inline-size: 620px; }

@media (max-width: 960px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 600px) {
  .sort-tabs :deep(.v-tab) { font-size: 0.8125rem; padding-inline: 6px; }

  .field,
  .go { flex: 1 1 100%; }
}
</style>
