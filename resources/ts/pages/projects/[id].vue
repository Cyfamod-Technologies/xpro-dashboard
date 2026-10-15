<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import { allocationApi, projectApi } from "@/services/xpro-api"
import { useAuthStore } from "@/stores/auth"
import type { Allocation, TrackedProject } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"
import { getErrorMessage } from "@/utils/errors"
import { required } from "@/features/auth/validation"

definePage({ meta: { roles: ["super_admin", "manager"] } })

const route = useRoute()
const auth = useAuthStore()
const projectId = computed(() => String((route.params as Record<string, string | string[]>).id))
const {
  data: project,
  loading,
  error,
  load,
} = useRemoteData(() => projectApi.get(projectId.value), null as TrackedProject | null)
const { data: allocations, loading: allocationsLoading } = useRemoteData(allocationApi.list, [] as Allocation[])

const activeTab = ref("overview")
const showPreview = ref(false)
const showSubmitDialog = ref(false)
const showEvidenceDialog = ref(false)
const submissionNote = ref("")
const evidenceTitle = ref("")
const evidenceSource = ref("")
const submitError = ref("")
const evidenceError = ref("")
const submitLoading = ref(false)
const evidenceLoading = ref(false)
const submitForm = ref<VForm>()
const evidenceForm = ref<VForm>()
const snackbarMessage = ref("")
const showSnackbar = ref(false)

const projectAllocation = computed(() => allocations.value.find(item => item.projectId === project.value?.id))
const isManager = computed(() => auth.user?.role === "manager")
const canSubmit = computed(
  () => isManager.value && ["draft", "changes_requested"].includes(project.value?.approvalStatus ?? ""),
)

const readiness = computed(() => {
  const current = project.value
  const source = projectAllocation.value?.source

  return [
    {
      label: "Project identity",
      complete: Boolean(current?.title && current.description),
      detail: current?.title ? "Title and description are present." : "Add a title and plain-language description.",
    },
    {
      label: "Location and agency",
      complete: Boolean(current?.country && current.state && current.lga && current.agency),
      detail: current?.agency
        ? `${current.state}, ${current.lga} · ${current.agency}`
        : "Add the delivery location and responsible agency.",
    },
    {
      label: "Allocation source",
      complete: Boolean(current?.allocation && source),
      detail: source ?? "Add an approved budget source and amount.",
    },
    {
      label: "Evidence",
      complete: Boolean(current?.evidenceCount),
      detail: current?.evidenceCount
        ? `${current.evidenceCount} evidence items attached.`
        : "Attach at least one source or evidence item before submitting.",
    },
  ]
})

const isReadyForSubmission = computed(() => readiness.value.every(item => item.complete))

const statusText = computed(() => {
  if (!project.value) return ""
  if (project.value.approvalStatus === "submitted") return "This project is awaiting Super Admin review."
  if (project.value.approvalStatus === "published") return "This is the current approved public version."
  if (project.value.approvalStatus === "changes_requested")
    return "Resolve the review feedback, then submit the revision again."

  return "This draft is private until it is approved and published."
})

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount)
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "Not verified"

const openSubmitDialog = () => {
  submitError.value = ""
  submissionNote.value = ""
  showSubmitDialog.value = true
}

const openEvidenceDialog = () => {
  evidenceError.value = ""
  evidenceTitle.value = ""
  evidenceSource.value = ""
  showEvidenceDialog.value = true
}

const addEvidence = async () => {
  evidenceError.value = ""

  const validation = await evidenceForm.value?.validate()
  if (!validation?.valid) return

  evidenceLoading.value = true
  try {
    const response = await projectApi.addEvidence(projectId.value, {
      title: evidenceTitle.value.trim(),
      source: evidenceSource.value.trim(),
    })

    project.value = response.data
    showEvidenceDialog.value = false
    snackbarMessage.value = "Prototype evidence attached to this draft."
    showSnackbar.value = true
  } catch (evidenceRequestError) {
    evidenceError.value = getErrorMessage(evidenceRequestError)
  } finally {
    evidenceLoading.value = false
  }
}

