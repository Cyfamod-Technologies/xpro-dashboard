<script setup lang="ts">
import { staffRoleLabels } from "@/features/operations/staff"
import { v1Workspace } from "@/features/workspace/config"
import StaffActionDialogs from "@/features/staff/StaffActionDialogs.vue"
import type { StaffAction } from "@/features/staff/StaffActionDialogs.vue"
import {
  describeHistory,
  formatDate,
  formatDateTime,
  fullName,
  groupPermissions,
  permissionLabels,
  staffActions,
  staffStatusColors,
  staffStatusLabels,
} from "@/features/staff/staff-helpers"
import type { StaffActionKey } from "@/features/staff/staff-helpers"
import type { StaffHistoryEntry, StaffMemberView } from "@/services/staff-api"
import { staffApi } from "@/services/staff-api"
import { useOperationsStore } from "@/stores/operations"

const route = useRoute()
const router = useRouter()
const ops = useOperationsStore()

const staffId = computed(() => String((route.params as { id?: string }).id ?? ""))
const member = ref<StaffMemberView | null>(null)
const activeSuperAdmins = ref(2)
const history = ref<StaffHistoryEntry[]>([])
const historyPage = ref(1)
const historyMore = ref(false)
const loading = ref(true)
const loadError = ref("")
const historyError = ref("")
const notice = ref("")
const showPermissions = ref(false)

const action = ref<StaffAction | null>(null)
const prefill = ref<{ firstName: string; lastName: string; email: string } | null>(null)

const actionContext = computed(() => ({
  selfId: ops.actor?.id,
  canResetMfa: ops.can("staff.mfa.reset"),
  activeSuperAdmins: activeSuperAdmins.value,
}))
const actions = computed(() => (member.value ? staffActions(member.value, actionContext.value) : []))
const primary = computed(() => actions.value.filter(item => item.primary))
const more = computed(() => actions.value.filter(item => !item.primary))

const loadHistory = async (reset = true) => {
  historyError.value = ""
  try {
    const next = reset ? 1 : historyPage.value + 1
    const response = await staffApi.history(staffId.value, next)
    history.value = reset ? response.data.items : [...history.value, ...response.data.items]
    historyPage.value = next
    historyMore.value = response.data.hasNextPage
  } catch (cause) {
    historyError.value = cause instanceof Error ? cause.message : "History could not be loaded."
  }
}

const load = async () => {
  loading.value = true
  loadError.value = ""
  try {
    const [detail, counts] = await Promise.all([staffApi.get(staffId.value), staffApi.summary()])
    member.value = detail.data
    activeSuperAdmins.value = counts.data.activeSuperAdmins
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : "This staff member could not be loaded."
  } finally {
    loading.value = false
  }
  if (member.value) loadHistory()
}

const start = (key: StaffActionKey) => {
  prefill.value = null
  if (key === "inviteAgain" && member.value) {
    prefill.value = {
      firstName: member.value.firstName ?? "",
      lastName: member.value.lastName ?? "",
      email: member.value.email,
    }
    action.value = "invite"

    return
  }
  action.value = key as StaffAction
}

const changed = async (next: StaffMemberView) => {
  if (next.id !== staffId.value) {
    // An invite-again creates the same account on a new employment period, so the page stays on this member.
    router.replace(`/admin/staff/${encodeURIComponent(next.id)}`)

    return
  }
  member.value = next
  notice.value = "Saved."
  const counts = await staffApi.summary().catch(() => null)
  if (counts) activeSuperAdmins.value = counts.data.activeSuperAdmins
  loadHistory()
}

// Returns to the list with the filters it had, when the visitor came from it.
const back = () =>
  String(window.history.state?.back ?? "").startsWith("/admin/staff") ? router.back() : router.push("/admin/staff")

const sentence = (value: string | null | undefined) => value || "—"
const mfaText = computed(() =>
  member.value?.mfaEnrolledAt ? `Enrolled ${formatDate(member.value.mfaEnrolledAt)}` : "Not set up",
)
const permissionGroups = computed(() => groupPermissions(member.value?.permissions ?? []))
const conflictText = computed(() => {
  const declaration = member.value?.conflictDeclaration

  if (!declaration) return "Not declared yet"
  if (declaration.hasLinkedCustomerAccount)
    return `Linked customer account${declaration.linkedCustomerEmail ? `: ${declaration.linkedCustomerEmail}` : ""}`

  return "No linked customer account"
})

watch(staffId, load)
onMounted(load)
</script>

