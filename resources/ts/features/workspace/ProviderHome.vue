<script setup lang="ts">
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const firstName = computed(() => auth.user?.name.split(" ")[0] ?? "there")
</script>

<template>
  <div>
    <div class="mb-6">
      <div class="text-overline text-primary mb-2">PROVIDER WORKSPACE</div>
      <h1 class="text-h3 mb-2">Welcome, {{ firstName }}.</h1>
      <p class="text-body-1 text-medium-emphasis mb-0">
        Build your profile, get ready for assignments and keep your work moving.
      </p>
    </div>
    <VRow class="mb-6">
      <VCol cols="12" lg="7">
        <VCard class="h-100" color="primary" variant="tonal">
          <VCardText class="pa-6 pa-sm-8">
            <VChip color="secondary" size="small" class="mb-5"> Profile not submitted </VChip>
            <h2 class="text-h4 mb-3">Introduce your expertise.</h2>
            <p class="text-body-1 mb-6">
              Tell us about your services and service area, then share your documents for XPro review.
            </p>
            <VBtn to="/verification" prepend-icon="tabler-user-check"> View provider profile </VBtn>
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12" lg="5">
        <VCard class="h-100">
          <VCardText class="pa-6 pa-sm-8">
            <VAvatar color="secondary" variant="tonal" class="mb-4">
              <VIcon icon="tabler-clock" />
            </VAvatar>
            <h2 class="text-h5 mb-3">Ready when you are.</h2>
            <p class="text-body-1 text-medium-emphasis mb-6">
              Keep your availability current so dispatch can coordinate the right work with you.
            </p>
            <VBtn to="/availability" variant="outlined"> View availability </VBtn>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>
    <VCard>
      <VCardText class="pa-6 pa-sm-8">
        <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6">
          <h2 class="text-h5">Your job queue</h2>
          <VBtn to="/jobs" variant="text"> View jobs </VBtn>
        </div>
        <div class="text-center py-6">
          <VIcon icon="tabler-briefcase" size="40" color="secondary" class="mb-4" />
          <h3 class="text-h6 mb-2">No assignments yet</h3>
          <p class="text-body-1 text-medium-emphasis mb-0">Offers and accepted jobs will appear in your queue.</p>
        </div>
      </VCardText>
    </VCard>
  </div>
</template>
