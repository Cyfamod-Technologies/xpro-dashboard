<script setup lang="ts">
import JobCard from "@/features/discovery/JobCard.vue"
import ServiceTabs from "@/features/discovery/ServiceTabs.vue"
import { serviceCoverAlt, serviceCoverImage } from "@/features/discovery/images"
import { usePublicServices } from "@/features/discovery/public-services"
import { popularJobsFor } from "@/features/discovery/popular-jobs"
import type { ServiceLine } from "@/features/operations/types"
import { store } from "@/mocks/v1/handlers"
import { isDemoMode } from "@/utils/demo-mode"

/**
 * Hero photo, shown behind a light-blue tonal overlay. Temporary 1024x764 image; a wider
 * ~2048x830 replacement can be dropped at the same path. Set to '' to fall back to the plain card.
 */
const heroImage: string = "/images/generated/hero/home-hero.jpg"

const route = useRoute()
const router = useRouter()

const { services } = usePublicServices()

// Construction leads the home page while the catalog has it; otherwise the first service.
const DEFAULT_SERVICE = "Construction"

const activeService = ref("")
const activeLine = computed(() => services.value.find(item => item.name === activeService.value))
const jobService = computed(() => activeService.value as ServiceLine)
const search = reactive({ service: "", title: "", city: "", start: "" })
const serviceNames = computed(() => services.value.map(item => item.name))
const jobs = computed(() => popularJobsFor(activeService.value))

// Live mode lists the catalog's own top-level services; demo mode keeps its fixed line.
const heroEyebrow = computed(() =>
  isDemoMode ? "Design · Construction · Hire · Procurement · Facility · Waste" : serviceNames.value.join(" · "),
)

const heroStyle = computed(() => (heroImage ? { "--hero-image": `url(${heroImage})` } : undefined))

const trust = [
  {
    title: "Verified providers",
    body: "Identity, skills and bank details are checked by XPro.",
    icon: "tabler-shield-check",
  },
  {
    title: "Clear decisions",
    body: "Review the provider, agreed price and start date before a request is approved.",
    icon: "tabler-credit-card",
  },
  {
    title: "One accountable team",
    body: "XPro reviews your request and coordinates next steps with you.",
    icon: "tabler-users-group",
  },
  { title: "No consultation fee", body: "Requesting and receiving a quote is free.", icon: "tabler-circle-check" },
]

const steps = [
  { icon: "tabler-search", title: "Choose a service", body: "Pick the service you need and start from a popular job." },
  {
    icon: "tabler-file-description",
    title: "Share your brief",
    body: "Tell us about the job. Sign in when you are ready to submit.",
  },
  {
    icon: "tabler-clipboard-check",
    title: "Follow your project",
    body: "XPro assigns a verified provider. Review quotes, confirm dates and track updates in your dashboard.",
  },
]

const verification = [
  {
    icon: "tabler-id",
    title: "Identity and documents checked",
    body: "Every provider submits identity and trade documents for XPro review.",
  },
  {
    icon: "tabler-tools",
    title: "Skills and service areas confirmed",
    body: "We confirm what each provider can do and where they work.",
  },
  {
    icon: "tabler-building-bank",
    title: "Bank details verified",
    body: "Service areas are confirmed so requests can be matched to available providers.",
  },
]

// Anonymised view of verified V1 providers: counts per service line, never names.
const network = computed(() => {
  const approved = store.publicProviders()

  return services.value.map(line => {
    const name = line.name as ServiceLine
    const offering = approved.filter(item => item.services.includes(name))

    return { name, count: offering.length, skills: [] as string[] }
  })
})

watch(activeService, value => {
  search.service = value
})

watch(
  serviceNames,
  names => {
    if (!names.includes(activeService.value))
      activeService.value = names.includes(DEFAULT_SERVICE) ? DEFAULT_SERVICE : (names[0] ?? "")
  },
  { immediate: true },
)

const clean = (query: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => [key, value.trim()]),
  )

