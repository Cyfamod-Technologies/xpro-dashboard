<script setup lang="ts">
import { isWorkspaceRole, workspaceSections } from "@/features/workspace/config"
import { useAuthStore } from "@/stores/auth"
import RequestBoard from "@/features/operations/RequestBoard.vue"
import ProviderProfile from "@/features/operations/ProviderProfile.vue"
import AccountPhoneVerification from "@/features/phone/AccountPhoneVerification.vue"
import AccountWorkspaces from "@/features/account/AccountWorkspaces.vue"
import PayoutDetails from "@/features/operations/PayoutDetails.vue"
import ProvidersArea from "@/features/operations/ProvidersArea.vue"
import WorkspaceUtilities from "@/features/operations/WorkspaceUtilities.vue"
import WorkspaceOverview from "@/features/operations/WorkspaceOverview.vue"
import ApprovalQueue from "@/features/operations/ApprovalQueue.vue"
import StaffDirectory from "@/features/operations/StaffDirectory.vue"
import StaffDirectoryLive from "@/features/staff/StaffDirectoryLive.vue"
import ServiceCatalogAdmin from "@/features/catalog/ServiceCatalogAdmin.vue"
import Feedback from "@/features/operations/Feedback.vue"
import MessagesInbox from "@/features/messages/MessagesInbox.vue"
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
// Staff get the Messages inbox, which fills the page, so the standard title block is replaced by a hidden heading.
const showsInbox = computed(() => !isDemoMode && auth.user?.role === "admin" && section.value?.id === "messages")
const platformSection = computed(() =>
  section.value?.id === "notifications" || section.value?.id === "approvals" ? section.value.id : null,
)
</script>

<template>
  <div v-if="section">
    <div v-if="showsInbox" class="visually-hidden">
      <h1>{{ section.title }}</h1>
      <p>{{ section.description }}</p>
    </div>
    <div v-else-if="section.id !== 'overview'" class="mb-6">
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
    <MessagesInbox v-else-if="showsInbox" />
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
    <div v-else-if="!isDemoMode && section.id === 'account'" class="d-flex flex-column gap-6">
      <AccountPhoneVerification />
      <AccountWorkspaces />
    </div>
    <ServiceCatalogAdmin v-else-if="!isDemoMode && section.id === 'services'" />
    <StaffDirectoryLive v-else-if="!isDemoMode && section.id === 'staff'" />
    <VAlert v-else-if="section.id === 'services'" color="info" variant="tonal">
      {{ section.emptyMessage }}
    </VAlert>
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
    <ProvidersArea v-else-if="section.id === 'providers'" />
    <ApprovalQueue v-else-if="section.id === 'approvals'" />
    <StaffDirectory v-else-if="section.id === 'staff'" />
    <WorkspaceUtilities v-else :key="section.id" :section="section.id" />
  </div>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  white-space: nowrap;
}
</style>
