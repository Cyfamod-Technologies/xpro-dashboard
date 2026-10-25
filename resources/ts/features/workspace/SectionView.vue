<script setup lang="ts">
import { isWorkspaceRole, workspaceSections } from "@/features/workspace/config"
import { useAuthStore } from "@/stores/auth"
import RequestBoard from "@/features/operations/RequestBoard.vue"
import ProviderProfile from "@/features/operations/ProviderProfile.vue"
import PayoutDetails from "@/features/operations/PayoutDetails.vue"
import ProviderReview from "@/features/operations/ProviderReview.vue"
import WorkspaceUtilities from "@/features/operations/WorkspaceUtilities.vue"
import WorkspaceOverview from "@/features/operations/WorkspaceOverview.vue"
import ApprovalQueue from "@/features/operations/ApprovalQueue.vue"
import StaffDirectory from "@/features/operations/StaffDirectory.vue"
import Feedback from "@/features/operations/Feedback.vue"
import RequestsWorkspace from "@/features/requests/RequestsWorkspace.vue"
import AdminPayments from "@/features/requests/AdminPayments.vue"
import ProviderEarnings from "@/features/requests/ProviderEarnings.vue"
import PlatformWorkspace from "@/features/requests/PlatformWorkspace.vue"
import { isDemoMode } from "@/utils/demo-mode"

const props = defineProps<{ sectionId: string }>()
const auth = useAuthStore()
const section = computed(() =>
  isWorkspaceRole(auth.user?.role)
    ? workspaceSections[auth.user.role].find(item => item.id === props.sectionId)
    : undefined,
)
const platformSection = computed(() =>
  section.value?.id === "notifications" || section.value?.id === "approvals" ? section.value.id : null,
)
</script>

<template>
  <div v-if="section">
    <div v-if="section.id !== 'overview'" class="mb-6">
      <div class="text-overline text-primary">{{ auth.user?.role }} WORKSPACE</div>
      <h1 class="text-h3 mb-2">
        {{ section.title }}
      </h1>
      <p class="text-medium-emphasis mb-0">
        {{ section.description }}
      </p>
    </div>
    <Feedback />
    <WorkspaceOverview v-if="section.id === 'overview'" />
    <RequestsWorkspace
      v-else-if="!isDemoMode && ['requests', 'jobs', 'dispatch', 'quotes', 'payments'].includes(section.id)"
      :key="section.id"
      :section="section.id"
    />
    <PlatformWorkspace v-else-if="!isDemoMode && platformSection" :section="platformSection" />
    <PlatformWorkspace
      v-else-if="!isDemoMode && auth.user?.role === 'admin' && section.id === 'settings'"
      section="settings"
    />
    <AdminPayments v-else-if="!isDemoMode && section.id === 'finance'" />
    <ProviderEarnings v-else-if="!isDemoMode && section.id === 'payouts'" />
    <VAlert
      v-else-if="!isDemoMode && !['verification', 'availability', 'providers', 'payouts'].includes(section.id)"
      color="info"
      variant="tonal"
    >
      {{ section.emptyMessage }}
    </VAlert>
    <RequestBoard
      v-else-if="['requests', 'jobs', 'dispatch', 'quotes', 'schedule', 'messages'].includes(section.id)"
      :key="section.id"
      :section="section.id"
    />
    <ProviderProfile
      v-else-if="['verification', 'availability'].includes(section.id)"
      :key="section.id"
      :availability="section.id === 'availability'"
    />
    <PayoutDetails v-else-if="section.id === 'payouts'" />
    <ProviderReview v-else-if="section.id === 'providers'" />
    <ApprovalQueue v-else-if="section.id === 'approvals'" />
    <StaffDirectory v-else-if="section.id === 'staff'" />
    <WorkspaceUtilities v-else :key="section.id" :section="section.id" />
  </div>
</template>