const submit = () =>
  router.push({
    path: "/request",
    query: clean({ service: search.service, title: search.title, city: search.city, start: search.start }),
  })

const scrollToHash = () => {
  if (route.hash)
    nextTick(() => document.querySelector(route.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }))
}

onMounted(scrollToHash)
watch(() => route.hash, scrollToHash)
</script>

<template>
  <section class="xp-container pt-6">
    <div class="hero pa-6 pa-md-12" :class="{ 'hero--photo': heroImage }" :style="heroStyle">
      <p v-if="heroEyebrow" class="hero__eyebrow mb-4">{{ heroEyebrow }}</p>
      <h1 class="hero__title mb-4">Book trusted professionals for any building job.</h1>
      <p class="hero__copy mb-0">
        Request once. Xpro reviews the details with you, agrees a price and start date, then assigns a verified
        provider.
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

  <section v-if="activeLine" class="xp-container pt-8 pb-12">
    <div class="d-flex flex-wrap justify-space-between align-end gap-3 mb-5">
      <div v-if="jobs.length">
        <h2 class="text-h4 mb-1">Popular {{ activeLine.name.toLowerCase() }} jobs</h2>
        <p class="text-medium-emphasis mb-0">Tap a job to start your request with it filled in.</p>
      </div>
      <div v-else>
        <h2 class="text-h4 mb-1">{{ activeLine.name }}</h2>
        <p class="text-medium-emphasis mb-0">Tell us about the job and XPro assigns a verified provider.</p>
      </div>
      <RouterLink :to="{ path: '/services', query: { service: activeLine.name } }">
        All {{ activeLine.name.toLowerCase() }} services →
      </RouterLink>
    </div>
    <div v-if="jobs.length" class="job-grid">
      <JobCard v-for="job in jobs" :key="`${activeLine.name}-${job.name}`" :service="jobService" :job="job" />
    </div>
    <VCard v-else variant="outlined">
      <VCardText class="d-flex flex-wrap align-center justify-space-between gap-4 pa-6">
        <div>
          <strong class="d-block mb-1">{{ activeLine.name }}</strong>
          <span class="text-body-2 text-medium-emphasis">
            {{ activeLine.description || "Tell us what you need and XPro takes it from there." }}
          </span>
        </div>
        <VBtn :to="{ path: '/request', query: { service: activeLine.name } }" size="large">
          Request {{ activeLine.name }}
        </VBtn>
      </VCardText>
    </VCard>
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

  <section v-if="isDemoMode" id="network" aria-labelledby="network-title" class="xp-container pb-12">
    <div class="mb-5">
      <h2 id="network-title" class="text-h4 mb-1">Our verified network</h2>
      <p class="text-medium-emphasis mb-0">
        Every provider is vetted by XPro. You don’t need to choose — we assign the right one for your job.
      </p>
    </div>
    <div class="network-grid mb-6">
      <VCard v-for="item in network" :key="item.name" variant="outlined" class="network-card">
        <div class="network-card__media">
          <img
            :src="serviceCoverImage(item.name)"
            :alt="serviceCoverAlt(item.name)"
            class="network-card__img"
            loading="lazy"
            width="400"
            height="120"
          />
        </div>
        <VCardText class="d-flex flex-column gap-2">
          <strong class="text-h6">{{ item.name }}</strong>
          <VChip
            color="primary"
            variant="tonal"
            size="small"
            prepend-icon="tabler-shield-check"
            class="align-self-start"
          >
            {{ item.count }} verified {{ item.count === 1 ? "provider" : "providers" }}
          </VChip>
          <div v-if="item.skills.length" class="d-flex flex-wrap gap-1">
            <VChip v-for="skill in item.skills" :key="skill" size="small" variant="outlined">
              {{ skill }}
            </VChip>
          </div>
        </VCardText>
      </VCard>
    </div>
    <VCard color="primary" variant="tonal">
      <VCardText class="on-tonal verify-grid pa-6">
        <div v-for="step in verification" :key="step.title" class="d-flex align-start gap-4">
          <VAvatar color="primary" variant="flat" size="44">
            <VIcon :icon="step.icon" />
          </VAvatar>
          <div>
            <strong class="d-block mb-1">{{ step.title }}</strong>
            <span class="text-body-2">{{ step.body }}</span>
          </div>
        </div>
      </VCardText>
    </VCard>
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
          <img
            :src="serviceCoverImage('Construction')"
            :alt="`${serviceCoverAlt('Construction')} — XPro artisans at work`"
            class="join__img"
            loading="lazy"
            width="400"
            height="300"
          />
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

  // Decorative photo under the same light-blue tint as the plain card. The tint is near-opaque
  // behind the text (left) and thins out to the right so the image shows through. Alpha stops are
  // sized so the dark body copy keeps >= 4.5:1 over the photo where the text sits.
  &--photo {
    --hero-a0: 0.92;
    --hero-a1: 0.85;
    --hero-a2: 0.55;
    --hero-tint: color-mix(in srgb, rgb(var(--v-theme-primary)) 20%, rgb(var(--v-theme-surface)));

    background-color: var(--hero-tint);
    background-image:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--hero-tint) calc(var(--hero-a0) * 100%), transparent) 0%,
        color-mix(in srgb, var(--hero-tint) calc(var(--hero-a1) * 100%), transparent) 45%,
        color-mix(in srgb, var(--hero-tint) calc(var(--hero-a2) * 100%), transparent) 100%
      ),
      var(--hero-image);
    background-position:
      center,
      right center;
    background-repeat: no-repeat;
    background-size: cover;
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

