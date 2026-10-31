<script setup lang="ts">
import { authApi } from "@/services/xpro-api"
import type { ProviderAdminDetail } from "@/services/providers-api"
import { providersApi } from "@/services/providers-api"
import Attachments from "@/features/operations/Attachments.vue"
import { weekdayLabels, weekdays, when } from "@/features/operations/types"
import { accountNameMatches } from "@/features/operations/banks"
import { useOperationsStore } from "@/stores/operations"
import type { Attachment } from "@/features/operations/types"

type Action =
  | "profile-approve"
  | "profile-changes"
  | "profile-reject"
  | "changes-approve"
  | "changes-reject"
  | "bank-approve"
  | "bank-reject"
  | "reliability-clear"
  | "reliability-restrict"
  | "delist"
  | "reinstate"
  | "identity-reveal"
  | "bank-reveal"

const route = useRoute()
const router = useRouter()
const ops = useOperationsStore()
const providerId = computed(() => String((route.params as { id?: string }).id ?? ""))
const provider = ref<ProviderAdminDetail>()
const loading = ref(true)
const busy = ref(false)
const loadError = ref("")
const actionError = ref("")
const notice = ref("")
const action = ref<Action>()
const dialog = ref(false)
const note = ref("")
const password = ref("")
const mfaCode = ref("")
const revealedIdentityFiles = ref<Attachment[]>([])
const revealedBanks = ref<Awaited<ReturnType<typeof providersApi.revealBankDetails>>["data"]>([])

const fullName = computed(() => {
  const item = provider.value

  return item
    ? [item.firstName, item.lastName].filter(Boolean).join(" ") || item.businessName || item.email
    : "Provider"
})
const pendingBank = computed(() => provider.value?.payout.pending)
const hasBankPermission = computed(() => ops.can("bank.review"))
const canReview = computed(() => ops.can("provider.review"))
const requiresNote = computed(() => action.value !== "profile-approve")
const actionCopy: Record<Action, { title: string; description: string; confirm: string; color: string }> = {
  "profile-approve": {
    title: "Approve provider profile?",
    description:
      "This approves identity and service verification. It does not approve payout details or turn on availability.",
    confirm: "Approve provider",
    color: "primary",
  },
  "profile-changes": {
    title: "Request profile changes?",
    description: "The provider will receive your note and can resubmit their profile for review.",
    confirm: "Send change request",
    color: "primary",
  },
  "profile-reject": {
    title: "Reject provider profile?",
    description: "The provider will receive the reason. They can submit again after the 30-day cooldown.",
    confirm: "Reject provider",
    color: "error",
  },
  "changes-approve": {
    title: "Approve profile changes?",
    description: "The proposed values will replace the current values used for provider matching.",
    confirm: "Approve changes",
    color: "primary",
  },
  "changes-reject": {
    title: "Reject profile changes?",
    description: "The proposal will be discarded. The existing provider profile remains in effect.",
    confirm: "Reject changes",
    color: "warning",
  },
  "bank-approve": {
    title: "Approve payout details?",
    description:
      "The pending account will become the verified payout account. This decision does not approve the provider profile.",
    confirm: "Approve bank details",
    color: "primary",
  },
  "bank-reject": {
    title: "Reject payout details?",
    description: "The provider will receive your reason. Any existing verified account remains in use.",
    confirm: "Reject bank details",
    color: "warning",
  },
  "reliability-clear": {
    title: "Clear reliability review?",
    description: "This clears the current reliability review. Other eligibility restrictions still apply.",
    confirm: "Clear review",
    color: "primary",
  },
  "reliability-restrict": {
    title: "Restrict this provider?",
    description: "Restriction blocks new offers and withdraws open offers.",
    confirm: "Restrict provider",
    color: "error",
  },
  delist: {
    title: "Delist this provider?",
    description:
      "Open offers will be withdrawn, current jobs flagged for staff handling, and unpaid payouts may be held. Recent authentication is required.",
    confirm: "Delist provider",
    color: "error",
  },
  reinstate: {
    title: "Reinstate this provider?",
    description:
      "The provider will return to pending profile review and will not become eligible for offers automatically.",
    confirm: "Reinstate provider",
    color: "primary",
  },
  "identity-reveal": {
    title: "Reveal identity documents?",
    description: "Access to private identity files is logged. The links expire after five minutes.",
    confirm: "Reveal documents",
    color: "primary",
  },
  "bank-reveal": {
    title: "Reveal full bank details?",
    description: "Access to full account numbers is logged.",
    confirm: "Reveal bank details",
    color: "primary",
  },
}

