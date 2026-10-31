<script setup lang="ts">
import { formatDate, initials } from "@/features/messages/messages-helpers"
import { statusColor, statusLabel } from "@/features/messages/status-labels"
import type { ConversationItem } from "@/features/messages/types"
import type { RequestView } from "@/features/requests/api-types"

const props = defineProps<{
  request?: RequestView
  /** The conversation row, for names the request view does not carry (owner, provider). */
  row?: ConversationItem
  loading: boolean
  error: string
  /** The viewer holds `view.customer_contact`. */
  canSeeContact: boolean
  canClaim: boolean
  claiming: boolean
  /** The request has a current provider (its name comes from the conversation row, which may not be loaded). */
  hasProvider: boolean
  /** Name shown for the owner when the row has none but the request is claimed by the viewer. */
  ownerFallback?: string
  /** Phone: shown as its own screen with a back arrow. */
  fullscreen?: boolean
}>()
const emit = defineEmits<{ back: []; claim: []; retry: [] }>()

const title = computed(() => props.request?.title || props.row?.title || "Service request")
const customerName = computed(() => props.request?.customerName || props.row?.customer.name || "Customer")
const location = computed(() => [props.request?.cityName, props.request?.districtName].filter(Boolean).join(", "))
const startDate = computed(() => formatDate(props.request?.effectiveStartDate ?? props.request?.startDate))
const ownerName = computed(() => {
  if (props.row?.owner) return props.row.owner.name
  if (props.request?.staffOwnerId) return props.ownerFallback || "Another staff member"

  return ""
})
const providerText = computed(() => {
  if (props.row?.provider) return props.row.provider.name

  return props.hasProvider ? "Provider assigned" : "No provider on this request yet."
})
const status = computed(() => props.request?.status ?? props.row?.status ?? "")
const stage = computed(() => props.request?.statusLabel ?? props.row?.statusLabel ?? "")
const contact = computed(() =>
  [props.request?.phone, props.request?.contactMethod ? `prefers ${props.request.contactMethod}` : ""]
    .filter(Boolean)
    .join(" · "),
)
const openTo = computed(() => ({
  path: "/admin/requests",
  query: { request: props.request?.id ?? props.row?.requestId },
}))
</script>

<template>
  <aside class="info-panel" aria-label="Request info">
    <header v-if="fullscreen" class="info-panel__bar">
      <VBtn icon="tabler-arrow-left" variant="text" aria-label="Back to conversation" @click="emit('back')" />
      <h2 class="info-panel__bar-title">Request info</h2>
    </header>

    <div class="info-panel__body">
      <div v-if="loading && !request" class="info-panel__loading" role="status" aria-label="Loading request info">
        <div v-for="n in 4" :key="n" class="info-panel__skeleton" />
      </div>

      <VAlert v-else-if="error && !request" type="error" variant="tonal" density="compact">
        {{ error }}
        <template #append>
          <VBtn size="small" variant="text" @click="emit('retry')">Retry</VBtn>
        </template>
      </VAlert>

      <template v-else>
        <div class="info-panel__hero">
          <VAvatar color="primary" variant="tonal" size="56" aria-hidden="true">
            <span class="text-h6">{{ initials(customerName) }}</span>
          </VAvatar>
          <h3 class="info-panel__title">{{ title }}</h3>
          <div class="info-panel__status">
            <VChip v-if="status" :color="statusColor(status)" variant="tonal" size="small">
              {{ statusLabel(status) }}
            </VChip>
            <span v-if="stage && stage !== statusLabel(status)" class="info-panel__stage">{{ stage }}</span>
          </div>
        </div>

        <section class="info-panel__section" aria-labelledby="info-request">
          <h3 id="info-request" class="info-panel__heading">Request</h3>
          <dl class="info-panel__list">
            <div>
              <dt>Request id</dt>
              <dd>{{ request?.id ?? row?.requestId }}</dd>
            </div>
            <div v-if="request?.service">
              <dt>Service</dt>
              <dd>{{ request.service }}</dd>
            </div>
            <div v-if="location">
              <dt>City</dt>
              <dd>{{ location }}</dd>
            </div>
            <div v-if="startDate">
              <dt>Start date</dt>
              <dd>{{ startDate }}</dd>
            </div>
          </dl>
        </section>

        <section class="info-panel__section" aria-labelledby="info-people">
          <h3 id="info-people" class="info-panel__heading">People</h3>
          <dl class="info-panel__list">
            <div>
              <dt>Customer</dt>
              <dd>{{ customerName }}</dd>
            </div>
            <div>
              <dt>Customer contact</dt>
              <dd v-if="canSeeContact">{{ contact || "Not provided" }}</dd>
              <dd v-else class="text-medium-emphasis">Hidden: not needed for your role</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd :class="{ 'text-medium-emphasis': !hasProvider }">{{ providerText }}</dd>
            </div>
          </dl>
        </section>

        <section class="info-panel__section" aria-labelledby="info-owner">
          <h3 id="info-owner" class="info-panel__heading">Owner</h3>
          <div class="info-panel__owner">
            <span v-if="ownerName">{{ ownerName }}</span>
            <span v-else class="text-medium-emphasis">Not claimed yet</span>
            <VBtn
              v-if="canClaim"
              size="small"
              color="primary"
              variant="tonal"
              :loading="claiming"
              @click="emit('claim')"
            >
              Claim
            </VBtn>
          </div>
        </section>

        <VBtn class="info-panel__open" variant="outlined" block append-icon="tabler-arrow-right" :to="openTo">
          Open request
        </VBtn>
      </template>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.info-panel {
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  background: rgb(var(--v-theme-surface));
}

.info-panel__bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 8px 4px;
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.info-panel__bar-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
}

.info-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-block-size: 0;
  padding: 20px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.info-panel__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.info-panel__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.info-panel__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.info-panel__stage {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
}

.info-panel__heading {
  margin: 0 0 8px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.info-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;

  dt {
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
    font-size: 0.8125rem;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
}

.info-panel__owner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-block-size: 36px;
}

.info-panel__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-panel__skeleton {
  block-size: 48px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  animation: info-pulse 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
}

@keyframes info-pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
