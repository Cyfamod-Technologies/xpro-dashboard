<script setup lang="ts">
import { serviceLines } from '@/features/workspace/config'
import ProviderCards from '@/features/discovery/ProviderCards.vue'
import { useOperationsStore } from '@/stores/operations'

defineProps<{ services?: boolean }>()

const route = useRoute()
const ops = useOperationsStore()
const service = ref(typeof route.query.service === 'string' ? route.query.service : '')
const city = ref('')
const search = ref('')
const available = ref(false)
const filtered = computed(() => ops.publicProviders.filter(item => (!service.value || item.services.includes(service.value as typeof item.services[number])) && (!city.value || item.city === city.value) && (!available.value || item.available) && `${item.name} ${item.trade} ${item.bio}`.toLowerCase().includes(search.value.toLowerCase())))
const cities = computed(() => [...new Set(ops.publicProviders.map(item => item.city))])
const selectedService = computed(() => serviceLines.find(item => item.name === service.value))
</script>

<template>
  <div class="mb-6">
    <div class="text-overline text-primary">
      EXPLORE XPRO
    </div><h1 class="text-h3 mb-3">
      {{ services ? 'Services for every stage' : 'Find your next provider' }}
    </h1><p class="text-body-1 text-medium-emphasis">
      Browse approved profiles and discover who can help. XPro reviews your request and coordinates provider assignment.
    </p>
  </div>
  <VRow
    v-if="services"
    class="mb-6"
  >
    <VCol
      v-for="item in serviceLines"
      :key="item.name"
      cols="12"
      sm="6"
      md="4"
    >
      <VCard
        :color="service === item.name ? 'primary' : undefined"
        :variant="service === item.name ? 'tonal' : 'elevated'"
        @click="service = item.name"
      >
        <VCardText>
          <VIcon
            :icon="item.icon"
            color="primary"
            class="mb-3"
          /><h2 class="text-h6 mb-2">
            {{ item.name }}
          </h2><p class="text-body-2 mb-0">
            {{ item.description }}
          </p>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
  <VCard
    v-if="selectedService"
    variant="tonal"
    color="primary"
    class="mb-6"
  >
    <VCardText class="d-flex justify-space-between align-center flex-wrap gap-4">
      <div>
        <h2 class="text-h5 mb-2">
          {{ selectedService.name }}
        </h2><p class="mb-0">
          {{ selectedService.description }}
        </p>
      </div><VBtn :to="{ path: '/request', query: { service } }">
        Request {{ selectedService.name.toLowerCase() }}
      </VBtn>
    </VCardText>
  </VCard>
  <VCard class="mb-6">
    <VCardText>
      <VRow>
        <VCol
          cols="12"
          md="4"
        >
          <VTextField
            v-model="search"
            label="Search providers"
            prepend-inner-icon="tabler-search"
            hide-details
            clearable
            @click:clear="search = ''"
          />
        </VCol><VCol
          cols="12"
          sm="6"
          md="4"
        >
          <VSelect
            v-model="service"
            :items="serviceLines.map(item => item.name)"
            label="Service"
            hide-details
            clearable
            @click:clear="service = ''"
          />
        </VCol><VCol
          cols="12"
          sm="6"
          md="4"
        >
          <VSelect
            v-model="city"
            :items="cities"
            label="Service area"
            hide-details
            clearable
            @click:clear="city = ''"
          />
        </VCol>
      </VRow><VCheckbox
        v-model="available"
        label="Available providers only"
        hide-details
      />
    </VCardText>
  </VCard>
  <p class="text-body-2 text-medium-emphasis mb-4">
    {{ filtered.length }} providers · Ratings and review counts are sample data.
  </p><ProviderCards :providers="filtered" />
</template>
