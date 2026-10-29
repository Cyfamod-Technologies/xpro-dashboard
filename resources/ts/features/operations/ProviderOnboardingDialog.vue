<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"
import { sectionPath } from "@/features/workspace/config"

const props = defineProps<{ ready: boolean }>()
const auth = useAuthStore()
const ops = useOperationsStore()
const open = ref(false)

const steps = [
  {
    icon: "tabler-user-circle",
    title: "Profile details",
    hint: "Your trade, location, phone number, experience and a short introduction.",
  },
  {
    icon: "tabler-tools",
    title: "Services, skills & coverage",
    hint: "What you offer, what you are skilled at and the areas you cover.",
  },
  {
    icon: "tabler-clock",
    title: "Working hours & capacity",
    hint: "The days you work and how many jobs you can run at once.",
  },
  {
    icon: "tabler-file-certificate",
    title: "Verification documents & face photo",
    hint: "Identity or business documents and a clear photo. Only XPro staff can see these.",
  },
  {
    icon: "tabler-building-bank",
    title: "Bank details",
    hint: "The account XPro pays you into once Finance has verified it.",
  },
]

// The profile only needs this nudge until it has been submitted for review.
const needsProfile = computed(() => !ops.profile || ops.profile.verification === "draft")
const seenKey = computed(() => (auth.user ? `xpro:provider-onboarding-seen:${auth.user.id}` : ""))

const wasSeen = () => {
  try {
    return Boolean(seenKey.value) && localStorage.getItem(seenKey.value) === "1"
  } catch {
    return false
  }
}

const markSeen = () => {
  try {
    if (seenKey.value) localStorage.setItem(seenKey.value, "1")
  } catch {
    // Storage can be unavailable (private windows); the dialog then simply shows again next time.
  }
}

watch(
  () => [props.ready, needsProfile.value] as const,
  ([ready, needed]) => {
    if (ready && needed && !open.value && !wasSeen()) {
      open.value = true
      markSeen()
    }
  },
  { immediate: true },
)
</script>

<template>
  <VDialog v-model="open" max-width="560" scrollable>
    <VCard class="onboarding-dialog">
      <VBtn
        icon="tabler-x"
        variant="text"
        size="small"
        class="onboarding-close"
        aria-label="Close"
        @click="open = false"
      />
      <div class="onboarding-hero text-center px-6 pt-8 pb-6">
        <VAvatar color="primary" variant="flat" size="64" class="mb-4">
          <VIcon icon="tabler-shield-check" size="32" color="white" />
        </VAvatar>
        <h2 class="text-h4 mb-2">Welcome to XPro, {{ auth.user?.firstName ?? "there" }}!</h2>
        <p class="text-body-1 text-medium-emphasis mb-0">
          Complete your profile and get verified so XPro can start matching you to jobs.
        </p>
      </div>
      <VCardText class="pt-5">
        <div class="text-overline mb-2">What you will need</div>
        <ol class="onboarding-steps">
          <li v-for="(step, index) in steps" :key="step.title" class="d-flex align-start gap-3">
            <VAvatar color="primary" variant="tonal" size="36" class="flex-shrink-0">
              <VIcon :icon="step.icon" size="20" />
            </VAvatar>
            <div>
              <div class="text-subtitle-1 font-weight-medium">{{ index + 1 }}. {{ step.title }}</div>
              <div class="text-body-2 text-medium-emphasis">
                {{ step.hint }}
              </div>
            </div>
          </li>
        </ol>
        <VAlert variant="tonal" color="info" density="comfortable" class="mt-5" icon="tabler-info-circle">
          Submit everything for XPro review. You will only receive job offers once your profile is approved.
        </VAlert>
      </VCardText>
      <VDivider />
      <VCardActions class="pa-4 flex-wrap justify-end gap-2">
        <VBtn variant="text" @click="open = false"> Maybe later </VBtn>
        <VBtn
          :to="sectionPath('provider', 'verification')"
          append-icon="tabler-arrow-right"
          @click="open = false"
        >
          Complete my profile
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.onboarding-dialog {
  position: relative;
}
.onboarding-close {
  position: absolute;
  inset-block-start: 0.5rem;
  inset-inline-end: 0.5rem;
  z-index: 1;
}
.onboarding-hero {
  background: linear-gradient(180deg, rgba(var(--v-theme-primary), 0.12), rgba(var(--v-theme-primary), 0));
}
.onboarding-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0;
  margin: 0;
  list-style: none;
}
</style>