<template>
  <div v-if="loading" class="d-flex justify-center py-12">
    <VProgressCircular indeterminate color="primary" aria-label="Loading staff member" />
  </div>
  <VAlert v-else-if="loadError || !member" type="error" variant="tonal">
    <div class="d-flex justify-space-between align-center flex-wrap gap-3">
      <span>{{ loadError || "This staff member is unavailable." }}</span>
      <div class="d-flex gap-2">
        <VBtn variant="text" @click="back">Back to staff</VBtn>
        <VBtn variant="outlined" color="error" @click="load">Retry</VBtn>
      </div>
    </div>
  </VAlert>
  <template v-else>
    <div class="d-flex align-start flex-wrap gap-3 mb-5">
      <VBtn icon="tabler-arrow-left" variant="text" aria-label="Back to staff" @click="back" />
      <div class="flex-grow-1">
        <div class="text-body-2 text-medium-emphasis">Admin workspace / Staff</div>
        <h1 class="text-h4">{{ fullName(member) }}</h1>
        <div class="d-flex flex-wrap align-center gap-2 mt-1">
          <span class="text-body-2 text-medium-emphasis">{{ member.email }}</span>
          <VChip size="small" variant="tonal" :color="staffStatusColors[member.status]">
            {{ staffStatusLabels[member.status] }}
          </VChip>
          <VChip v-for="r in member.roles" :key="r" size="small" variant="tonal" color="primary">
            {{ staffRoleLabels[r] }}
          </VChip>
          <span v-if="member.employmentPeriod > 1" class="text-caption text-medium-emphasis">
            Employment period {{ member.employmentPeriod }}
          </span>
        </div>
      </div>
      <div class="d-flex flex-wrap align-center gap-2">
        <VTooltip v-for="item in primary" :key="item.key" :disabled="!item.disabledReason" location="bottom">
          <template #activator="{ props: tip }">
            <span v-bind="tip">
              <VBtn
                :prepend-icon="item.icon"
                :color="item.color"
                :variant="item.color ? 'outlined' : 'flat'"
                :disabled="Boolean(item.disabledReason)"
                @click="start(item.key)"
              >
                {{ item.label }}
              </VBtn>
            </span>
          </template>
          {{ item.disabledReason }}
        </VTooltip>
        <VMenu v-if="more.length">
          <template #activator="{ props: menu }">
            <VBtn v-bind="menu" variant="outlined" append-icon="tabler-chevron-down">More</VBtn>
          </template>
          <VList density="compact">
            <VListItem
              v-for="item in more"
              :key="item.key"
              :prepend-icon="item.icon"
              :title="item.label"
              :subtitle="item.disabledReason"
              :disabled="Boolean(item.disabledReason)"
              :base-color="item.color"
              @click="start(item.key)"
            />
          </VList>
        </VMenu>
      </div>
    </div>

    <VAlert v-if="notice" type="success" variant="tonal" closable class="mb-4" @click:close="notice = ''">
      {{ notice }}
    </VAlert>
    <VAlert v-if="member.suspension" type="warning" variant="tonal" class="mb-4" title="Suspended">
      Since {{ formatDateTime(member.suspension.at)
      }}<template v-if="member.suspension.by"> by {{ member.suspension.by.name }}</template
      >.<template v-if="member.suspension.securityIncident"> Marked as a security incident.</template>
      <div v-if="member.suspension.reason" class="mt-1">Reason: {{ member.suspension.reason }}</div>
    </VAlert>
    <VAlert v-if="member.deactivation" type="error" variant="tonal" class="mb-4" title="Deactivated">
      Since {{ formatDateTime(member.deactivation.at)
      }}<template v-if="member.deactivation.by"> by {{ member.deactivation.by.name }}</template
      >. This person can only return through a new invitation.
      <div v-if="member.deactivation.reason" class="mt-1">Reason: {{ member.deactivation.reason }}</div>
    </VAlert>
    <VAlert
      v-if="member.status === 'invited' && member.invite?.state === 'expired'"
      type="error"
      variant="tonal"
      class="mb-4"
      title="Invitation expired"
    >
      The link stopped working on {{ formatDateTime(member.invite.expiresAt) }}. Resend it or revoke the invitation.
    </VAlert>
    <VAlert v-else-if="member.status === 'revoked'" type="info" variant="tonal" class="mb-4" title="Invitation revoked">
      This person was never activated. Invite them again to start over.
    </VAlert>

    <VRow>
      <VCol cols="12" md="7">
        <VCard class="mb-5">
          <VCardTitle>Access</VCardTitle>
          <VCardText>
            <VTable density="compact">
              <tbody>
                <tr>
                  <th scope="row">Roles</th>
                  <td>{{ member.roles.map(r => staffRoleLabels[r]).join(", ") }}</td>
                </tr>
                <tr>
                  <th scope="row">Can own requests</th>
                  <td>{{ member.canOwnRequests ? "Yes" : "No" }}</td>
                </tr>
                <tr>
                  <th scope="row">Sign-in verification</th>
                  <td>{{ mfaText }}</td>
                </tr>
                <tr>
                  <th scope="row">Last sign-in</th>
                  <td>{{ formatDateTime(member.lastSignInAt) }}</td>
                </tr>
                <tr>
                  <th scope="row">Accepted</th>
                  <td>{{ formatDateTime(member.acceptedAt) }}</td>
                </tr>
                <tr>
                  <th scope="row">Policy accepted</th>
                  <td>
                    {{
                      member.policyAcceptance
                        ? `Version ${member.policyAcceptance.version}, ${formatDate(member.policyAcceptance.acceptedAt)}`
                        : "—"
                    }}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Conflict declaration</th>
                  <td>{{ conflictText }}</td>
                </tr>
              </tbody>
            </VTable>
            <VBtn
              variant="text"
              class="mt-2"
              :append-icon="showPermissions ? 'tabler-chevron-up' : 'tabler-chevron-down'"
              :aria-expanded="showPermissions"
              @click="showPermissions = !showPermissions"
            >
              {{ showPermissions ? "Hide" : "Show" }} permissions ({{ member.permissions.length }})
            </VBtn>
            <div v-if="showPermissions" class="mt-2">
              <div v-for="group in permissionGroups" :key="group.name" class="mb-3">
                <div class="text-subtitle-2 mb-1">{{ group.name }}</div>
                <ul class="ps-5 text-body-2">
                  <li v-for="permission in group.items" :key="permission">
                    {{ permissionLabels[permission] ?? permission }}
                  </li>
                </ul>
              </div>
              <p v-if="!permissionGroups.length" class="text-body-2 text-medium-emphasis">
                No permissions while this account is not active.
              </p>
            </div>
          </VCardText>
        </VCard>

        <VCard v-if="member.status === 'invited'" class="mb-5">
          <VCardTitle>Invitation</VCardTitle>
          <VCardText>
            <VTable density="compact">
              <tbody>
                <tr>
                  <th scope="row">Invited</th>
                  <td>
                    {{ formatDateTime(member.invitedAt)
                    }}<template v-if="member.invitedBy"> by {{ member.invitedBy.name }}</template>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Link</th>
                  <td>
                    <template v-if="member.invite">
                      {{ member.invite.state === "expired" ? "Expired" : "Expires" }}
                      {{ formatDateTime(member.invite.expiresAt) }}
                    </template>
                    <template v-else>No link on file</template>
                  </td>
                </tr>
                <tr v-if="member.invite">
                  <th scope="row">Sent in the last 24 hours</th>
                  <td>{{ member.invite.resendsToday }} of 5</td>
                </tr>
              </tbody>
            </VTable>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="5">
        <VCard class="mb-5">
          <VCardTitle>Workload</VCardTitle>
          <VCardText>
            <template v-if="member.status === 'active' || member.status === 'suspended'">
              <div class="text-h5">{{ member.workload.openOwned }}</div>
              <div class="text-body-2 text-medium-emphasis mb-2">
                open request{{ member.workload.openOwned === 1 ? "" : "s" }} owned<template
                  v-if="member.workload.overdueOwned"
                  >, <span class="text-error">{{ member.workload.overdueOwned }} with overdue items</span></template
                >
              </div>
              <VBtn
                variant="text"
                size="small"
                :to="{ path: '/admin/requests', query: { owner: member.id } }"
                :disabled="!member.workload.openOwned"
              >
                View their requests
              </VBtn>
            </template>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">No workload for this status.</p>
          </VCardText>
        </VCard>

        <VCard v-if="v1Workspace.admin.leaveAndCover && member.status === 'active'" class="mb-5">
          <VCardTitle>Leave</VCardTitle>
          <VCardText>
            <template v-if="member.leave">
              <p class="mb-1">
                {{ formatDate(member.leave.from) }} to {{ formatDate(member.leave.to) }}
                <VChip v-if="member.leave.active" size="x-small" class="ms-1" color="info" variant="tonal">now</VChip>
              </p>
              <p class="text-body-2 text-medium-emphasis mb-1">
                Covered by {{ member.leave.delegate?.name ?? "nobody" }}
              </p>
              <p v-if="member.leave.note" class="text-body-2 mb-2">{{ member.leave.note }}</p>
              <VBtn variant="text" size="small" @click="start('clearLeave')">Clear leave</VBtn>
            </template>
            <template v-else>
              <p class="text-body-2 text-medium-emphasis">Not on leave.</p>
              <VBtn variant="text" size="small" @click="start('leave')">Set leave</VBtn>
            </template>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VCard>
      <VCardTitle>History</VCardTitle>
      <VCardText>
        <VAlert v-if="historyError" type="error" variant="tonal" class="mb-3">
          {{ historyError }}
          <template #append><VBtn size="small" variant="text" @click="loadHistory">Retry</VBtn></template>
        </VAlert>
        <p v-else-if="!history.length" class="text-body-2 text-medium-emphasis mb-0">
          Nothing recorded yet. Changes to this account appear here.
        </p>
        <VTimeline v-else side="end" density="compact" line-inset="8" truncate-line="both">
          <VTimelineItem v-for="entry in history" :key="entry.id" size="x-small" dot-color="primary">
            <div>{{ describeHistory(entry) }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ formatDateTime(entry.createdAt)
              }}<template v-if="entry.actor"> · {{ sentence(entry.actor.name) }}</template>
            </div>
          </VTimelineItem>
        </VTimeline>
        <VBtn v-if="historyMore" variant="text" @click="loadHistory(false)">Show older</VBtn>
      </VCardText>
    </VCard>
  </template>

  <StaffActionDialogs
    :action="action"
    :member="member"
    :prefill="prefill"
    @close="action = null"
    @changed="changed"
    @stale="load"
  />
</template>
