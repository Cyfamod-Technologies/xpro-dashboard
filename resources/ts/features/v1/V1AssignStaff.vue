<script setup lang="ts">
import { isVersionConflict } from "@/features/v1/helpers"
import type { V1Request, V1Staff } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = withDefaults(defineProps<{ request: V1Request; hideTrigger?: boolean }>(), { hideTrigger: false })
const emit = defineEmits<{ updated: [request: V1Request]; refresh: [] }>()

const staff = ref<V1Staff[]>([])
const staffLoaded = ref(false)
const staffId = ref<string | null>(null)
const busy = ref(false)
const error = ref("")
const conflict = ref(false)
const dialogOpen = ref(false)
const openDialog = () => (dialogOpen.value = true)

defineExpose({ openDialog })

const reassigning = computed(() => Boolean(props.request.assignee))
// V1-ASSUMPTION A5: the admin can assign or reassign at any status, so an approved request is never stuck with the
// wrong owner.
const items = computed(() =>
  staff.value
    .filter(member => member.id !== props.request.assignee?.id && !member.roles?.includes("super_admin"))
    .map(member => ({ title: `${member.name} · ${member.openRequests} open`, value: member.id })),
)

onMounted(async () => {
  try {
    staff.value = await v1Api.listStaff()
  } catch (cause) {
    error.value = getErrorMessage(cause, "The staff list could not be loaded.")
  } finally {
    staffLoaded.value = true
  }
})

const assign = async () => {
  if (!staffId.value) return

  busy.value = true
  error.value = ""
  conflict.value = false
  try {
    const updated = await v1Api.assignStaff(
      props.request.id,
      { staffId: staffId.value, expectedOwnerId: props.request.assignee?.id ?? null },
      props.request.version,
    )

    staffId.value = null
    dialogOpen.value = false
    emit("updated", updated)
  } catch (cause) {
    if (isVersionConflict(cause)) conflict.value = true
    else error.value = getErrorMessage(cause, "Staff could not be assigned.")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center justify-space-between gap-3">
      <div>
        <div class="text-caption text-medium-emphasis">Assigned staff</div>
        <div class="text-body-1">{{ request.assignee?.name ?? "Not assigned yet" }}</div>
      </div>
      <VBtn v-if="!hideTrigger" color="primary" variant="outlined" prepend-icon="tabler-user-plus" @click="openDialog">
        {{ reassigning ? "Reassign staff" : "Assign staff" }}
      </VBtn>
    </div>
    <VAlert v-if="conflict" type="warning" variant="tonal" density="compact" class="mb-2">
      This request changed since you opened it.
      <template #append>
        <VBtn size="small" variant="text" @click="emit('refresh')">Refresh request</VBtn>
      </template>
    </VAlert>
    <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">{{ error }}</VAlert>
    <VDialog v-model="dialogOpen" max-width="460" aria-labelledby="assign-staff-title">
      <VCard>
        <VCardTitle id="assign-staff-title">{{ reassigning ? "Reassign request" : "Assign request" }}</VCardTitle>
        <VCardText>
          <p class="text-body-2 text-medium-emphasis">
            {{ request.id }} · {{ request.title }}. Choose the staff member responsible for this request.
          </p>
          <VSelect
            v-if="items.length"
            v-model="staffId"
            :items="items"
            :label="reassigning ? 'Reassign to' : 'Choose staff'"
            density="comfortable"
          />
          <VAlert v-else-if="staffLoaded && !error" type="info" variant="tonal" class="mb-4">
            <div>No eligible staff are available to assign this request.</div>
            <VBtn to="/admin/staff" variant="text" class="mt-2 px-0" prepend-icon="tabler-user-plus">
              Create or invite a staff member
            </VBtn>
          </VAlert>
          <VProgressLinear v-else-if="!staffLoaded" indeterminate color="primary" class="mb-4" />
          <p v-if="staffId" class="text-body-2 mb-0">
            {{ reassigning ? "The request will move to" : "This request will be assigned to" }}
            <strong>{{ staff.find(member => member.id === staffId)?.name }}</strong
            >.
          </p>
        </VCardText>
        <VCardActions class="px-6 pb-5">
          <VSpacer />
          <VBtn variant="text" :disabled="busy" @click="dialogOpen = false">Cancel</VBtn>
          <VBtn color="primary" :disabled="!staffId" :loading="busy" @click="assign">
            Confirm {{ reassigning ? "reassignment" : "assignment" }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
