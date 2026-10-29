<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import type { BankAccount } from "@/features/operations/types"
import { weekdayLabels, weekdays, when } from "@/features/operations/types"
import { accountNameMatches, maskAccount } from "@/features/operations/banks"
import { activeJobs, profileChangeRows } from "@/features/operations/workflow"
import { watMoment } from "@/features/operations/hours"
import Attachments from "@/features/operations/Attachments.vue"

const ops = useOperationsStore()

onMounted(async () => {
  if (isDemoMode) return
  try {
    await ops.loadProvidersForReview()
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to load provider reviews."
  }
})
const search = ref("")
const status = ref("")
const selectedId = ref("")
const note = ref("")
const bankNote = ref("")
const changesNote = ref("")
const providers = computed(() =>
  ops.state.providers.filter(
    item =>
      (!status.value || item.verification === status.value) &&
      `${item.name} ${item.email} ${item.city} ${item.serviceAreas.join(" ")} ${item.services.join(" ")} ${item.trade}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
)
const selected = computed(() => ops.state.providers.find(item => item.id === selectedId.value))
const accountLine = (account: BankAccount) =>
  `${account.bankName} · ${ops.can("bank.review") ? account.accountNumber : maskAccount(account.accountNumber)} · ${account.accountName}`
const pendingChanges = computed(() =>
  selected.value?.pendingChanges && selected.value.changesReview?.state === "pending"
    ? selected.value.pendingChanges
    : null,
)
const changeRows = computed(() => (selected.value ? profileChangeRows(selected.value) : []))
const jobsOf = (providerId: string) => activeJobs(ops.state, providerId)
const today = computed(() => watMoment(Date.now())?.date ?? "")
const upcomingTimeOff = computed(() => (selected.value?.timeOff ?? []).filter(item => item.to >= today.value))
const skillRows = computed(() => Object.entries(selected.value?.skills ?? {}).filter(([, list]) => list?.length))
const dateText = (value: string) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
const pendingBank = computed(() =>
  selected.value?.payout.review?.state === "pending" ? selected.value.payout.pending : null,
)
</script>

<template>
  <VCard class="mb-5">
    <VCardText>
      <VRow>
        <VCol cols="12" sm="7">
          <VTextField v-model="search" label="Search name, trade, service or area" hide-details /> </VCol
        ><VCol cols="12" sm="5">
          <VSelect
            v-model="status"
            label="Verification status"
            :items="[
              { title: 'Profile not started', value: 'draft' },
              { title: 'Pending review', value: 'pending' },
              { title: 'Approved', value: 'approved' },
              { title: 'Changes requested', value: 'changes_requested' },
              { title: 'Rejected', value: 'rejected' },
            ]"
            item-title="title"
            item-value="value"
            hide-details
            clearable
            @click:clear="status = ''"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
  <VRow>
    <VCol v-for="provider in providers" :key="provider.id" cols="12" md="6">
      <VCard>
        <VCardText>
          <h2 class="text-h5 mb-2">
            {{ provider.name }}
          </h2>
          <p v-if="!provider.registrationOnly">{{ provider.trade }} · {{ provider.city }}</p>
          <VChip color="primary" variant="tonal" class="mb-3">
            {{ provider.registrationOnly ? "Profile not started" : provider.verification.replaceAll("_", " ") }}
          </VChip
          ><VChip
            v-if="provider.pendingChanges && provider.changesReview?.state === 'pending'"
            color="warning"
            variant="tonal"
            class="mb-3 ms-2"
          >
            Changes to review
          </VChip>
          <p v-if="provider.registrationOnly" class="text-body-2">
            {{ provider.email }} · Signed up {{ provider.registeredAt ? when(provider.registeredAt) : "date unavailable" }}
            · Account {{ provider.accountStatus }}
          </p>
          <p v-else class="text-body-2">
            {{ provider.services.join(" · ") }}<br />{{
              provider.available ? "Accepting new jobs" : "Not accepting new jobs"
            }}
            · {{ jobsOf(provider.id) }} of {{ provider.capacity }} jobs active
          </p>
          <VBtn
            v-if="!provider.registrationOnly"
            variant="outlined"
            @click="
              () => {
                selectedId = provider.id
                note = ''
                bankNote = ''
                changesNote = ''
              }
            "
          >
            Review profile
          </VBtn>
        </VCardText>
      </VCard>
    </VCol> </VRow
  ><VAlert v-if="!providers.length" variant="tonal" color="info"> No providers match this search. </VAlert>
  <VDialog :model-value="Boolean(selected)" max-width="680" @update:model-value="!$event && (selectedId = '')">
    <VCard v-if="selected">
      <VCardText>
        <div class="d-flex justify-space-between align-center mb-3">
          <h2 class="text-h5">
            {{ selected.name }}
          </h2>
          <VBtn icon="tabler-x" variant="text" aria-label="Close profile review" @click="selectedId = ''" />
        </div>
        <p>
          {{ selected.email }} · {{ selected.phone }}<br />{{ selected.trade }} · {{ selected.city }} ·
          {{ selected.experience }} years
        </p>
        <p>{{ selected.bio }}</p>
        <p>{{ selected.services.join(" · ") }}</p>
        <h3 class="text-h6 mt-5 mb-3">Coverage and capacity</h3>
        <dl class="coverage">
          <dt>Service areas</dt>
          <dd>
            <VChip v-for="area in selected.serviceAreas" :key="area" size="small" variant="tonal" class="me-1 mb-1">
              {{ area }} </VChip
            ><template v-if="!selected.serviceAreas.length"> None listed </template>
          </dd>
          <dt>Skills</dt>
          <dd>
            <div v-for="[service, list] in skillRows" :key="service" class="mb-1">
              <strong>{{ service }}:</strong> {{ list!.join(", ") }}
            </div>
            <template v-if="!skillRows.length"> None listed </template>
          </dd>
          <dt>Capacity</dt>
          <dd>{{ jobsOf(selected.id) }} of {{ selected.capacity }} jobs active</dd>
          <dt>Accepting jobs</dt>
          <dd>{{ selected.available ? "Yes" : "No" }}</dd>
          <dt>Last offered work</dt>
          <dd>{{ selected.lastOfferedAt ? when(selected.lastOfferedAt) : "Never" }}</dd>
        </dl>
        <h3 class="text-h6 mt-5 mb-3">Weekly working hours (WAT)</h3>
        <VTable density="compact">
          <tbody>
            <tr v-for="day in weekdays" :key="day">
              <td>{{ weekdayLabels[day] }}</td>
              <td>
                {{
                  selected.workingHours[day]
                    ? `${selected.workingHours[day]!.start} – ${selected.workingHours[day]!.end}`
                    : "Day off"
                }}
              </td>
            </tr>
          </tbody>
        </VTable>
        <h3 class="text-h6 mt-5 mb-3">Upcoming time off</h3>
        <p v-for="item in upcomingTimeOff" :key="item.id" class="mb-1">
          {{ item.from === item.to ? dateText(item.from) : `${dateText(item.from)} to ${dateText(item.to)}`
          }}<template v-if="item.note"> · {{ item.note }} </template>
        </p>
        <p v-if="!upcomingTimeOff.length" class="text-body-2 text-medium-emphasis">None booked.</p>
        <h3 class="text-h6 mt-5 mb-3">Private verification documents</h3>
        <Attachments :files="selected.documents" />
        <h3 class="text-h6 mt-5 mb-3">Face photo (staff only)</h3>
        <Attachments v-if="selected.photo" :files="[selected.photo]" />
        <p v-else class="text-body-2 text-medium-emphasis">No photo submitted.</p>
        <h3 class="text-h6 mt-5 mb-3">Public portfolio</h3>
        <Attachments :files="selected.portfolio" />
        <p v-if="selected.reviewNote" class="mt-4">Last review: {{ selected.reviewNote }}</p>
        <template v-if="selected.verification === 'pending' && ops.can('provider.review')">
          <VTextarea v-model="note" label="Review note / changes required" class="mt-5" /><VAlert
            v-if="ops.error"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            {{ ops.error }}
          </VAlert>
          <div class="d-flex flex-wrap gap-2">
            <VBtn
              :disabled="ops.busy"
              @click="ops.run({ type: 'provider.review', providerId: selected.id, decision: 'approved', note })"
            >
              Approve provider </VBtn
            ><VBtn
              variant="outlined"
              :disabled="ops.busy"
              @click="
                ops.run({ type: 'provider.review', providerId: selected.id, decision: 'changes_requested', note })
              "
            >
              Request changes </VBtn
            ><VBtn
              variant="text"
              color="error"
              :disabled="ops.busy"
              @click="ops.run({ type: 'provider.review', providerId: selected.id, decision: 'rejected', note })"
            >
              Reject
            </VBtn>
          </div>
        </template>
        <template v-if="pendingChanges">
          <VDivider class="my-6" />
          <h3 class="text-h6 mb-2">Profile changes awaiting review</h3>
          <p class="text-body-2 text-medium-emphasis">
            The provider stays public with the current details until you approve.
          </p>
          <div v-for="row in changeRows" :key="row.label" class="change-row">
            <strong>{{ row.label }}</strong>
            <div class="text-body-2"><span class="text-medium-emphasis">Current:</span> {{ row.current }}</div>
            <div class="text-body-2"><span class="text-medium-emphasis">Proposed:</span> {{ row.proposed }}</div>
          </div>
          <Attachments :files="pendingChanges.documents" /><Attachments
            v-if="pendingChanges.photo"
            :files="[pendingChanges.photo]"
          /><template v-if="ops.can('provider.review')">
            <VTextarea v-model="changesNote" label="Review note (required to reject)" rows="2" class="mt-4" /><VAlert
              v-if="ops.error"
              color="error"
              variant="tonal"
              class="mb-4"
            >
              {{ ops.error }}
            </VAlert>
            <div class="d-flex flex-wrap gap-2">
              <VBtn
                :disabled="ops.busy"
                @click="
                  ops.run({
                    type: 'provider.changes.review',
                    providerId: selected.id,
                    approve: true,
                    note: changesNote,
                  })
                "
              >
                Approve changes </VBtn
              ><VBtn
                variant="outlined"
                color="warning"
                :disabled="ops.busy"
                @click="
                  ops.run({
                    type: 'provider.changes.review',
                    providerId: selected.id,
                    approve: false,
                    note: changesNote,
                  })
                "
              >
                Reject changes
              </VBtn>
            </div>
          </template>
        </template>
        <VDivider class="my-6" />
        <div class="d-flex justify-space-between align-center flex-wrap gap-2 mb-3">
          <h3 class="text-h6">Payout details</h3>
          <VChip
            v-if="selected.payout.review"
            size="small"
            variant="tonal"
            :color="
              selected.payout.review.state === 'approved'
                ? 'success'
                : selected.payout.review.state === 'pending'
                  ? 'warning'
                  : 'error'
            "
          >
            Bank review: {{ selected.payout.review.state }}
          </VChip>
        </div>
        <p v-if="selected.payout.current" class="mb-1">
          <strong>Current:</strong> {{ accountLine(selected.payout.current) }}
        </p>
        <p v-if="selected.payout.pending" class="mb-1">
          <strong>Pending:</strong> {{ accountLine(selected.payout.pending) }}
        </p>
        <p v-if="!selected.payout.current && !selected.payout.pending" class="text-body-2 text-medium-emphasis">
          No bank details on record.
        </p>
        <p v-if="selected.payout.review?.state === 'rejected' && selected.payout.review.note" class="text-body-2">
          Last rejection: {{ selected.payout.review.note }}
        </p>
        <template v-if="selected.payout.history.length">
          <p v-for="(entry, index) in selected.payout.history" :key="index" class="text-body-2 mb-1">
            {{ entry.action }}<template v-if="entry.note"> · {{ entry.note }} </template>
            <span class="text-medium-emphasis">{{ entry.by }} · {{ when(entry.createdAt) }}</span>
          </p> </template
        ><template v-if="pendingBank && ops.can('bank.review')">
          <VAlert
            v-if="!accountNameMatches(pendingBank.accountName, selected.name)"
            color="warning"
            variant="tonal"
            class="mt-4"
          >
            Account name differs from profile name — check before approving. </VAlert
          ><VTextarea v-model="bankNote" label="Bank review note (required to reject)" rows="2" class="mt-4" /><VAlert
            v-if="ops.error"
            color="error"
            variant="tonal"
            class="mb-4"
          >
            {{ ops.error }}
          </VAlert>
          <div class="d-flex flex-wrap gap-2">
            <VBtn
              :disabled="ops.busy"
              @click="ops.run({ type: 'payout.review', providerId: selected.id, approve: true, note: bankNote })"
            >
              Approve bank details </VBtn
            ><VBtn
              variant="outlined"
              color="warning"
              :disabled="ops.busy"
              @click="ops.run({ type: 'payout.review', providerId: selected.id, approve: false, note: bankNote })"
            >
              Reject bank details
            </VBtn>
          </div>
        </template>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.change-row {
  margin-block-end: 0.75rem;
  overflow-wrap: anywhere;
}
.coverage dt {
  font-size: 0.8rem;
  opacity: 0.7;
  margin-block-start: 0.75rem;
}
.coverage dd {
  margin-block-start: 0.25rem;
  overflow-wrap: anywhere;
}
</style>
