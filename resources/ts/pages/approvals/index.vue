<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import { submissionApi } from "@/services/xpro-api"
import type { ReviewDecision, Submission } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"
import { getErrorMessage } from "@/utils/errors"
import { required } from "@/features/auth/validation"

definePage({ meta: { roles: ["super_admin"] } })

const route = useRoute()
const { data: submissions, loading, error, load } = useRemoteData(submissionApi.list, [] as Submission[])
const selected = ref<Submission | null>(null)
const decisionNote = ref("")
const decisionError = ref("")
const decisionLoading = ref(false)
const decisionForm = ref<VForm>()
const decisionMessage = ref("")
const showDecisionMessage = ref(false)

const label = (value: string) => value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase())

watch(
  [submissions, () => route.query.submission],
  ([items, id]) => {
    if (!selected.value && typeof id === "string") selected.value = items.find(item => item.id === id) ?? null
  },
  { immediate: true },
)

const openReview = (submission: Submission) => {
  selected.value = submission
  decisionNote.value = ""
  decisionError.value = ""
}

const decide = async (decision: ReviewDecision) => {
  if (!selected.value) return

  decisionError.value = ""

  const validation = await decisionForm.value?.validate()
  if (!validation?.valid) return

  decisionLoading.value = true
  try {
    const response = await submissionApi.decide(selected.value.id, { decision, note: decisionNote.value.trim() })
    const index = submissions.value.findIndex(item => item.id === selected.value?.id)
    if (index >= 0) submissions.value[index] = response.data.submission
    decisionMessage.value =
      decision === "approved"
        ? "Approved and published."
        : decision === "changes_requested"
          ? "Changes requested from the Manager."
          : "Submission rejected."
    showDecisionMessage.value = true
    selected.value = null
  } catch (reviewError) {
    decisionError.value = getErrorMessage(reviewError, "The decision could not be recorded.")
  } finally {
    decisionLoading.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Publication control"
      title="Approval queue"
      description="Compare proposed revisions with current public versions before making a traceable decision."
    />
    <VSnackbar v-model="showDecisionMessage" color="success">
      {{ decisionMessage }}
    </VSnackbar>
    <VAlert v-if="error" color="error" variant="tonal" class="mb-6">
      {{ error }} <VBtn variant="text" @click="load"> Retry </VBtn>
    </VAlert>
    <VCard>
      <VSkeletonLoader v-if="loading" type="table-heading, table-thead, table-tbody" />
      <VTable v-else class="text-no-wrap">
        <thead>
          <tr>
            <th>Submission</th>
            <th>Type</th>
            <th>Manager</th>
            <th>Submitted</th>
            <th>Risk</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="submission in submissions" :key="submission.id">
            <td>
              <div class="font-weight-semibold">
                {{ submission.projectTitle }}
              </div>
              <div class="text-caption">{{ submission.changedFields }} changed fields</div>
            </td>
            <td>{{ label(submission.type) }}</td>
            <td>{{ submission.managerName }}</td>
            <td>{{ new Date(submission.submittedAt).toLocaleDateString() }}</td>
            <td>
              <VChip :color="submission.risk === 'attention' ? 'warning' : 'info'" variant="tonal" size="small">
                {{ submission.risk }}
              </VChip>
            </td>
            <td>
              <VChip
                :color="
                  submission.status === 'pending' ? 'warning' : submission.status === 'approved' ? 'success' : 'error'
                "
                variant="tonal"
                size="small"
              >
                {{ label(submission.status) }}
              </VChip>
            </td>
            <td>
              <VBtn variant="text" append-icon="tabler-arrow-right" @click="openReview(submission)">
                {{ submission.status === "pending" ? "Review" : "View decision" }}
              </VBtn>
            </td>
          </tr>
        </tbody>
      </VTable>
      <VCardText v-if="!loading && !submissions.length" class="text-center py-12">
        <VIcon icon="tabler-circle-check" size="44" color="success" />
        <h2 class="text-h5 mt-4">Approval queue is clear</h2>
        <p class="text-medium-emphasis mb-0">New Manager submissions will appear here.</p>
      </VCardText>
    </VCard>

    <VDialog :model-value="Boolean(selected)" max-width="820" @update:model-value="selected = null">
      <VCard v-if="selected">
        <VCardItem
          ><VCardTitle>Review proposed revision</VCardTitle
          ><VCardSubtitle>{{ selected.projectTitle }}</VCardSubtitle></VCardItem
        >
        <VDivider />
        <VCardText class="pa-6">
          <VAlert v-if="decisionError" color="error" variant="tonal" class="mb-5">
            {{ decisionError }}
          </VAlert>
          <VAlert color="info" variant="tonal" class="mb-6">
            The final review view will show field-level differences, evidence visibility, and the viewer preview from
            the API.
          </VAlert>
          <VRow>
            <VCol cols="6">
              <div class="text-caption">Submitted by</div>
              <strong>{{ selected.managerName }}</strong> </VCol
            ><VCol cols="6">
              <div class="text-caption">Changed fields</div>
              <strong>{{ selected.changedFields }}</strong>
            </VCol>
          </VRow>
          <VForm ref="decisionForm" class="mt-6" @submit.prevent="decide('approved')">
            <AppTextarea
              v-model="decisionNote"
              label="Decision note"
              placeholder="Explain the publication decision or requested changes"
              rows="3"
              :rules="[
                required('Decision note'),
                (value: unknown) => String(value ?? '').trim().length >= 10 || 'Use at least 10 characters.',
              ]"
            />
          </VForm>
        </VCardText>
        <VDivider />
        <VCardActions class="pa-5">
          <VBtn color="error" variant="text" :loading="decisionLoading" @click="decide('rejected')"> Reject </VBtn
          ><VBtn color="warning" variant="tonal" :loading="decisionLoading" @click="decide('changes_requested')">
            Request changes </VBtn
          ><VSpacer /><VBtn color="success" :loading="decisionLoading" @click="decide('approved')">
            Approve & publish
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
