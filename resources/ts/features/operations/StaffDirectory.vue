<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { StaffMember, StaffRole } from "@/features/operations/types"
import { isFinished, when } from "@/features/operations/types"
import { activeStaffWith, staffRoleLabels } from "@/features/operations/staff"
import { isDemoMode } from "@/utils/demo-mode"

const ops = useOperationsStore()
const roleItems = (Object.keys(staffRoleLabels) as StaffRole[]).map(value => ({ title: staffRoleLabels[value], value }))
const statusColors = { active: "success", invited: "info", suspended: "warning" } as const

const inviteDialog = ref(false)
const invite = reactive<{ firstName: string; lastName: string; email: string; roles: StaffRole[] }>({
  firstName: "",
  lastName: "",
  email: "",
  roles: [],
})
const rolesTarget = ref<StaffMember>()
const rolesDraft = ref<StaffRole[]>([])
const suspendTarget = ref<StaffMember>()
const reassignTo = ref("")

const openRequests = (member: StaffMember) =>
  ops.state.requests.filter(item => item.staffOwnerId === member.id && !isFinished(item.status)).length
const successors = computed(() =>
  activeStaffWith(ops.state, "request.claim")
    .filter(item => item.id !== suspendTarget.value?.id)
    .map(item => ({ title: item.name, value: item.id })),
)
const needsSuccessor = computed(() => (suspendTarget.value ? openRequests(suspendTarget.value) > 0 : false))

const openInvite = () => {
  ops.error = ""
  Object.assign(invite, { firstName: "", lastName: "", email: "", roles: [] })
  inviteDialog.value = true
}

const sendInvite = async () => {
  if (
    await ops.run({
      type: "staff.invite",
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email,
      roles: [...invite.roles],
    })
  )
    inviteDialog.value = false
}

const openRoles = (member: StaffMember) => {
  ops.error = ""
  rolesTarget.value = member
  rolesDraft.value = [...member.roles]
}

const saveRoles = async () => {
  if (
    rolesTarget.value &&
    (await ops.run({ type: "staff.roles", staffId: rolesTarget.value.id, roles: [...rolesDraft.value] }))
  )
    rolesTarget.value = undefined
}

const openSuspend = (member: StaffMember) => {
  ops.error = ""
  suspendTarget.value = member
  reassignTo.value = ""
}

const suspend = async () => {
  if (
    suspendTarget.value &&
    (await ops.run({
      type: "staff.status",
      staffId: suspendTarget.value.id,
      status: "suspended",
      reassignTo: needsSuccessor.value ? reassignTo.value : "",
    }))
  )
    suspendTarget.value = undefined
}
</script>

<template>
  <div class="d-flex justify-space-between align-start flex-wrap gap-4 mb-5">
    <p v-if="isDemoMode" class="text-body-2 text-medium-emphasis mb-0">
      Demo mode: invited staff appear here but only seeded demo accounts can sign in.
    </p>
    <VBtn prepend-icon="tabler-user-plus" @click="openInvite"> Invite staff </VBtn>
  </div>
  <VCard>
    <VTable>
      <thead>
        <tr>
          <th>Name</th>
          <th>Roles</th>
          <th>Status</th>
          <th>Open requests</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="member in ops.state.staff" :key="member.id">
          <td class="py-3">
            <strong>{{ member.name }}</strong>
            <div class="text-body-2 text-medium-emphasis">
              {{ member.email }}
            </div>
            <div class="text-caption text-medium-emphasis">Invited {{ when(member.invitedAt) }}</div>
          </td>
          <td>
            <div class="d-flex flex-wrap gap-1">
              <VChip v-for="role in member.roles" :key="role" size="small" variant="tonal" color="primary">
                {{ staffRoleLabels[role] }}
              </VChip>
            </div>
          </td>
          <td>
            <VChip size="small" variant="tonal" :color="statusColors[member.status]">
              {{ member.status }}
            </VChip>
          </td>
          <td>{{ openRequests(member) }}</td>
          <td class="text-end">
            <div class="d-flex flex-wrap justify-end gap-1">
              <VBtn size="small" variant="text" @click="openRoles(member)"> Edit roles </VBtn
              ><VBtn
                v-if="member.status !== 'suspended' && member.id !== ops.actor?.id"
                size="small"
                variant="text"
                color="warning"
                @click="openSuspend(member)"
              >
                Suspend </VBtn
              ><VBtn
                v-if="member.status !== 'active'"
                size="small"
                variant="text"
                :disabled="ops.busy"
                @click="ops.run({ type: 'staff.status', staffId: member.id, status: 'active', reassignTo: '' })"
              >
                {{ member.status === "invited" && isDemoMode ? "Activate (demo)" : "Reactivate" }}
              </VBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </VTable>
  </VCard>

  <VDialog v-model="inviteDialog" max-width="480">
    <VCard>
      <VCardText>
        <h2 class="text-h5 mb-4">Invite staff</h2>
        <VTextField v-model="invite.firstName" label="First name" autocomplete="given-name" /><VTextField
          v-model="invite.lastName"
          label="Last name"
          autocomplete="family-name"
        /><VTextField v-model="invite.email" label="Email address" type="email" /><VSelect
          v-model="invite.roles"
          :items="roleItems"
          label="Staff roles"
          multiple
          chips
        /><VAlert v-if="ops.error" color="error" variant="tonal" class="mb-4">
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="inviteDialog = false"> Cancel </VBtn
          ><VBtn :loading="ops.busy" @click="sendInvite"> Send invitation </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog
    :model-value="Boolean(rolesTarget)"
    max-width="480"
    @update:model-value="!$event && (rolesTarget = undefined)"
  >
    <VCard v-if="rolesTarget">
      <VCardText>
        <h2 class="text-h5 mb-4">Edit roles for {{ rolesTarget.name }}</h2>
        <VSelect v-model="rolesDraft" :items="roleItems" label="Staff roles" multiple chips /><VAlert
          v-if="ops.error"
          color="error"
          variant="tonal"
          class="mb-4"
        >
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="rolesTarget = undefined"> Cancel </VBtn
          ><VBtn :loading="ops.busy" @click="saveRoles"> Save roles </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog
    :model-value="Boolean(suspendTarget)"
    max-width="480"
    @update:model-value="!$event && (suspendTarget = undefined)"
  >
    <VCard v-if="suspendTarget">
      <VCardText>
        <h2 class="text-h5 mb-3">Suspend {{ suspendTarget.name }}?</h2>
        <p>They will be signed out and cannot act until reactivated. Their history is kept.</p>
        <template v-if="needsSuccessor">
          <p>
            {{ suspendTarget.name }} owns {{ openRequests(suspendTarget) }} open request{{
              openRequests(suspendTarget) === 1 ? "" : "s"
            }}. Choose who takes them over.
          </p>
          <VSelect v-model="reassignTo" :items="successors" label="Reassign open requests to" /> </template
        ><VAlert v-if="ops.error" color="error" variant="tonal" class="mb-4">
          {{ ops.error }}
        </VAlert>
        <div class="d-flex justify-end gap-2">
          <VBtn variant="text" @click="suspendTarget = undefined"> Keep active </VBtn
          ><VBtn color="warning" :loading="ops.busy" :disabled="needsSuccessor && !reassignTo" @click="suspend">
            Suspend account
          </VBtn>
        </div>
      </VCardText>
    </VCard>
  </VDialog>
</template>
