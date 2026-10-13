<script setup lang="ts">
import { serviceLines } from '@/features/workspace/config'
import ProviderCards from '@/features/discovery/ProviderCards.vue'
import ServiceTabs from '@/features/discovery/ServiceTabs.vue'
import { popularJobs } from '@/features/discovery/popular-jobs'
import type { PopularJob } from '@/features/discovery/popular-jobs'
import { useOperationsStore } from '@/stores/operations'

/** Drop a client photo into /public/images and set its path here, e.g. '/images/hero.jpg'. */
const heroImage: string = ''

const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()

const activeService = ref(serviceLines[1].name)
const search = reactive({ service: serviceLines[1].name, title: '', city: 'Abuja', start: '' })
const serviceNames = serviceLines.map(item => item.name)
const jobs = computed(() => popularJobs[activeService.value as keyof typeof popularJobs] ?? [])
const heroStyle = computed(() =>
  heroImage
    ? { backgroundImage: `linear-gradient(rgba(16, 42, 58, 0.62), rgba(16, 42, 58, 0.62)), url(${heroImage})` }
    : undefined,
)

const trust = [
  {
    title: 'Verified providers',
    body: 'Identity, skills and bank details are checked by XPro.',
    icon: 'tabler-shield-check',
  },
  {
    title: 'Payment held by XPro',
    body: 'Providers are paid only after you confirm the job is done.',
    icon: 'tabler-credit-card',
  },
  {
    title: 'One accountable team',
    body: 'XPro reviews every quote, schedule and update for you.',
    icon: 'tabler-users-group',
  },
  { title: 'No consultation fee', body: 'Requesting and receiving a quote is free.', icon: 'tabler-circle-check' },
]

const steps = [
  { icon: 'tabler-search', title: 'Explore', body: 'Find a service and view verified provider profiles.' },
  {
    icon: 'tabler-file-description',
    title: 'Share your brief',
    body: 'Tell us about the job. Sign in when you are ready to submit.',
  },
  {
    icon: 'tabler-clipboard-check',
    title: 'Follow your project',
    body: 'Review quotes, confirm dates and track updates in your dashboard.',
  },
]

watch(activeService, value => {
  search.service = value
})

const clean = (query: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => [key, value.trim()]),
  )
const submit = () =>
  router.push({
    path: '/request',
    query: clean({ service: search.service, title: search.title, city: search.city, start: search.start }),
  })
const jobLocation = (job: PopularJob) => ({
  path: '/request',
  query: { service: activeService.value, title: job.name, ...job.details },
})