// Each segment is a fixed-height flex row so the label + value pair sits centred
// (the VField otherwise leaves its leftover height below the text).
.seg {
  --seg-min: 64px;
  align-items: center;
  border-inline-start: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  display: flex;
  flex: 1 1 180px;
  min-block-size: var(--seg-min);
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

  :deep(.v-input) {
    flex: 1 1 auto;
    min-inline-size: 0;
  }

  // The floating label sits above the field box; reserve room for it so the
  // label + value pair (not just the value box) is what gets centred.
  :deep(.v-input__control) {
    padding-block-start: 10px;
  }

  // Icons sit on the value row (not the label row), so they centre with the text.
  :deep(.v-field__prepend-inner),
  :deep(.v-field__append-inner) {
    align-items: center;
    align-self: flex-end;
    block-size: 26px;
    padding-block: 0;
  }

  :deep(.v-field) {
    block-size: 33px;
  }

  // Same value-row height for text, select and the native date input.
  :deep(input.v-field__input) {
    block-size: 33px;
    line-height: 24px;
    min-block-size: 0;
  }

  :deep(input[type="date"]::-webkit-calendar-picker-indicator) {
    margin: 0;
    padding: 0;
  }
}

.go {
  block-size: auto !important;
  flex: 0 0 auto;
  font-size: 1rem;
  min-block-size: 64px;
  padding-inline: 28px !important;
}

.job-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
}

.network-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
}

.network-card {
  &__media {
    background: rgba(var(--v-theme-primary), 0.14);
    block-size: 120px;
  }

  &__img {
    block-size: 100%;
    display: block;
    inline-size: 100%;
    object-fit: cover;
  }
}

.verify-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.on-tonal {
  color: rgb(var(--v-theme-on-surface)) !important;
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
    background: rgba(var(--v-theme-primary), 0.14);
    flex: 1 1 280px;
    min-block-size: 180px;
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
    --seg-min: 60px;

    padding-block: 8px;
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
    min-block-size: 60px;
  }
}

// Below md the copy spans most of the card, so keep the tint heavier across the full width.
@media (max-width: 959px) {
  .hero--photo {
    --hero-a0: 0.94;
    --hero-a1: 0.92;
    --hero-a2: 0.85;
  }
}

@media (max-width: 600px) {
  .hero {
    min-block-size: 360px;
    padding-block-end: 96px !important;

    &--photo {
      background-position: center, center;
    }
  }
}
</style>
