<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import ProviderReview from "@/features/operations/ProviderReview.vue"
import FeaturedProvidersPanel from "@/features/operations/FeaturedProvidersPanel.vue"

const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()

// Featured providers use the live API, so the tab needs the `provider.review` permission and a non-demo session.
const canFeature = computed(() => !isDemoMode && ops.can("provider.review"))
const tab = computed<"review" | "featured">({
  get: () => (route.query.tab === "featured" && canFeature.value ? "featured" : "review"),
  set: value => {
    const query = { ...route.query }

    if (value === "featured") query.tab = "featured"
    else delete query.tab
    router.replace({ query })
  },
})
</script>

<template>
  <template v-if="canFeature">
    <VTabs v-model="tab" class="mb-6">
      <VTab value="review"> Review </VTab>
      <VTab value="featured"> Featured on public page </VTab>
    </VTabs>
    <FeaturedProvidersPanel v-if="tab === 'featured'" />
    <ProviderReview v-else />
  </template>
  <ProviderReview v-else />
</template>
