<script setup lang="ts">
import type { StaffRole } from "@/features/operations/types"
import type { IdentityCheck, Offboarding, OwnedRequestsInput, StaffMemberView, StaffOwner } from "@/services/staff-api"
import { staffApi } from "@/services/staff-api"
import StaffCommandDialog from "@/features/staff/StaffCommandDialog.vue"
import type { CommandContext } from "@/features/staff/StaffCommandDialog.vue"
import SuccessorStep from "@/features/staff/SuccessorStep.vue"
import { fullName, identityCheckLabels, roleItems, rolesCanOwn, todayWat } from "@/features/staff/staff-helpers"

export type StaffAction =
  | "invite"
  | "resend"
  | "revoke"
  | "roles"
  | "rename"
  | "suspend"
  | "reactivate"
  | "deactivate"
  | "mfa"
  | "leave"
  | "clearLeave"

const props = defineProps<{
  /** The open action, or null when no dialog is showing. */
  action: StaffAction | null
  /** The member acted on; null for a fresh invite. */
  member: StaffMemberView | null
  /** Pre-filled invite fields for "Invite again". */
  prefill?: { firstName: string; lastName: string; email: string } | null
}>()

const emit = defineEmits<{ close: []; changed: [member: StaffMemberView]; stale: [] }>()

const open = computed({
  get: () => props.action !== null,
  set: value => {
    if (!value) emit("close")
  },
})
const is = (name: StaffAction) => props.action === name
const version = computed(() => props.member?.rowVersion)
const name = computed(() => (props.member ? fullName(props.member) : ""))
const inviteRoleItems = roleItems.filter(item => item.value === "operations" || item.value === "client_relations")

// ---- form state, reset whenever a dialog opens ----
const first = ref("")
const last = ref("")
const email = ref("")
const roles = ref<StaffRole[]>([])
const securityIncident = ref(false)
const resetMfa = ref(false)
const identityCheck = ref<IdentityCheck | "">("")
const confirmName = ref("")
const owned = ref<OwnedRequestsInput | undefined>(undefined)
const ownedComplete = ref(false)
const leaveFrom = ref("")
const leaveTo = ref("")
const leaveDelegate = ref("")
const leaveNote = ref("")
const owners = ref<StaffOwner[]>([])
const offboarding = ref<Offboarding | null>(null)

watch(
  () => props.action,
  action => {
    if (!action) return
    const member = props.member
    first.value = action === "invite" ? (props.prefill?.firstName ?? "") : (member?.firstName ?? "")
    last.value = action === "invite" ? (props.prefill?.lastName ?? "") : (member?.lastName ?? "")
    email.value = props.prefill?.email ?? ""
    roles.value = action === "invite" ? [] : [...(member?.roles ?? [])]
    securityIncident.value = false
    resetMfa.value = Boolean(member?.suspension?.securityIncident)
    identityCheck.value = ""
    confirmName.value = ""
    owned.value = undefined
    ownedComplete.value = false
    leaveFrom.value = todayWat()
    leaveTo.value = ""
    leaveDelegate.value = ""
    leaveNote.value = ""
    if (action === "leave")
      staffApi
        .owners(member?.id)
        .then(response => (owners.value = response.data))
        .catch(() => (owners.value = []))
  },
  { immediate: true },
)

const toggleRole = (role: StaffRole) => {
  roles.value = roles.value.includes(role) ? roles.value.filter(item => item !== role) : [...roles.value, role]
}

const sameRoles = computed(
  () =>
    props.member !== null &&
    roles.value.length === props.member.roles.length &&
    roles.value.every(role => props.member!.roles.includes(role)),
)

// A successor is needed when the member owns open requests and will no longer be able to own them.
const hasOwned = computed(() => (props.member?.workload.openOwned ?? 0) > 0)
const rolesNeedSuccessor = computed(
  () => hasOwned.value && Boolean(props.member?.canOwnRequests) && !rolesCanOwn(roles.value),
)
const needsSuccessor = computed(() =>
  is("roles") ? rolesNeedSuccessor.value : (is("suspend") || is("deactivate")) && hasOwned.value,
)
const successorOk = computed(() => !needsSuccessor.value || ownedComplete.value)

