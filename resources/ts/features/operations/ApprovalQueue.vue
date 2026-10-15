<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { Command, StaffPermission } from "@/features/operations/types"
import { money } from "@/features/operations/types"
import { accountNameMatches, maskAccount } from "@/features/operations/banks"
import type { PendingApproval } from "@/features/operations/workflow"
import { pendingApprovals, profileChangeRows } from "@/features/operations/workflow"
import { workspaceSections } from "@/features/workspace/config"

type Kind = PendingApproval["kind"]

const ops = useOperationsStore()
const filter = ref<Kind | "all">("all")
const rejectingId = ref("")
const rejectNote = ref("")
const emptyMessage =
  workspaceSections.admin.find(item => item.id === "approvals")?.emptyMessage ?? "Nothing is waiting for approval."

const kinds: { value: Kind; label: string; color: string }[] = [
  { value: "assignment", label: "Assignment", color: "primary" },
  { value: "needs_assignment", label: "Needs assignment", color: "warning" },
  { value: "progress", label: "Progress update", color: "info" },
  { value: "completion", label: "Completion", color: "success" },
  { value: "cancellation", label: "Cancellation", color: "error" },
  { value: "quote", label: "Quote", color: "warning" },
  { value: "provider", label: "Provider", color: "secondary" },
  { value: "provider_changes", label: "Profile changes", color: "secondary" },
  { value: "bank", label: "Bank", color: "secondary" },
]

const permissions: Partial<Record<Kind, StaffPermission>> = {
  assignment: "dispatch.manage",
  progress: "progress.review",
  completion: "progress.review",
  cancellation: "request.cancel",
  provider_changes: "provider.review",
  bank: "bank.review",
}
const items = computed(() => pendingApprovals(ops.state))
const shown = computed(() => items.value.filter(item => filter.value === "all" || item.kind === filter.value))
const kindMeta = (kind: Kind) => kinds.find(item => item.value === kind)!
const countFor = (kind: Kind) => items.value.filter(item => item.kind === kind).length
const providerName = (id?: string) => ops.state.providers.find(item => item.id === id)?.name ?? "Provider"
const requestOf = (item: PendingApproval) => ops.state.requests.find(request => request.id === item.requestId)
const canDecide = (item: PendingApproval) => Boolean(permissions[item.kind] && ops.can(permissions[item.kind]!))
const keyOf = (item: PendingApproval) => `${item.kind}:${item.itemId}`
const linkFor = (item: PendingApproval) =>
  item.kind === "provider" || item.kind === "provider_changes" || item.kind === "bank"
    ? "/admin/providers"
    : `/admin/requests?request=${item.requestId}`