const currentAction = computed(() => (action.value ? actionCopy[action.value] : undefined))
const pendingChangeEntries = computed(() => {
  const changes = provider.value?.pendingChanges
  if (!changes) return []

  return Object.entries(changes).filter(([key]) => !["documents", "photo"].includes(key))
})
const skillRows = computed(() => Object.entries(provider.value?.skills ?? {}))
const payoutState = computed(() =>
  provider.value?.payout.pending ? "Pending review" : provider.value?.payout.current ? "Verified" : "Not set",
)
const canDelist = computed(() =>
  ["pending", "approved", "changes_requested"].includes(provider.value?.verification ?? ""),
)

const load = async () => {
  loading.value = true
  loadError.value = ""
  try {
    const detail = (await providersApi.detailForReview(providerId.value)).data
    const portfolio = await Promise.all(
      detail.portfolio.map(async file => {
        try {
          const response = await providersApi.fileUrl(file.id, detail.id)

          return { ...file, downloadUrl: response.data.url }
        } catch {
          return file
        }
      }),
    )
    provider.value = { ...detail, portfolio }
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : "Provider details could not be loaded."
  } finally {
    loading.value = false
  }
}

const openAction = (next: Action) => {
  action.value = next
  note.value = ""
  password.value = ""
  mfaCode.value = ""
  actionError.value = ""
  dialog.value = true
}

const submitAction = async () => {
  const item = provider.value
  const selected = action.value
  if (!item || !selected) return
  if (requiresNote.value && note.value.trim().length < 5) {
    actionError.value = "Enter a reason of at least 5 characters."

    return
  }
  if (selected === "delist" && !password.value) {
    actionError.value = "Enter your password to reauthenticate."

    return
  }

  busy.value = true
  actionError.value = ""
  notice.value = ""
  try {
    switch (selected) {
      case "profile-approve":
        await providersApi.review(item.id, "approved", note.value, item.version)
        break
      case "profile-changes":
        await providersApi.review(item.id, "changes_requested", note.value, item.version)
        break
      case "profile-reject":
        await providersApi.review(item.id, "rejected", note.value, item.version)
        break
      case "changes-approve":
        await providersApi.reviewChanges(item.id, true, note.value, item.version)
        break
      case "changes-reject":
        await providersApi.reviewChanges(item.id, false, note.value, item.version)
        break
      case "bank-approve":
        await providersApi.reviewBank(item.id, true, note.value, item.version)
        break
      case "bank-reject":
        await providersApi.reviewBank(item.id, false, note.value, item.version)
        break
      case "reliability-clear":
        await providersApi.reviewReliability(item.id, "clear", note.value)
        break
      case "reliability-restrict":
        await providersApi.reviewReliability(item.id, "restrict", note.value)
        break
      case "delist": {
        const auth = await authApi.reauthenticate(password.value, mfaCode.value || undefined)
        await providersApi.delist(item.id, note.value, item.version, auth.data.reauthToken)
        break
      }
      case "reinstate":
        await providersApi.reinstate(item.id, note.value, item.version)
        break
      case "identity-reveal": {
        const response = await providersApi.revealIdentity(item.id, note.value)
        revealedIdentityFiles.value = response.data.map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          downloadUrl: file.url,
        }))
        notice.value = "Identity documents revealed. Access was logged; links expire in five minutes."
        break
      }
      case "bank-reveal": {
        const response = await providersApi.revealBankDetails(item.id, note.value)
        revealedBanks.value = response.data
        notice.value = "Full bank details revealed. Access was logged."
        break
      }
    }
    if (!selected.endsWith("reveal")) {
      await load()
      notice.value = `${currentAction.value?.confirm ?? "Action"} completed.`
    }
    dialog.value = false
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : "The action could not be completed."
  } finally {
    busy.value = false
  }
}