const emailOk = computed(() => {
  const value = email.value.trim()
  const at = value.indexOf("@")

  return at > 0 && at === value.lastIndexOf("@") && value.indexOf(".", at) > at + 1 && !value.includes(" ")
})
const inviteValid = computed(
  () => first.value.trim().length > 0 && last.value.trim().length > 0 && emailOk.value && roles.value.length > 0,
)
const renameValid = computed(
  () =>
    first.value.trim().length > 0 &&
    last.value.trim().length > 0 &&
    (first.value.trim() !== props.member?.firstName || last.value.trim() !== props.member?.lastName),
)
const leaveValid = computed(() => Boolean(leaveFrom.value && leaveTo.value && leaveTo.value >= leaveFrom.value))

const settle = (member: StaffMemberView, result?: { offboarding?: Offboarding }) => {
  emit("changed", member)
  if (result?.offboarding && (result.offboarding.ownedRequests.length || result.offboarding.sessionsRevoked))
    offboarding.value = result.offboarding
}

const options = () => ({ version: version.value })

const runInvite = async ({ reauthToken }: CommandContext) => {
  const response = await staffApi.invite(
    { firstName: first.value.trim(), lastName: last.value.trim(), email: email.value.trim(), roles: roles.value },
    { reauthToken },
  )
  settle(response.data)
}
const runResend = async () => settle((await staffApi.resend(props.member!.id)).data)
const runRevoke = async ({ reason }: CommandContext) => settle((await staffApi.revoke(props.member!.id, reason)).data)
const runRoles = async ({ reason, reauthToken }: CommandContext) => {
  const response = await staffApi.changeRoles(
    props.member!.id,
    { roles: roles.value, reason, ...(owned.value ? { ownedRequests: owned.value } : {}) },
    { ...options(), reauthToken },
  )
  settle(response.data.member, response.data)
}
const runRename = async ({ reason }: CommandContext) =>
  settle(
    (
      await staffApi.rename(
        props.member!.id,
        { firstName: first.value.trim(), lastName: last.value.trim(), reason },
        options(),
      )
    ).data,
  )
const runSuspend = async ({ reason, reauthToken }: CommandContext) => {
  const response = await staffApi.suspend(
    props.member!.id,
    { reason, securityIncident: securityIncident.value, ...(owned.value ? { ownedRequests: owned.value } : {}) },
    { ...options(), reauthToken },
  )
  settle(response.data.member, response.data)
}
const runReactivate = async ({ reason, reauthToken }: CommandContext) =>
  settle(
    (
      await staffApi.reactivate(
        props.member!.id,
        { roles: roles.value, reason, resetMfa: resetMfa.value },
        { ...options(), reauthToken },
      )
    ).data,
  )
const runDeactivate = async ({ reason, reauthToken }: CommandContext) => {
  const response = await staffApi.deactivate(
    props.member!.id,
    { reason, ...(owned.value ? { ownedRequests: owned.value } : {}) },
    { ...options(), reauthToken },
  )
  settle(response.data.member, response.data)
}
const runMfa = async ({ reason, reauthToken }: CommandContext) =>
  settle(
    (
      await staffApi.resetMfa(
        props.member!.id,
        { reason, identityCheck: identityCheck.value as IdentityCheck },
        { reauthToken },
      )
    ).data,
  )
const runLeave = async () =>
  settle(
    (
      await staffApi.setLeave(
        props.member!.id,
        {
          from: leaveFrom.value,
          to: leaveTo.value,
          ...(leaveDelegate.value ? { delegateId: leaveDelegate.value } : {}),
          ...(leaveNote.value.trim() ? { note: leaveNote.value.trim() } : {}),
        },
        options(),
      )
    ).data,
  )
