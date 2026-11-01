<script setup lang="ts">
import { defineAsyncComponent } from "vue"

import { isWorkspaceRole, sectionEnabled, workspaceSections } from "@/features/workspace/config"
import { v1Actor, v1RouteAllowed, v1SectionDescription, v1SectionTitle, v1ViewFor } from "@/features/v1/access"
import V1Overview from "@/features/v1/V1Overview.vue"
import V1ProviderJobs from "@/features/v1/V1ProviderJobs.vue"
import AdminAccount from "@/features/account/AdminAccount.vue"
import ProviderSettings from "@/features/account/ProviderSettings.vue"
import CustomerSettings from "@/features/account/CustomerSettings.vue"
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
import StaffDirectoryLive from "@/features/staff/StaffDirectoryLive.vue"
import ServiceCatalogAdmin from "@/features/catalog/ServiceCatalogAdmin.vue"
import Feedback from "@/features/operations/Feedback.vue"
import MessagesInbox from "@/features/messages/MessagesInbox.vue"
import { isDemoMode } from "@/utils/demo-mode"

const props = defineProps<{ sectionId: string }>()
const RequestsWorkspace = defineAsyncComponent(() => import("@/features/requests/RequestsWorkspace.vue"))
const AdminPayments = defineAsyncComponent(() => import("@/features/requests/AdminPayments.vue"))
const ProviderEarnings = defineAsyncComponent(() => import("@/features/requests/ProviderEarnings.vue"))
const PlatformWorkspace = defineAsyncComponent(() => import("@/features/requests/PlatformWorkspace.vue"))
const auth = useAuthStore()
// V1: who is looking decides which screen a section shows. These V1 screens render before the demo and API branches
// below, in mock and real mode alike.
const actor = computed(() => v1Actor(auth.user))
const section = computed(() => {
  const role = auth.user?.role

  return isWorkspaceRole(role)
    ? workspaceSections[role].find(
        item => item.id === props.sectionId && sectionEnabled(role, item.id) && v1RouteAllowed(actor.value, item.id),
      )
    : undefined
})
const v1View = computed(() => (section.value ? v1ViewFor(actor.value, section.value.id) : null))
const overviewViewer = computed(() =>
  actor.value === "customer" || actor.value === "admin" || actor.value === "provider" ? actor.value : null,
)
const title = computed(() => (section.value ? v1SectionTitle(actor.value, section.value.id, section.value.title) : ""))
const description = computed(() =>
  section.value ? v1SectionDescription(actor.value, section.value.id, section.value.description) : "",
)
// Staff get the Messages inbox, which fills the page, so the standard title block is replaced by a hidden heading.
const showsInbox = computed(() => ["admin", "customer"].includes(actor.value ?? "") && section.value?.id === "messages")
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
      <div class="text-overline text-primary">{{ actor ?? auth.user?.role }} WORKSPACE</div>
      <h1 class="text-h3 mb-2">
        {{ title }}
      </h1>
      <p class="text-medium-emphasis mb-0">
        {{ description }}
      </p>
    </div>
    <Feedback />
    <V1Overview
      v-if="v1View === 'overview' && overviewViewer && !(isDemoMode && overviewViewer === 'admin')"
      :viewer="overviewViewer"
    />
    <RequestsWorkspace
      v-else-if="v1View === 'requests' && actor && ['admin', 'staff', 'customer'].includes(actor)"
      :key="section.id"
      section="requests"
      v1-mode
    />
    <V1ProviderJobs v-else-if="v1View === 'jobs'" />
    <!-- V1 staff "Account" is the profile page; the platform settings tabs are admin only. -->
    <AdminAccount v-else-if="actor === 'staff' && section.id === 'settings'" />
    <CustomerSettings v-else-if="actor === 'customer' && section.id === 'settings'" />
    <ProviderSettings v-else-if="actor === 'provider' && section.id === 'settings'" />
    <WorkspaceOverview v-else-if="section.id === 'overview'" :v1-mode="isDemoMode && actor === 'admin'" />
    <MessagesInbox v-else-if="showsInbox" v1-mode />
    <RequestsWorkspace
      v-else-if="!isDemoMode && ['requests', 'jobs', 'dispatch', 'quotes', 'payments'].includes(section.id)"
      :key="section.id"
      :section="section.id"
    />
    <PlatformWorkspace v-else-if="platformSection" :section="platformSection" />
    <PlatformWorkspace v-else-if="auth.user?.role === 'admin' && section.id === 'settings'" section="settings" />
    <AdminPayments v-else-if="section.id === 'finance'" :demo="isDemoMode" />
    <ProviderEarnings v-else-if="!isDemoMode && section.id === 'payouts'" />
    <div v-else-if="section.id === 'account'" class="d-flex flex-column gap-6">
      <AccountPhoneVerification />
      <AccountWorkspaces />
    </div>
    <ServiceCatalogAdmin v-else-if="section.id === 'services'" :read-only="isDemoMode" />
    <StaffDirectoryLive v-else-if="section.id === 'staff'" :read-only="isDemoMode" />
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
    <!-- V1-ASSUMPTION A7: Availability keeps its existing screen unchanged. -->
    <ProviderProfile
      v-else-if="['verification', 'availability'].includes(section.id)"
      :key="section.id"
      :availability="section.id === 'availability'"
      :v1-mode="isDemoMode && actor === 'provider' && section.id === 'verification'"
    />
    <PayoutDetails v-else-if="section.id === 'payouts'" />
    <ProvidersArea v-else-if="section.id === 'providers'" />
    <ApprovalQueue v-else-if="section.id === 'approvals'" />
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