const formatChange = (value: unknown) =>
  Array.isArray(value)
    ? value.map(item => (typeof item === "string" ? item : JSON.stringify(item))).join(", ")
    : value && typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "—")
const currentValueFor = (key: string) =>
  formatChange((provider.value as unknown as Record<string, unknown> | undefined)?.[key])

watch(providerId, load)
onMounted(load)
</script>

<template>
  <div v-if="loading" class="d-flex justify-center py-12">
    <VProgressCircular indeterminate color="primary" aria-label="Loading provider details" />
  </div>
  <VAlert v-else-if="loadError || !provider" type="error" variant="tonal">
    <div class="d-flex justify-space-between align-center flex-wrap gap-3">
      <span>{{ loadError || "Provider details are unavailable." }}</span>
      <VBtn variant="outlined" color="error" @click="load">Retry</VBtn>
    </div>
  </VAlert>
  <template v-else>
    <div class="d-flex align-center flex-wrap gap-3 mb-5">
      <VBtn
        icon="tabler-arrow-left"
        variant="text"
        aria-label="Back to providers"
        @click="router.push('/admin/providers')"
      />
      <div class="flex-grow-1">
        <div class="text-body-2 text-medium-emphasis">Admin workspace / Providers</div>
        <h1 class="text-h4">{{ fullName }}</h1>
      </div>
      <VChip v-if="canReview" color="primary" variant="tonal">{{ provider.verification.replaceAll("_", " ") }}</VChip>
      <VChip v-if="canReview" :color="provider.accountStatus === 'active' ? 'success' : 'error'" variant="tonal">
        Account {{ provider.accountStatus }}
      </VChip>
      <VChip v-else color="secondary" variant="tonal">Payout review</VChip>
      <VBtn v-if="canDelist && canReview" variant="outlined" color="error" @click="openAction('delist')">
        Delist provider
      </VBtn>
      <VBtn v-else-if="provider.verification === 'delisted' && canReview" @click="openAction('reinstate')"
        >Reinstate provider</VBtn
      >
    </div>

    <VAlert v-if="notice" type="success" variant="tonal" closable class="mb-4" @click:close="notice = ''">
      {{ notice }}
    </VAlert>

    <VRow>
      <VCol v-if="canReview" cols="12" lg="8">
        <VCard class="mb-5">
          <VCardTitle>Profile and services</VCardTitle>
          <VCardText>
            <VRow>
              <VCol cols="12" sm="6"
                ><div class="text-caption text-medium-emphasis">Email</div>
                {{ provider.email }}</VCol
              >
              <VCol cols="12" sm="6"
                ><div class="text-caption text-medium-emphasis">Phone</div>
                {{ provider.phone }}
                <VChip v-if="provider.phoneVerifiedAt" size="x-small" color="success" variant="tonal"
                  >Verified</VChip
                ></VCol
              >
              <VCol cols="12" sm="6"
                ><div class="text-caption text-medium-emphasis">Joined</div>
                {{ when(provider.registeredAt) }}</VCol
              >
              <VCol cols="12" sm="6"
                ><div class="text-caption text-medium-emphasis">Trade and base area</div>
                {{ provider.trade }} · {{ provider.city }}</VCol
              >
              <VCol cols="12" sm="6"
                ><div class="text-caption text-medium-emphasis">Experience</div>
                {{ provider.experience }} years</VCol
              >
              <VCol cols="12"
                ><div class="text-caption text-medium-emphasis">About</div>
                {{ provider.bio || "No introduction provided." }}</VCol
              >
              <VCol cols="12"
                ><div class="text-caption text-medium-emphasis mb-1">Services</div>
                <VChip
                  v-for="service in provider.services"
                  :key="service"
                  size="small"
                  color="primary"
                  variant="tonal"
                  class="me-1 mb-1"
                  >{{ service }}</VChip
                ></VCol
              >
            </VRow>
          </VCardText>
        </VCard>

        <VCard class="mb-5">
          <VCardTitle>Coverage and capacity</VCardTitle>
          <VCardText>
            <VAlert v-if="provider.outsideServedAreas" type="info" variant="tonal" density="comfortable" class="mb-4">
              XPro doesn't offer jobs in these areas yet. The provider can still be approved and will get offers once XPro opens there.
            </VAlert>
            <div class="text-caption text-medium-emphasis mb-1">Service areas</div>
            <VChip v-for="area in provider.serviceAreas" :key="area" size="small" variant="tonal" class="me-1 mb-3">{{
              area
            }}</VChip>
            <div class="text-caption text-medium-emphasis">Skills</div>
            <p v-for="[service, skills] in skillRows" :key="service" class="mb-1">
              {{ service }}: {{ skills.join(", ") }}
            </p>
            <VDivider class="my-4" />
            <VRow>
              <VCol cols="6"
                ><div class="text-caption text-medium-emphasis">Capacity in use</div>
                {{ provider.activeJobs }} of {{ provider.capacity }} jobs</VCol
              >
              <VCol cols="6"
                ><div class="text-caption text-medium-emphasis">Availability</div>
                {{ provider.available ? "Accepting new offers" : "Paused" }}</VCol
              >
              <VCol cols="12"
                ><div class="text-caption text-medium-emphasis">Last offered work</div>
                {{ provider.lastOfferedAt ? when(provider.lastOfferedAt) : "Never" }}</VCol
              >
            </VRow>
          </VCardText>
        </VCard>

        <VCard class="mb-5">
          <VCardTitle>Working hours (WAT)</VCardTitle>
          <VCardText>
            <VTable density="compact"
              ><tbody>
                <tr v-for="day in weekdays" :key="day">
                  <td>{{ weekdayLabels[day] }}</td>
                  <td>
                    {{
                      provider.workingHours[day]
                        ? `${provider.workingHours[day]!.start} – ${provider.workingHours[day]!.end}`
                        : "Day off"
                    }}
                  </td>
                </tr>
              </tbody></VTable
            >
            <VDivider class="my-4" />
            <h3 class="text-subtitle-1 mb-2">Upcoming time off</h3>
            <p v-for="period in provider.timeOff" :key="period.id ?? period.from" class="mb-1">
              {{ period.from }} to {{ period.to }}<span v-if="period.note"> · {{ period.note }}</span>
            </p>
            <p v-if="!provider.timeOff.length" class="text-body-2 text-medium-emphasis mb-0">None booked.</p>
          </VCardText>
        </VCard>

        <VCard class="mb-5">
          <VCardTitle>Verification evidence</VCardTitle>
          <VCardText>
            <VAlert variant="tonal" color="info" class="mb-4"
              >Identity file access is logged. Reveal files only when needed for review.</VAlert
            >
            <p class="text-body-2">
              {{ provider.evidenceSummary.documentCount }} verification document(s) ·
              {{ provider.evidenceSummary.hasPhoto ? "Face photo provided" : "No face photo"
              }}<span v-if="provider.evidenceSummary.pendingDocumentCount">
                · {{ provider.evidenceSummary.pendingDocumentCount }} pending document(s)</span
              ><span v-if="provider.evidenceSummary.hasPendingPhoto"> · Updated face photo pending review</span>
            </p>
            <VBtn
              v-if="ops.can('view.provider_identity')"
              variant="outlined"
              class="mb-3"
              @click="openAction('identity-reveal')"
              >Reveal identity documents</VBtn
            >
            <Attachments :files="revealedIdentityFiles" />
            <h3 class="text-subtitle-1 mt-5 mb-2">Portfolio</h3>
            <Attachments :files="provider.portfolio" />
          </VCardText>
        </VCard>

        <VCard v-if="provider.pendingChanges" class="mb-5">
          <VCardTitle>Profile changes awaiting review</VCardTitle>
          <VCardText>
            <VAlert variant="tonal" color="warning" class="mb-4"
              >The current profile remains in effect until these proposed changes are approved.</VAlert
            >
            <VTable density="compact"
              ><thead>
                <tr>
                  <th>Field</th>
                  <th>Current</th>
                  <th>Proposed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="[key, proposed] in pendingChangeEntries" :key="key">
                  <td>{{ key }}</td>
                  <td>{{ currentValueFor(key) }}</td>
                  <td>{{ formatChange(proposed) }}</td>
                </tr>
              </tbody></VTable
            >
            <VCardActions v-if="canReview" class="px-0">
              <VBtn @click="openAction('changes-approve')">Approve changes</VBtn>
              <VBtn variant="outlined" color="warning" @click="openAction('changes-reject')">Reject changes</VBtn>
            </VCardActions>
          </VCardText>
        </VCard>

        <VCard>
          <VCardTitle>Review history</VCardTitle>
          <VCardText>
            <VList v-if="provider.history.length" lines="two" class="py-0">
              <VListItem v-for="(entry, index) in provider.history" :key="`${entry.kind}-${entry.version}-${index}`">
                <template #title
                  >{{ entry.kind.replaceAll("_", " ") }} · {{ entry.decision.replaceAll("_", " ") }}</template
                >
                <template #subtitle
                  >{{ entry.note || "No note" }} · {{ entry.actorId }} · {{ when(entry.createdAt) }}</template
                >
              </VListItem>
            </VList>
            <p v-else class="text-body-2 text-medium-emphasis mb-0">No review history yet.</p>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" lg="4">
        <VCard v-if="canReview" class="mb-5">
          <VCardTitle>Review actions</VCardTitle>
          <VCardText>
            <VChip
              class="mb-3"
              :color="
                provider.reliabilityStatus === 'restricted'
                  ? 'error'
                  : provider.reliabilityStatus === 'review_due' || provider.reliabilityStatus === 'under_review'
                    ? 'warning'
                    : 'success'
              "
              variant="tonal"
              >Reliability: {{ provider.reliabilityStatus.replaceAll("_", " ") }}</VChip
            >
            <VAlert v-if="provider.verification === 'pending' && canReview" variant="tonal" color="info" class="mb-3"
              >Review this provider's identity and service information.</VAlert
            >
            <div v-if="provider.verification === 'pending' && canReview" class="d-flex flex-column gap-2">
              <VBtn @click="openAction('profile-approve')">Approve provider</VBtn>
              <VBtn variant="outlined" @click="openAction('profile-changes')">Request changes</VBtn>
              <VBtn variant="text" color="error" @click="openAction('profile-reject')">Reject provider</VBtn>
            </div>
            <VDivider
              v-if="['review_due', 'under_review'].includes(provider.reliabilityStatus) && canReview"
              class="my-4"
            />
            <div
              v-if="['review_due', 'under_review'].includes(provider.reliabilityStatus) && canReview"
              class="d-flex flex-column gap-2"
            >
              <VBtn variant="outlined" @click="openAction('reliability-clear')">Clear reliability review</VBtn>
              <VBtn color="error" variant="text" @click="openAction('reliability-restrict')">Restrict provider</VBtn>
            </div>
            <div v-if="provider.reliabilityEvents.length" class="mt-4">
              <h3 class="text-subtitle-2 mb-2">No-show history (90 days)</h3>
              <VList density="compact" class="py-0"
                ><VListItem v-for="event in provider.reliabilityEvents" :key="event.id">
                  <template #title>{{ event.kind.replaceAll("_", " ") }}</template>
                  <template #subtitle
                    >{{ when(event.occurredAt) }}<span v-if="event.note"> · {{ event.note }}</span></template
                  >
                </VListItem></VList
              >
            </div>
          </VCardText>
        </VCard>

        <VCard>
          <VCardTitle class="d-flex align-center justify-space-between"
            >Payout details
            <VChip
              size="small"
              :color="
                payoutState === 'Verified' ? 'success' : payoutState === 'Pending review' ? 'warning' : 'secondary'
              "
              variant="tonal"
              >{{ payoutState }}</VChip
            >
          </VCardTitle>
          <VCardText>
            <template v-if="provider.payout.current"
              ><div class="text-caption text-medium-emphasis">Current</div>
              <p>
                {{ provider.payout.current.bankName }} · {{ provider.payout.current.accountNumber }} ·
                {{ provider.payout.current.accountName }}
              </p></template
            >
            <template v-if="provider.payout.pending"
              ><div class="text-caption text-medium-emphasis">Pending</div>
              <p>
                {{ provider.payout.pending.bankName }} · {{ provider.payout.pending.accountNumber }} ·
                {{ provider.payout.pending.accountName }}
              </p></template
            >
            <p v-if="!provider.payout.current && !provider.payout.pending" class="text-body-2 text-medium-emphasis">
              No payout account on record.
            </p>
            <VAlert
              v-if="pendingBank && !accountNameMatches(pendingBank.accountName, fullName)"
              variant="tonal"
              color="warning"
              class="mb-3"
              >Account name differs from the provider name. Check before approving.</VAlert
            >
            <VBtn v-if="pendingBank && hasBankPermission" block class="mb-2" @click="openAction('bank-approve')"
              >Approve bank details</VBtn
            >
            <VBtn
              v-if="pendingBank && hasBankPermission"
              block
              variant="outlined"
              color="warning"
              @click="openAction('bank-reject')"
              >Reject bank details</VBtn
            >
            <VBtn v-if="ops.can('view.bank_full')" block variant="text" class="mt-2" @click="openAction('bank-reveal')"
              >Reveal full bank details</VBtn
            >
            <VDivider v-if="revealedBanks.length" class="my-4" />
            <div v-for="account in revealedBanks" :key="account.id" class="mb-3">
              <div class="text-caption text-medium-emphasis">{{ account.state }} account · {{ account.bankName }}</div>
              <div>{{ account.accountName }} · {{ account.accountNumber }}</div>
            </div>
            <p v-if="provider.payout.review?.note" class="text-body-2">
              Last decision: {{ provider.payout.review.note }}
            </p>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="dialog" max-width="560" persistent>
      <VCard v-if="action && currentAction">
        <VCardTitle>{{ currentAction.title }}</VCardTitle>
        <VCardText>
          <p>{{ currentAction.description }}</p>
          <VAlert
            v-if="action === 'bank-approve' && pendingBank && !accountNameMatches(pendingBank.accountName, fullName)"
            variant="tonal"
            color="warning"
            class="mb-4"
            >The resolved account name does not match the provider name. Verify the identity and account evidence before
            proceeding.</VAlert
          >
          <VRow v-if="action === 'bank-approve' || action === 'bank-reject'">
            <VCol cols="12"
              ><strong>{{ pendingBank?.bankName }}</strong> · {{ pendingBank?.accountNumber }}<br />{{
                pendingBank?.accountName
              }}</VCol
            >
          </VRow>
          <VRow v-if="action === 'delist'">
            <VCol cols="12"
              ><VTextField v-model="password" label="Password" type="password" autocomplete="current-password"
            /></VCol>
            <VCol cols="12"
              ><VTextField v-model="mfaCode" label="Authenticator code (if enabled)" inputmode="numeric"
            /></VCol>
          </VRow>
          <VTextarea
            v-if="requiresNote"
            v-model="note"
            :label="action.includes('reveal') ? 'Reason for access' : 'Reason / review note'"
            rows="3"
            :maxlength="action.includes('reveal') ? 500 : 1000"
            :counter="action.includes('reveal') ? 500 : 1000"
          />
          <VTextarea v-else v-model="note" label="Optional note" rows="2" />
          <VAlert v-if="actionError" type="error" variant="tonal" class="mt-3">{{ actionError }}</VAlert>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn variant="text" :disabled="busy" @click="dialog = false">Cancel</VBtn>
          <VBtn
            :color="currentAction.color"
            :loading="busy"
            :disabled="requiresNote && note.trim().length < 5"
            @click="submitAction"
            >{{ currentAction.confirm }}</VBtn
          >
        </VCardActions>
      </VCard>
    </VDialog>
  </template>
</template>