const runClearLeave = async () => settle((await staffApi.clearLeave(props.member!.id, options())).data)

const delegateItems = computed(() =>
  owners.value.map(owner => ({
    title: `${owner.name} · ${owner.workload.openOwned} open`,
    value: owner.id,
    props: { disabled: owner.onLeave },
  })),
)
const showOwnerNote = computed(() => is("leave") && (props.member?.workload.openOwned ?? 0) > 0 && !leaveDelegate.value)
</script>

<template>
  <!-- Invite -->
  <StaffCommandDialog
    :model-value="is('invite') && open"
    title="Invite staff"
    confirm-label="Send invitation"
    :step-up="roles.includes('super_admin')"
    :valid="inviteValid"
    :run="runInvite"
    @update:model-value="open = $event"
  >
    <VRow>
      <VCol cols="12" sm="6"><VTextField v-model="first" label="First name" autocomplete="off" /></VCol>
      <VCol cols="12" sm="6"><VTextField v-model="last" label="Last name" autocomplete="off" /></VCol>
      <VCol cols="12">
        <VTextField
          v-model="email"
          label="Email address"
          type="email"
          autocomplete="off"
          hint="The invitation goes here. It expires after 72 hours and can only be used once."
          persistent-hint
        />
      </VCol>
    </VRow>
    <fieldset class="border-0 pa-0 mt-3">
      <legend class="text-body-1 font-weight-medium mb-1">Staff roles</legend>
      <VCheckbox
        v-for="item in inviteRoleItems"
        :key="item.value"
        :model-value="roles.includes(item.value)"
        :label="item.title"
        hide-details
        density="compact"
        @update:model-value="toggleRole(item.value)"
      >
        <template #label>
          <div>
            <div>{{ item.title }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.description }}</div>
          </div>
        </template>
      </VCheckbox>
    </fieldset>
    <VAlert v-if="roles.includes('super_admin')" type="warning" variant="tonal" density="compact" class="mt-3">
      Super admins can do everything, including managing staff. Other super admins are told.
    </VAlert>
    <VAlert v-if="prefill" type="info" variant="tonal" density="compact" class="mt-3">
      This starts a new employment period. Nothing from before carries over.
    </VAlert>
  </StaffCommandDialog>

  <!-- Resend -->
  <StaffCommandDialog
    :model-value="is('resend') && open"
    title="Resend invitation"
    confirm-label="Resend invitation"
    :run="runResend"
    @update:model-value="open = $event"
  >
    <p class="mb-0">
      {{ name }} gets a new link that lasts 72 hours. The old link stops working and any password already set is
      cleared.
    </p>
  </StaffCommandDialog>

  <!-- Revoke -->
  <StaffCommandDialog
    :model-value="is('revoke') && open"
    title="Revoke invitation"
    confirm-label="Revoke invitation"
    confirm-color="error"
    reason
    reason-label="Why is this invitation being revoked?"
    :run="runRevoke"
    @update:model-value="open = $event"
  >
    <p class="mb-0">The link stops working. {{ name }} is not emailed. To bring them back, invite them again.</p>
  </StaffCommandDialog>

  <!-- Roles -->
  <StaffCommandDialog
    :model-value="is('roles') && open"
    :title="`Edit roles for ${name}`"
    confirm-label="Save roles"
    reason
    reason-label="Why are the roles changing?"
    step-up
    :valid="roles.length > 0 && !sameRoles && successorOk"
    :run="runRoles"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <fieldset class="border-0 pa-0">
      <legend class="text-body-1 font-weight-medium mb-1">Staff roles</legend>
      <VCheckbox
        v-for="item in roleItems"
        :key="item.value"
        :model-value="roles.includes(item.value)"
        hide-details
        density="compact"
        @update:model-value="toggleRole(item.value)"
      >
        <template #label>
          <div>
            <div>{{ item.title }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.description }}</div>
          </div>
        </template>
      </VCheckbox>
    </fieldset>
    <VAlert v-if="roles.length === 0" type="error" variant="tonal" density="compact" class="mt-3">
      Choose at least one role.
    </VAlert>
    <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
      {{ name }} is emailed about this change. Open sessions keep working; permissions update on their next action.
    </p>
    <SuccessorStep
      v-if="rolesNeedSuccessor && member"
      v-model="owned"
      v-model:complete="ownedComplete"
      class="mt-4"
      :staff-id="member.id"
      :name="name"
      :open-owned="member.workload.openOwned"
    />
  </StaffCommandDialog>

  <!-- Rename -->
  <StaffCommandDialog
    :model-value="is('rename') && open"
    :title="`Rename ${name}`"
    confirm-label="Save name"
    reason
    reason-label="Why is the name changing?"
    :valid="renameValid"
    :run="runRename"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <VRow>
      <VCol cols="12" sm="6"><VTextField v-model="first" label="First name" /></VCol>
      <VCol cols="12" sm="6"><VTextField v-model="last" label="Last name" /></VCol>
    </VRow>
    <p class="text-body-2 text-medium-emphasis mb-0">Past activity keeps showing the name used at the time.</p>
  </StaffCommandDialog>

  <!-- Suspend -->
  <StaffCommandDialog
    :model-value="is('suspend') && open"
    :title="`Suspend ${name}?`"
    confirm-label="Suspend account"
    confirm-color="warning"
    reason
    reason-label="Why is this account being suspended?"
    step-up
    :valid="successorOk"
    :run="runSuspend"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <p>
      {{ name }} is signed out everywhere immediately and cannot act until reactivated. They are emailed that access is
      suspended, without the reason. Other super admins are told.
    </p>
    <VCheckbox v-model="securityIncident" hide-details density="compact">
      <template #label>
        <div>
          <div>This is a security incident</div>
          <div class="text-caption text-medium-emphasis">
            Their sign-in verification will be reset when reactivated.
          </div>
        </div>
      </template>
    </VCheckbox>
    <SuccessorStep
      v-if="needsSuccessor && member"
      v-model="owned"
      v-model:complete="ownedComplete"
      class="mt-4"
      :staff-id="member.id"
      :name="name"
      :open-owned="member.workload.openOwned"
    />
  </StaffCommandDialog>

  <!-- Reactivate -->
  <StaffCommandDialog
    :model-value="is('reactivate') && open"
    :title="`Reactivate ${name}`"
    confirm-label="Reactivate"
    reason
    reason-label="Why is access being restored?"
    step-up
    :valid="roles.length > 0"
    :run="runReactivate"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <p>Confirm the roles {{ name }} will have when they return.</p>
    <VCheckbox
      v-for="item in roleItems"
      :key="item.value"
      :model-value="roles.includes(item.value)"
      :label="item.title"
      hide-details
      density="compact"
      @update:model-value="toggleRole(item.value)"
    />
    <VCheckbox
      v-model="resetMfa"
      label="Reset sign-in verification"
      hide-details
      density="compact"
      class="mt-2"
      :disabled="Boolean(member?.suspension?.securityIncident)"
    />
    <p v-if="member?.suspension?.securityIncident" class="text-caption text-medium-emphasis mb-0">
      Required because the suspension was a security incident.
    </p>
  </StaffCommandDialog>

  <!-- Deactivate -->
  <StaffCommandDialog
    :model-value="is('deactivate') && open"
    :title="`Deactivate ${name}?`"
    confirm-label="Deactivate permanently"
    confirm-color="error"
    reason
    reason-label="Why is this person leaving?"
    step-up
    :valid="confirmName.trim().toLowerCase() === name.toLowerCase() && successorOk"
    :run="runDeactivate"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <VAlert type="error" variant="tonal" class="mb-4">
      This is permanent. {{ name }}'s password and sign-in verification are deleted. They can only return through a new
      invitation. Their history is kept.
    </VAlert>
    <SuccessorStep
      v-if="needsSuccessor && member"
      v-model="owned"
      v-model:complete="ownedComplete"
      class="mb-4"
      :staff-id="member.id"
      :name="name"
      :open-owned="member.workload.openOwned"
    />
    <VTextField v-model="confirmName" :label="`Type ${name} to confirm`" autocomplete="off" />
  </StaffCommandDialog>

  <!-- MFA reset -->
  <StaffCommandDialog
    :model-value="is('mfa') && open"
    :title="`Reset sign-in verification for ${name}`"
    confirm-label="Reset verification"
    confirm-color="warning"
    reason
    reason-label="Why is it being reset?"
    step-up
    :valid="identityCheck !== ''"
    :run="runMfa"
    @update:model-value="open = $event"
  >
    <p>
      All of {{ name }}'s sessions end and they must set up verification again at their next sign-in. Their password is
      unchanged. They and the other super admins are emailed.
    </p>
    <VSelect
      v-model="identityCheck"
      :items="Object.entries(identityCheckLabels).map(([value, title]) => ({ value, title }))"
      label="How did you confirm who they are?"
    />
  </StaffCommandDialog>

  <!-- Leave -->
  <StaffCommandDialog
    :model-value="is('leave') && open"
    :title="`Set leave for ${name}`"
    confirm-label="Set leave"
    :valid="leaveValid"
    :run="runLeave"
    @update:model-value="open = $event"
    @stale="emit('stale')"
  >
    <VRow>
      <VCol cols="12" sm="6"><VTextField v-model="leaveFrom" label="From" type="date" :min="todayWat()" /></VCol>
      <VCol cols="12" sm="6"><VTextField v-model="leaveTo" label="To" type="date" :min="leaveFrom" /></VCol>
      <VCol cols="12">
        <VSelect
          v-model="leaveDelegate"
          :items="delegateItems"
          label="Who covers? (optional)"
          clearable
          hint="Only staff who can own requests and are not on leave."
          persistent-hint
        />
      </VCol>
      <VCol cols="12"><VTextField v-model="leaveNote" label="Note (optional)" maxlength="500" /></VCol>
    </VRow>
    <VAlert v-if="showOwnerNote" type="warning" variant="tonal" density="compact">
      {{ name }} owns {{ member?.workload.openOwned }} open request(s). Add someone to cover, or hand them off.
    </VAlert>
  </StaffCommandDialog>

  <!-- Clear leave -->
  <StaffCommandDialog
    :model-value="is('clearLeave') && open"
    title="Clear leave"
    confirm-label="Clear leave"
    :run="runClearLeave"
    @update:model-value="open = $event"
  >
    <p class="mb-0">{{ name }} is no longer on leave, and their delegate stops covering for them.</p>
  </StaffCommandDialog>

  <!-- What happened to the leaver's work -->
  <VDialog :model-value="Boolean(offboarding)" max-width="520" @update:model-value="offboarding = null">
    <VCard v-if="offboarding">
      <VCardTitle class="pt-5 px-6 text-h5">Hand-over complete</VCardTitle>
      <VCardText class="px-6">
        <ul class="ps-5">
          <li v-if="offboarding.sessionsRevoked">Signed out everywhere.</li>
          <li v-if="offboarding.pendingInvitesSent">
            {{ offboarding.pendingInvitesSent }} invitation(s) they sent are still pending and stay valid.
          </li>
          <li v-if="!offboarding.ownedRequests.length">No open requests to move.</li>
        </ul>
        <div v-if="offboarding.ownedRequests.length">
          <p class="mb-1 font-weight-medium">{{ offboarding.ownedRequests.length }} request(s) moved</p>
          <ul class="ps-5">
            <li v-for="item in offboarding.ownedRequests" :key="item.requestId">
              {{ item.code }} · {{ item.title }} →
              {{ item.toName ?? "Unclaimed queue" }}
            </li>
          </ul>
        </div>
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn @click="offboarding = null">Done</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