const submitForReview = async () => {
  submitError.value = ""

  const validation = await submitForm.value?.validate()
  if (!validation?.valid) return
  if (!isReadyForSubmission.value) {
    submitError.value = "Complete every readiness item before submitting this project."

    return
  }

  submitLoading.value = true
  try {
    const response = await projectApi.submit(projectId.value, { note: submissionNote.value.trim() })

    project.value = response.data.project
    showSubmitDialog.value = false
    snackbarMessage.value = "Project submitted for Super Admin review."
    showSnackbar.value = true
  } catch (submissionError) {
    submitError.value = getErrorMessage(submissionError)
  } finally {
    submitLoading.value = false
  }
}
</script>

<template>
  <div>
    <VBtn variant="text" prepend-icon="tabler-arrow-left" to="/projects" class="mb-4"> Back to projects </VBtn>
    <VAlert v-if="error" color="error" variant="tonal" class="mb-6">
      {{ error }} <VBtn variant="text" @click="load"> Retry </VBtn>
    </VAlert>
    <VSkeletonLoader v-else-if="loading" type="article, actions, table" />

    <template v-else-if="project">
      <PageHeader
        :eyebrow="`${project.programName} · ${project.fiscalYear}`"
        :title="project.title"
        :description="project.description"
      >
        <template #actions>
          <VBtn variant="outlined" prepend-icon="tabler-eye" @click="showPreview = true"> Viewer preview </VBtn>
          <VBtn v-if="canSubmit" prepend-icon="tabler-send" @click="openSubmitDialog"> Submit for review </VBtn>
          <VBtn
            v-else-if="project.approvalStatus === 'published' && isManager"
            variant="outlined"
            prepend-icon="tabler-git-branch"
          >
            Propose update
          </VBtn>
        </template>
      </PageHeader>

      <VAlert color="info" variant="tonal" class="mb-6">
        <div class="font-weight-semibold">
          {{ statusText }}
        </div>
        <div v-if="project.approvalStatus === 'submitted'" class="text-body-2 mt-1">
          The last approved version remains unchanged while this submission is reviewed.
        </div>
      </VAlert>

      <VRow>
        <VCol cols="12" lg="8">
          <VCard class="mb-6">
            <VCardItem>
              <VCardTitle>Project workspace</VCardTitle>
              <template #append>
                <ProjectStatusChip :status="project.approvalStatus" />
              </template>
            </VCardItem>
            <VDivider />
            <VTabs v-model="activeTab" grow>
              <VTab value="overview"> Overview </VTab>
              <VTab value="allocation"> Allocation </VTab>
              <VTab value="evidence"> Evidence </VTab>
              <VTab value="tracking"> Tracking & actions </VTab>
              <VTab value="history"> Revisions & activity </VTab>
            </VTabs>
            <VDivider />

            <VWindow v-model="activeTab">
              <VWindowItem value="overview">
                <VCardText>
                  <VRow>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Location</div>
                      <div class="font-weight-semibold">
                        {{ project.state }}, {{ project.lga }} · {{ project.country }}
                      </div>
                    </VCol>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Responsible agency</div>
                      <div class="font-weight-semibold">
                        {{ project.agency }}
                      </div>
                    </VCol>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Allocation</div>
                      <div class="text-h5 font-weight-bold text-primary">
                        {{ money(project.allocation, project.currency) }}
                      </div>
                    </VCol>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Last verified</div>
                      <div class="font-weight-semibold">
                        {{ date(project.lastVerifiedAt) }}
                      </div>
                    </VCol>
                  </VRow>
                </VCardText>
                <VDivider />
                <VCardText>
                  <div class="text-subtitle-1 font-weight-semibold mb-3">Submission readiness</div>
                  <SubmissionReadinessChecklist :items="readiness" />
                </VCardText>
              </VWindowItem>

              <VWindowItem value="allocation">
                <VCardText>
                  <VSkeletonLoader v-if="allocationsLoading" type="table" />
                  <VTable v-else-if="projectAllocation" class="text-no-wrap">
                    <thead>
                      <tr>
                        <th>Fiscal year</th>
                        <th>Source</th>
                        <th>Agency</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{{ projectAllocation.fiscalYear }}</td>
                        <td>{{ projectAllocation.source }}</td>
                        <td>{{ projectAllocation.agency }}</td>
                        <td class="font-weight-semibold">
                          {{ money(projectAllocation.amount, projectAllocation.currency) }}
                        </td>
                        <td><ProjectStatusChip :status="projectAllocation.approvalStatus" /></td>
                      </tr>
                    </tbody>
                  </VTable>
                  <VAlert v-else color="warning" variant="tonal">
                    No allocation has been added to this project yet.
                  </VAlert>
                </VCardText>
              </VWindowItem>

              <VWindowItem value="evidence">
                <VCardText>
                  <div class="d-flex align-center justify-space-between mb-4">
                    <div>
                      <div class="text-subtitle-1 font-weight-semibold">Source evidence</div>
                      <div class="text-body-2 text-medium-emphasis">
                        Evidence is reviewed before a record can be published.
                      </div>
                    </div>
                    <VBtn
                      v-if="isManager && ['draft', 'changes_requested'].includes(project.approvalStatus)"
                      variant="outlined"
                      prepend-icon="tabler-upload"
                      @click="openEvidenceDialog"
                    >
                      Add evidence
                    </VBtn>
                  </div>
                  <VAlert v-if="!project.evidenceCount" color="warning" variant="tonal">
                    No evidence has been attached. Add a source document or approved URL before submitting.
                  </VAlert>
                  <VList v-else lines="two" class="pa-0">
                    <VListItem
                      v-for="index in project.evidenceCount"
                      :key="index"
                      :title="`Evidence item ${index}`"
                      :subtitle="
                        index === 1
                          ? 'Source reference · visibility pending review'
                          : 'Field verification record · internal draft'
                      "
                      class="px-0"
                    >
                      <template #prepend>
                        <VAvatar color="success" variant="tonal" size="38" class="me-3">
                          <VIcon icon="tabler-file-check" />
                        </VAvatar>
                      </template>
                    </VListItem>
                  </VList>
                </VCardText>
              </VWindowItem>

              <VWindowItem value="tracking">
                <VCardText>
                  <VRow>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Tracking status</div>
                      <div class="d-flex align-center gap-3 mt-2">
                        <ProjectStatusChip :status="project.trackingStatus" /><span class="text-body-2"
                          >Updated from the latest verification.</span
                        >
                      </div>
                    </VCol>
                    <VCol cols="12" sm="6">
                      <div class="text-caption text-medium-emphasis">Public action</div>
                      <div class="d-flex align-center gap-3 mt-2">
                        <VChip :color="project.actionRequired ? 'warning' : 'success'" variant="tonal">
                          {{ project.actionRequired ? "Action required" : "No action open" }}
                        </VChip>
                      </div>
                    </VCol>
                  </VRow>
                  <VDivider class="my-6" />
                  <VAlert color="info" variant="tonal">
                    Action and outcome capture will use this project context and require evidence before the update can
                    be submitted.
                  </VAlert>
                  <VBtn class="mt-5" variant="outlined" prepend-icon="tabler-message-plus">
                    Record tracking update
                  </VBtn>
                </VCardText>
              </VWindowItem>

              <VWindowItem value="history">
                <VCardText>
                  <VTimeline side="end" density="compact" line-inset="8">
                    <VTimelineItem dot-color="success" size="small">
                      <div class="font-weight-semibold">Current version v{{ project.version }}</div>
                      <div class="text-caption text-medium-emphasis">
                        {{
                          project.approvalStatus === "published" ? "Approved public version" : "Latest internal version"
                        }}
                      </div>
                    </VTimelineItem>
                    <VTimelineItem dot-color="info" size="small">
                      <div class="font-weight-semibold">Project record created</div>
                      <div class="text-caption text-medium-emphasis">
                        Initial project details were saved in the workspace.
                      </div>
                    </VTimelineItem>
                  </VTimeline>
                </VCardText>
              </VWindowItem>
            </VWindow>
          </VCard>
        </VCol>

        <VCol cols="12" lg="4">
          <VCard class="mb-6">
            <VCardItem><VCardTitle>Publication</VCardTitle></VCardItem>
            <VCardText>
              <div class="d-flex justify-space-between mb-4">
                <span>Approval state</span><ProjectStatusChip :status="project.approvalStatus" />
              </div>
              <div class="d-flex justify-space-between mb-4">
                <span>Version</span><strong>v{{ project.version }}</strong>
              </div>
              <div class="d-flex justify-space-between">
                <span>Last verified</span><strong>{{ date(project.lastVerifiedAt) }}</strong>
              </div>
            </VCardText>
          </VCard>
          <VCard>
            <VCardItem><VCardTitle>Ownership</VCardTitle></VCardItem>
            <VCardText>
              <div class="font-weight-semibold">
                {{ project.managerName }}
              </div>
              <div class="text-caption text-medium-emphasis">Operations Manager · {{ project.programName }}</div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>

    <VDialog v-model="showPreview" max-width="760">
      <VCard v-if="project">
        <VCardItem
          ><VCardTitle>Viewer preview</VCardTitle
          ><VCardSubtitle>This is the approved-public shape a Budget Viewer will see.</VCardSubtitle></VCardItem
        >
        <VDivider />
        <VCardText class="pa-6">
          <VAlert v-if="project.approvalStatus !== 'published'" color="warning" variant="tonal" class="mb-5">
            This record is not public yet. The preview is shown for review only.
          </VAlert>
          <div class="xpro-kicker mb-2">{{ project.programName }} · {{ project.fiscalYear }}</div>
          <h2 class="text-h4 mb-3">
            {{ project.title }}
          </h2>
          <p class="text-body-1 mb-6">
            {{ project.description }}
          </p>
          <VRow>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Location</div>
              <div class="font-weight-semibold">{{ project.state }}, {{ project.lga }}</div> </VCol
            ><VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Approved allocation</div>
              <div class="font-weight-semibold">
                {{ money(project.allocation, project.currency) }}
              </div>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider /><VCardActions class="pa-5">
          <VSpacer /><VBtn @click="showPreview = false"> Close preview </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="showSubmitDialog" max-width="620">
      <VCard>
        <VCardItem
          ><VCardTitle>Submit project for review</VCardTitle
          ><VCardSubtitle>Super Admin approval is required before this record becomes public.</VCardSubtitle></VCardItem
        >
        <VDivider />
        <VCardText class="pa-6">
          <VAlert v-if="submitError" color="error" variant="tonal" class="mb-5">
            {{ submitError }}
          </VAlert>
          <SubmissionReadinessChecklist :items="readiness" />
          <VForm ref="submitForm" class="mt-5" @submit.prevent="submitForReview">
            <AppTextarea
              v-model="submissionNote"
              label="Submission note"
              placeholder="Summarise what is ready for review"
              :rules="[
                required('Submission note'),
                (value: unknown) => String(value ?? '').trim().length >= 10 || 'Use at least 10 characters.',
              ]"
              rows="3"
            />
          </VForm>
        </VCardText>
        <VDivider /><VCardActions class="pa-5">
          <VBtn variant="text" @click="showSubmitDialog = false"> Cancel </VBtn><VSpacer /><VBtn
            :disabled="!isReadyForSubmission"
            :loading="submitLoading"
            @click="submitForReview"
          >
            Submit for review
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="showEvidenceDialog" max-width="620">
      <VCard>
        <VCardItem
          ><VCardTitle>Add prototype evidence</VCardTitle
          ><VCardSubtitle
            >Use a source reference now; file uploads will be connected when the API is ready.</VCardSubtitle
          ></VCardItem
        >
        <VDivider />
        <VCardText class="pa-6">
          <VAlert v-if="evidenceError" color="error" variant="tonal" class="mb-5">
            {{ evidenceError }}
          </VAlert>
          <VForm ref="evidenceForm" @submit.prevent="addEvidence">
            <AppTextField
              v-model="evidenceTitle"
              label="Evidence title"
              placeholder="2026 budget source"
              :rules="[required('Evidence title')]"
              class="mb-4"
            />
            <AppTextField
              v-model="evidenceSource"
              label="Source reference"
              placeholder="URL, document ID, or verification note"
              :rules="[required('Source reference')]"
            />
          </VForm>
        </VCardText>
        <VDivider /><VCardActions class="pa-5">
          <VBtn variant="text" @click="showEvidenceDialog = false"> Cancel </VBtn><VSpacer /><VBtn
            :loading="evidenceLoading"
            @click="addEvidence"
          >
            Attach evidence
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VSnackbar v-model="showSnackbar" color="success">
      {{ snackbarMessage }}
    </VSnackbar>
  </div>
</template>
