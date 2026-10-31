<script setup lang="ts">
import JobCard from "@/features/discovery/JobCard.vue"
import ServiceTabs from "@/features/discovery/ServiceTabs.vue"
import { serviceCoverAlt, serviceCoverImage } from "@/features/discovery/images"
import { usePublicServices } from "@/features/discovery/public-services"
import { popularJobsFor } from "@/features/discovery/popular-jobs"
import type { ServiceLine } from "@/features/operations/types"

const route = useRoute()
const router = useRouter()

const { services, ready } = usePublicServices()
const serviceNames = computed(() => services.value.map(item => item.name))

const handled = [
  {
    icon: "tabler-file-search",
    title: "Reviews your brief",
    body: "We check the details and ask a quick question if anything is missing.",
  },
  {
    icon: "tabler-user-check",
    title: "Assigns a verified provider",
    body: "We pick the right vetted provider for your job. You do not need to choose.",
  },
  {
    icon: "tabler-receipt",
    title: "Agrees the terms with you",
    body: "Discuss the price and start date with Xpro before the request is approved.",
  },
  {
    icon: "tabler-calendar-check",
    title: "Confirms a start date",
    body: "The agreed date is included in the approval.",
  },
]

// One service at a time. A legacy multi-value query (?service=A&service=B) falls back to its first valid service.
const readService = (): string => {
  const raw = route.query.service
  const list = Array.isArray(raw) ? raw : [raw]

  return (
    list.find((item): item is string => typeof item === "string" && serviceNames.value.includes(item)) ??
    serviceNames.value[0] ??
    ""
  )
}

const activeService = ref("")

// Once the catalog is in, take the service from the URL and normalise a legacy or unknown query to it.
watch(
  ready,
  isReady => {
    if (!isReady) return
    activeService.value = readService()
    if (route.query.service !== undefined && route.query.service !== activeService.value)
      router.replace({ query: { service: activeService.value } })
  },
  { immediate: true },
)

watch(activeService, (value, previous) => {
  if (previous && route.query.service !== value) router.replace({ query: { service: value } })
})

// URL -> tab (for example when following a footer link while on this page)
watch(
  () => route.query.service,
  () => {
    if (route.path !== "/services" || !ready.value) return
    const next = readService()

    if (next !== activeService.value) activeService.value = next
  },
)

const line = computed(() => services.value.find(item => item.name === activeService.value))
const service = computed(() => activeService.value as ServiceLine)
const jobs = computed(() => popularJobsFor(activeService.value))
</script>

<template>
  <section class="xp-container pt-8">
    <h1 class="text-h4 mb-1">Services</h1>
    <p class="text-body-1 text-medium-emphasis mb-6">
      Choose a service and tell us about the job. XPro assigns a verified provider for you.
    </p>
    <ServiceTabs v-model="activeService" />
  </section>

  <section v-if="ready && !services.length" class="xp-container pt-8">
    <p class="text-medium-emphasis mb-0">No services are open for requests right now. Please check back soon.</p>
  </section>

  <template v-if="line">
    <section :aria-label="`${line.name} service`" class="xp-container pt-8">
      <VCard variant="outlined">
        <div class="service-intro">
          <div class="service-intro__media">
            <img
              :src="serviceCoverImage(line.name)"
              :alt="serviceCoverAlt(line.name)"
              class="service-intro__img"
              width="640"
              height="320"
            />
          </div>
          <div class="service-intro__body">
            <h2 class="text-h4">
              {{ line.name }}
            </h2>
            <p class="text-body-1 text-medium-emphasis mb-0">
              {{ line.description }} Tell us what you need and XPro takes it from there.
            </p>
            <VBtn :to="{ path: '/request', query: { service: line.name } }" size="large">
              Request {{ line.name }}
            </VBtn>
          </div>
        </div>
      </VCard>
    </section>

    <section v-if="jobs.length" class="xp-container pt-10">
      <div class="mb-5">
        <h2 class="text-h5 mb-1">Popular {{ line.name.toLowerCase() }} jobs</h2>
        <p class="text-medium-emphasis mb-0">Tap a job to start your request with it filled in.</p>
      </div>
      <div class="job-grid">
        <JobCard v-for="job in jobs" :key="`${line.name}-${job.name}`" :service="service" :job="job" />
      </div>
    </section>
  </template>

  <section class="xp-container pt-10 pb-12">
    <h2 class="text-h5 mb-5">What XPro handles for you</h2>
    <ol class="handled-grid">
      <li v-for="(item, index) in handled" :key="item.title">
        <VCard variant="outlined" class="h-100">
          <VCardText class="d-flex gap-4">
            <VAvatar color="primary" variant="tonal" size="44">
              <VIcon :icon="item.icon" />
            </VAvatar>
            <div>
              <strong class="d-block mb-1">{{ index + 1 }}. {{ item.title }}</strong>
              <span class="text-body-2 text-medium-emphasis">{{ item.body }}</span>
            </div>
          </VCardText>
        </VCard>
      </li>
    </ol>
    <VCard v-if="line" color="primary" variant="tonal" class="mt-8">
      <VCardText class="on-tonal d-flex flex-wrap justify-space-between align-center gap-3">
        <span class="cta-copy"
          >Ready to start? Send your brief and XPro will assign a verified provider and send your quote. No consultation
          fee.</span
        >
        <VBtn :to="{ path: '/request', query: { service: line.name } }" size="large"> Request {{ line.name }} </VBtn>
      </VCardText>
    </VCard>
  </section>
</template>

<style lang="scss" scoped>
.service-intro {
  display: flex;
  flex-wrap: wrap;

  &__media {
    background: rgba(var(--v-theme-primary), 0.14);
    flex: 1 1 320px;
    min-block-size: 220px;
    position: relative;
  }

  &__img {
    block-size: 100%;
    inline-size: 100%;
    inset: 0;
    object-fit: cover;
    position: absolute;
  }

  &__body {
    align-items: flex-start;
    display: flex;
    flex: 1 1 360px;
    flex-direction: column;
    gap: 14px;
    justify-content: center;
    padding: 28px;
  }
}

.job-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
}

.handled-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.on-tonal {
  color: rgb(var(--v-theme-on-surface)) !important;
}

.cta-copy {
  max-inline-size: 620px;
}
</style>