const age = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60000))

  if (!value || Number.isNaN(minutes)) return ""
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`

  return `${Math.round(minutes / 1440)}d`
}

const bankOf = (item: PendingApproval) => ops.state.providers.find(entry => entry.id === item.providerId)?.payout

const summary = (item: PendingApproval) => {
  const request = requestOf(item)

  if (item.kind === "bank") {
    const payout = bankOf(item)
    const account = payout?.pending

    if (!account) return ""
    const mismatch = accountNameMatches(account.accountName, item.title)
      ? ""
      : " · Account name differs from profile name"

    return `${payout.current ? "Bank change" : "New bank details"}: ${account.bankName} ${maskAccount(account.accountNumber)} · ${account.accountName}${mismatch}`
  }

  if (item.kind === "provider_changes") {
    const profile = ops.state.providers.find(entry => entry.id === item.providerId)
    const rows = profile ? profileChangeRows(profile) : []

    return rows.length
      ? `Proposed changes:\n${rows.map(row => `${row.label}: ${row.current} → ${row.proposed}`).join("\n")}`
      : "Profile changes awaiting review."
  }

  if (item.kind === "assignment") {
    const assignment = request?.assignments.find(entry => entry.id === item.itemId)

    return `${providerName(item.providerId)} accepted: ${assignment?.response || "No message."}`
  }
  if (item.kind === "needs_assignment") {
    const offers = request?.dispatch.attempts ?? 0

    return `No eligible provider${offers ? ` after ${offers} ${offers === 1 ? "offer" : "offers"}` : ""}${request ? ` · ${request.service} · ${request.city}` : ""}`
  }
  if (item.kind === "progress" || item.kind === "completion") {
    const update = request?.updates.find(entry => entry.id === item.itemId)

    return `${update?.note ?? ""} · ${update?.attachments.length ?? 0} attachment${update?.attachments.length === 1 ? "" : "s"}`
  }
  if (item.kind === "cancellation") return `Reason: ${request?.cancellationRequest?.note ?? ""}`
  if (item.kind === "quote") {
    const quote = request?.quotes.find(entry => entry.id === item.itemId)

    return `Draft quote total ${money(quote?.total ?? 0)} awaiting sign-off.`
  }

  return "Verification submission awaiting review."
}

const commandFor = (item: PendingApproval, approve: boolean, note: string): Command | undefined => {
  const requestId = item.requestId ?? ""

  if (item.kind === "assignment")
    return { type: "assignment.review", requestId, assignmentId: item.itemId, approve, note }
  if (item.kind === "progress" || item.kind === "completion")
    return { type: "progress.review", requestId, updateId: item.itemId, approve, note }
  if (item.kind === "cancellation") return { type: "cancellation.review", requestId, approve, note }
  if (item.kind === "bank") return { type: "payout.review", providerId: item.providerId ?? "", approve, note }
  if (item.kind === "provider_changes")
    return { type: "provider.changes.review", providerId: item.providerId ?? "", approve, note }

  return undefined
}

const startReject = (item: PendingApproval) => {
  rejectingId.value = keyOf(item)
  rejectNote.value = ""
}

const decide = async (item: PendingApproval, approve: boolean) => {
  const command = commandFor(item, approve, approve ? "" : rejectNote.value)

  if (command && (await ops.run(command))) {
    rejectingId.value = ""
    rejectNote.value = ""
  }
}
</script>

<template>
  <div class="d-flex flex-wrap gap-2 mb-6">
    <VChip :variant="filter === 'all' ? 'flat' : 'tonal'" color="primary" @click="filter = 'all'">
      All · {{ items.length }}
    </VChip>
    <VChip
      v-for="kind in kinds"
      :key="kind.value"
      :variant="filter === kind.value ? 'flat' : 'tonal'"
      :color="kind.color"
      @click="filter = kind.value"
    >
      {{ kind.label }} · {{ countFor(kind.value) }}
    </VChip>
  </div>
  <VCard v-for="item in shown" :key="keyOf(item)" class="mb-4">
    <VCardText>
      <div class="d-flex justify-space-between align-start flex-wrap gap-3">
        <div>
          <div class="d-flex align-center flex-wrap gap-2 mb-2">
            <VChip size="small" variant="tonal" :color="kindMeta(item.kind).color">
              {{ kindMeta(item.kind).label }} </VChip
            ><span class="text-body-2 text-medium-emphasis"
              >{{ item.requestId ?? (item.kind === "bank" ? "Payout details" : "Provider profile") }} · waiting
              {{ age(item.createdAt) }}</span
            >
          </div>
          <h2 class="text-h6 mb-1">
            <RouterLink :to="linkFor(item)" class="text-high-emphasis">
              {{ item.title }}
            </RouterLink>
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-0 summary">
            {{ summary(item) }}
          </p>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <template v-if="permissions[item.kind]">
            <template v-if="canDecide(item)">
              <VBtn size="small" :disabled="ops.busy" @click="decide(item, true)"> Approve </VBtn
              ><VBtn size="small" variant="outlined" color="warning" :disabled="ops.busy" @click="startReject(item)">
                Reject
              </VBtn>
            </template>
          </template>
          <VBtn v-else size="small" variant="outlined" :to="linkFor(item)"> Open </VBtn>
        </div>
      </div>
      <div v-if="rejectingId === keyOf(item)" class="mt-4">
        <VTextarea v-model="rejectNote" label="Reason for rejecting (shared with the requester)" rows="2" />
        <div class="d-flex gap-2">
          <VBtn size="small" color="warning" :disabled="ops.busy" @click="decide(item, false)"> Confirm rejection </VBtn
          ><VBtn size="small" variant="text" @click="rejectingId = ''"> Cancel </VBtn>
        </div>
      </div>
    </VCardText>
  </VCard>
  <VCard v-if="!shown.length">
    <VCardText class="text-center py-12 text-medium-emphasis">
      {{ emptyMessage }}
    </VCardText>
  </VCard>
</template>

<style scoped>
.summary {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