const scrollToHash = () => {
  if (route.hash)
    nextTick(() => document.querySelector(route.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

onMounted(scrollToHash)
watch(() => route.hash, scrollToHash)
</script>

<template>
  <section class="xp-container pt-6">
    <div class="hero pa-6 pa-md-12" :class="{ 'hero--photo': heroImage }" :style="heroStyle">
      <p class="hero__eyebrow mb-4">Design · Construction · Hire · Procurement · Facility · Waste</p>
      <h1 class="hero__title mb-4">Book trusted professionals for any building job.</h1>
      <p class="hero__copy mb-0">
        Request once. XPro matches a verified provider, sends your quote and holds your payment until the job is done.
      </p>
    </div>
  </section>

  <div class="xp-container search-wrap">
    <VCard class="search-card" elevation="6">
      <VForm aria-label="Request a service" class="search-form" @submit.prevent="submit">
        <div class="seg">
          <VSelect
            v-model="search.service"
            :items="serviceNames"
            label="Service"
            prepend-inner-icon="tabler-building"
            variant="plain"
            density="comfortable"
            hide-details
            persistent-placeholder
          />
        </div>
        <div class="seg seg--grow">
          <VTextField
            v-model="search.title"
            label="What needs doing?"
            placeholder="e.g. Tile the living room"
            prepend-inner-icon="tabler-list"
            variant="plain"
            density="comfortable"
            hide-details
            persistent-placeholder
          />
        </div>
        <div class="seg">
          <VTextField
            v-model="search.city"
            label="Where"
            placeholder="e.g. Asokoro, Abuja"
            prepend-inner-icon="tabler-map-pin"
            variant="plain"
            density="comfortable"
            hide-details
            persistent-placeholder
          />
        </div>
        <div class="seg">
          <VTextField
            v-model="search.start"
            label="When"
            type="date"
            prepend-inner-icon="tabler-calendar"
            variant="plain"
            density="comfortable"
            hide-details
            persistent-placeholder
          />
        </div>
        <VBtn type="submit" size="x-large" class="go" prepend-icon="tabler-search"> Get a quote </VBtn>
      </VForm>
    </VCard>
  </div>

  <section class="xp-container pt-10">
    <ServiceTabs v-model="activeService" />
  </section>

  <section class="xp-container pt-8 pb-12">
    <div class="d-flex flex-wrap justify-space-between align-end gap-3 mb-5">
      <div>
        <h2 class="text-h4 mb-1">Popular {{ activeService.toLowerCase() }} jobs</h2>
        <p class="text-medium-emphasis mb-0">Tap a job to start your request with it filled in.</p>
      </div>
      <RouterLink :to="{ path: '/services', query: { service: activeService } }">
        All {{ activeService.toLowerCase() }} services →
      </RouterLink>
    </div>
    <div class="job-grid">
      <VCard v-for="job in jobs" :key="`${activeService}-${job.name}`" :to="jobLocation(job)" class="job-card">
        <div class="job-card__media">
          <VChip class="job-card__group" size="small" color="surface" variant="flat">
            {{ job.group }}
          </VChip>
          <VIcon :icon="job.icon" size="64" color="primary" />
        </div>
        <VCardText class="d-flex flex-column gap-1">
          <strong class="text-h6">{{ job.name }}</strong>
          <span class="text-body-2 text-medium-emphasis">{{ job.body }}</span>
          <span class="d-flex justify-space-between align-center pt-2 text-body-2">
            <span class="text-medium-emphasis">Free quote</span>
            <span class="font-weight-medium text-primary-darken-1">Request →</span>
          </span>
        </VCardText>
      </VCard>
    </div>
  </section>

  <section aria-label="Why XPro" class="xp-container pb-12">
    <VCard variant="outlined">
      <VCardText class="trust-grid pa-7">
        <div v-for="item in trust" :key="item.title" class="d-flex align-start gap-4">
          <VAvatar variant="outlined" color="primary" size="44">
            <VIcon :icon="item.icon" />
          </VAvatar>
          <div>
            <strong class="d-block mb-1">{{ item.title }}</strong>
            <span class="text-body-2 text-medium-emphasis">{{ item.body }}</span>
          </div>
        </div>
      </VCardText>
    </VCard>
  </section>

  <section id="providers" class="xp-container pb-12">
    <div class="d-flex flex-wrap justify-space-between align-end gap-3 mb-5">
      <h2 class="text-h4">Verified providers</h2>
      <RouterLink to="/providers"> View all providers → </RouterLink>
    </div>
    <ProviderCards :providers="ops.publicProviders.slice(0, 4)" />
  </section>

  <section id="how-it-works" class="xp-container pb-12">
    <h2 class="text-h4 mb-5">How it works</h2>
    <div class="steps-grid">
      <VCard v-for="(step, index) in steps" :key="step.title" variant="outlined">
        <VCardText class="d-flex gap-4">
          <VAvatar color="primary" variant="tonal" size="44">
            <VIcon :icon="step.icon" />
          </VAvatar>
          <div>
            <strong class="d-block mb-1">{{ index + 1 }}. {{ step.title }}</strong>
            <span class="text-body-2 text-medium-emphasis">{{ step.body }}</span>
          </div>
        </VCardText>
      </VCard>
    </div>
  </section>

  <section id="join" class="xp-container pb-14">
    <VCard variant="outlined">
      <div class="join">
        <div class="join__media">
          <VIcon icon="tabler-helmet" size="72" color="primary" />
        </div>
        <div class="join__body">
          <div class="join__text">
            <h2 class="text-h5 mb-2">Are you a professional, artisan or supplier?</h2>
            <p class="text-medium-emphasis mb-0">
              Join XPro free. Get verified, get matched to jobs near you and get paid through XPro.
            </p>
          </div>
          <VBtn to="/auth/signup?role=provider" size="large"> Become a provider </VBtn>
        </div>
      </div>
    </VCard>
  </section>
</template>

<style lang="scss" scoped>
.hero {
  background-color: rgba(var(--v-theme-primary), 0.2);
  background-image:
    linear-gradient(rgba(var(--v-theme-primary-darken-1), 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--v-theme-primary-darken-1), 0.12) 1px, transparent 1px);
  background-size: 28px 28px;
  border-radius: 6px;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 420px;
  padding-block-end: 112px !important;

  &--photo {
    background-position: center;
    background-size: cover;
    color: #fff;
  }

  &__eyebrow {
    color: rgb(var(--v-theme-secondary-darken-1));
    font-size: 0.875rem;
    font-weight: 600;
  }

  &__title {
    font-size: clamp(2.125rem, 4.4vw, 3.25rem);
    font-weight: 700;
    line-height: 1.12;
    max-inline-size: 640px;
  }

  &__copy {
    color: rgb(var(--v-theme-secondary-darken-1));
    font-size: 1.125rem;
    line-height: 1.6;
    max-inline-size: 540px;
  }

  &--photo &__eyebrow,
  &--photo &__copy {
    color: #fff;
  }
}

.search-wrap {
  margin-block-start: -64px;
  position: relative;
}

.search-card {
  margin-inline: 32px;
  padding: 8px;
}

.search-form {
  align-items: stretch;
  display: flex;
  flex-wrap: wrap;
}

.seg {
  border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  flex: 1 1 180px;
  min-inline-size: 0;
  padding: 10px 12px;

  &:first-child {
    border-inline-start: 0;
  }
  &--grow {
    flex-grow: 2;
  }
  &:hover {
    background: rgba(var(--v-theme-primary), 0.05);
  }
}

.go {
  block-size: 64px !important;
  flex: 0 0 auto;
  font-size: 1rem;
  padding-inline: 28px !important;
}

.job-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
}

.job-card {
  display: flex;
  flex-direction: column;

  &__media {
    align-items: center;
    background: rgba(var(--v-theme-primary), 0.14);
    block-size: 160px;
    display: flex;
    justify-content: center;
    position: relative;
  }

  &__group {
    inset-block-start: 12px;
    inset-inline-start: 12px;
    position: absolute;
  }
}

.trust-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
}

.steps-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.join {
  display: flex;
  flex-wrap: wrap;

  &__media {
    align-items: center;
    background: rgba(var(--v-theme-primary), 0.14);
    display: flex;
    flex: 1 1 280px;
    justify-content: center;
    min-block-size: 180px;
  }

  &__body {
    align-items: center;
    display: flex;
    flex: 2 1 420px;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;
    padding: 28px;
  }

  &__text {
    max-inline-size: 460px;
  }
}

@media (max-width: 860px) {
  .search-card {
    margin-inline: 0;
  }

  .seg {
    border-block-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-inline-start: 0;
    flex: 1 1 100%;

    &:first-child {
      border-block-start: 0;
    }
  }

  .go {
    flex: 1 1 100%;
    margin-block-start: 8px;
  }
}

@media (max-width: 600px) {
  .hero {
    min-block-size: 360px;
    padding-block-end: 96px !important;
  }
}
</style>
