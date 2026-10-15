<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"

import { required } from "@/features/auth/validation"
import { projectApi } from "@/services/xpro-api"
import type { CreateProjectPayload } from "@/types/domain"
import { DEFAULT_COUNTRY, DEFAULT_STATE, NIGERIAN_STATES } from "@/utils/constants"
import { getErrorMessage } from "@/utils/errors"

definePage({ meta: { roles: ["super_admin", "manager"] } })

const router = useRouter()
const step = ref(1)
const formRef = ref<VForm>()
const showPreview = ref(false)
const loading = ref(false)
const errorMessage = ref("")
const evidenceTitle = ref("")
const evidenceSource = ref("")

const form = reactive<CreateProjectPayload>({
  title: "",
  program: "State Projects Monitoring",
  country: DEFAULT_COUNTRY,
  state: DEFAULT_STATE,
  lga: "",
  fiscalYear: "2026",
  sector: "",
  agency: "",
  amount: 0,
  source: "2026 Approved Budget",
  description: "",
  actionRequired: false,
})

const positiveAmount = (value: unknown) => Number(value) > 0 || "Enter an amount greater than zero."
const longDescription = (value: unknown) =>
  String(value ?? "").trim().length >= 20 || "Use at least 20 characters so the public description is useful."
const evidenceTitleRule = (value: unknown) =>
  !evidenceSource.value.trim() ||
  Boolean(String(value ?? "").trim()) ||
  "Add an evidence title or clear the source reference."
const evidenceSourceRule = (value: unknown) =>
  !evidenceTitle.value.trim() ||
  Boolean(String(value ?? "").trim()) ||
  "Add a source reference or clear the evidence title."
const amountDisplay = computed(() => (form.amount ? `₦${Number(form.amount).toLocaleString("en-NG")}` : "Not provided"))

const readiness = computed(() => [
  {
    label: "Project identity",
    complete: Boolean(form.title.trim() && form.description.trim().length >= 20),
    detail: form.title ? "Title and public description are ready." : "Add a title and plain-language description.",
  },
  {
    label: "Location and agency",
    complete: Boolean(form.country && form.state && form.lga.trim() && form.agency.trim()),
    detail:
      form.state && form.lga
        ? `${form.state}, ${form.lga} · ${form.agency || "Agency missing"}`
        : "Add the delivery location and agency.",
  },
  {
    label: "Allocation source",
    complete: Boolean(form.amount > 0 && form.source.trim()),
    detail: form.amount > 0 ? `${amountDisplay.value} · ${form.source}` : "Add a positive amount and budget source.",
  },
  {
    label: "Evidence",
    complete: Boolean(evidenceTitle.value.trim() && evidenceSource.value.trim()),
    detail: evidenceTitle.value.trim()
      ? `${evidenceTitle.value} · ${evidenceSource.value || "Source reference missing"}`
      : "Add evidence now or from the project workspace before submitting.",
  },
])

const validateStep = async () => {
  errorMessage.value = ""

  const validation = await formRef.value?.validate()
  if (!validation?.valid) return false

  if (step.value < 5) {
    step.value += 1

    return true
  }

  return true
}

const saveDraft = async () => {
  errorMessage.value = ""
  if (!readiness.value.slice(0, 3).every(item => item.complete)) {
    errorMessage.value = "Complete the project, location, and allocation details before saving this draft."
    step.value = readiness.value[0].complete ? (readiness.value[1].complete ? 3 : 2) : 1

    return
  }

  loading.value = true
  try {
    const response = await projectApi.create({ ...form, amount: Number(form.amount) })
    if (evidenceTitle.value.trim() && evidenceSource.value.trim())
      await projectApi.addEvidence(response.data.id, {
        title: evidenceTitle.value.trim(),
        source: evidenceSource.value.trim(),
      })
    await router.push(`/projects/${response.data.id}`)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "We could not save this project draft.")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="New tracked project"
      title="Create a project draft"
      description="The draft stays internal until it is submitted and approved by a Super Admin."
    >
      <template #actions>
        <VBtn variant="text" @click="router.back()"> Cancel </VBtn
        ><VBtn variant="outlined" prepend-icon="tabler-eye" @click="showPreview = true"> Preview </VBtn
        ><VBtn prepend-icon="tabler-device-floppy" :loading="loading" @click="saveDraft"> Save draft </VBtn>
      </template>
    </PageHeader>

    <VAlert v-if="errorMessage" color="error" variant="tonal" class="mb-6">
      {{ errorMessage }}
    </VAlert>

    <VCard class="project-wizard-card">
      <VCardText class="pa-6">
        <VForm ref="formRef" @submit.prevent="validateStep">
          <VStepper
            v-model="step"
            alt-labels
            :items="['Project details', 'Location & agency', 'Allocation', 'Evidence', 'Review']"
          >
            <template #item.1>
              <VRow class="pt-5">
                <VCol cols="12" md="8">
                  <AppTextField
                    v-model="form.title"
                    label="Project title"
                    placeholder="Use the official budget project title"
                    :rules="[
                      required('Project title'),
                      (value: unknown) => String(value ?? '').trim().length >= 3 || 'Use at least 3 characters.',
                    ]"
                  />
                </VCol>
                <VCol cols="12" md="4">
                  <AppSelect
                    v-model="form.program"
                    label="Program"
                    :items="['State Projects Monitoring', 'Primary Healthcare Delivery', 'Community Infrastructure']"
                    :rules="[required('Program')]"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextarea
                    v-model="form.description"
                    label="Plain-language description"
                    placeholder="Explain what the project will deliver and who it serves"
                    rows="4"
                    :rules="[required('Description'), longDescription]"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="form.sector"
                    label="Sector"
                    :items="['Health', 'Education', 'Roads', 'Water', 'Energy']"
                    :rules="[required('Sector')]"
                  />
                </VCol>
                <VCol cols="12" md="6">
                  <AppSelect
                    v-model="form.fiscalYear"
                    label="Fiscal year"
                    :items="['2026', '2025', '2024']"
                    :rules="[required('Fiscal year')]"
                  />
                </VCol>
              </VRow>
            </template>

            <template #item.2>
              <VRow class="pt-5">
                <VCol cols="12" md="4">
                  <AppSelect
                    v-model="form.country"
                    label="Country"
                    :items="[DEFAULT_COUNTRY]"
                    hint="Defaults to Nigeria"
                    persistent-hint
                    readonly
                    :rules="[required('Country')]"
                  />
                </VCol>
                <VCol cols="12" md="4">
                  <AppSelect
                    v-model="form.state"
                    label="State"
                    :items="NIGERIAN_STATES"
                    hint="Defaults to Niger"
                    persistent-hint
                    :rules="[required('State')]"
                  />
                </VCol>
                <VCol cols="12" md="4">
                  <AppTextField
                    v-model="form.lga"
                    label="LGA"
                    placeholder="Enter the local government area"
                    :rules="[required('LGA')]"
                  />
                </VCol>
                <VCol cols="12">
                  <AppTextField
                    v-model="form.agency"
                    label="Responsible agency"
                    placeholder="Name the ministry, department, or agency"
                    :rules="[required('Responsible agency')]"
                  />
                </VCol>
              </VRow>
            </template>

            <template #item.3>
              <VRow class="pt-5">
                <VCol cols="12" md="4">
                  <AppTextField
                    v-model.number="form.amount"
                    label="Approved amount"
                    prefix="₦"
                    type="number"
                    min="1"
                    :rules="[required('Approved amount'), positiveAmount]"
                  />
                </VCol>
                <VCol cols="12" md="8">
                  <AppTextField
                    v-model="form.source"
                    label="Budget source"
                    placeholder="e.g. 2026 Approved Budget"
                    :rules="[required('Budget source')]"
                  />
                </VCol>
                <VCol cols="12">
                  <VCheckbox
                    v-model="form.actionRequired"
                    label="This project requires a viewer-facing Take Action prompt"
                  />
                </VCol>
              </VRow>
            </template>

            <template #item.4>
              <VRow class="pt-5">
                <VCol cols="12" lg="8">
                  <VAlert color="info" variant="tonal" class="mb-5">
                    Evidence is optional while saving a draft, but at least one source reference is required before
                    Admin submission.
                  </VAlert>
                  <AppTextField
                    v-model="evidenceTitle"
                    label="Evidence title"
                    placeholder="2026 approved budget source"
                    :rules="[evidenceTitleRule]"
                    class="mb-5"
                  />
                  <AppTextField
                    v-model="evidenceSource"
                    label="Source reference"
                    placeholder="URL, document ID, or verification note"
                    :rules="[evidenceSourceRule]"
                  />
                </VCol>
                <VCol cols="12" lg="4">
                  <VCard class="xpro-soft-surface h-100" variant="flat">
                    <VCardText class="pa-6">
                      <VAvatar color="primary" variant="tonal" class="mb-4">
                        <VIcon icon="tabler-file-check" />
                      </VAvatar>
                      <div class="text-subtitle-1 font-weight-semibold mb-2">Why evidence matters</div>
                      <p class="text-body-2 mb-0">
                        Evidence supports the project source and helps the Super Admin decide what can become public.
                      </p>
                    </VCardText>
                  </VCard>
                </VCol>
              </VRow>
            </template>

            <template #item.5>
              <VRow class="pt-5">
                <VCol cols="12" lg="7">
                  <VAlert color="info" variant="tonal" class="mb-5">
                    Saving creates a private draft. Review the summary, then continue to the project workspace to submit
                    it for Admin review.
                  </VAlert>
                  <SubmissionReadinessChecklist :items="readiness" />
                </VCol>
                <VCol cols="12" lg="5">
                  <VCard class="xpro-soft-surface h-100" variant="flat">
                    <VCardText class="pa-6">
                      <div class="d-flex align-center justify-space-between mb-6">
                        <div>
                          <div class="xpro-kicker mb-2">Ready to save</div>
                          <div class="text-h5 font-weight-bold">Draft summary</div>
                        </div>
                        <VAvatar color="primary" variant="tonal">
                          <VIcon icon="tabler-file-description" />
                        </VAvatar>
                      </div>
                      <div class="d-flex flex-column gap-5">
                        <div>
                          <div class="text-caption text-medium-emphasis mb-1">Project</div>
                          <div class="font-weight-semibold text-wrap">
                            {{ form.title || "Not provided" }}
                          </div>
                        </div>
                        <div class="d-flex flex-wrap gap-6">
                          <div>
                            <div class="text-caption text-medium-emphasis mb-1">Program</div>
                            <div class="font-weight-semibold">
                              {{ form.program }}
                            </div>
                          </div>
                          <div>
                            <div class="text-caption text-medium-emphasis mb-1">Fiscal year</div>
                            <div class="font-weight-semibold">
                              {{ form.fiscalYear }}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div class="text-caption text-medium-emphasis mb-1">Location</div>
                          <div class="font-weight-semibold">
                            {{ form.state || "State missing" }}{{ form.lga ? `, ${form.lga}` : "" }}
                          </div>
                        </div>
                        <div>
                          <div class="text-caption text-medium-emphasis mb-1">Allocation</div>
                          <div class="text-h5 font-weight-bold text-primary">
                            {{ amountDisplay }}
                          </div>
                        </div>
                      </div>
                    </VCardText>
                  </VCard>
                </VCol>
              </VRow>
            </template>
          </VStepper>
        </VForm>
      </VCardText>
    </VCard>

    <VDialog v-model="showPreview" max-width="760">
      <VCard>
        <VCardItem
          ><VCardTitle>Viewer preview</VCardTitle
          ><VCardSubtitle
            >This preview excludes internal fields and is not public until approved.</VCardSubtitle
          ></VCardItem
        >
        <VDivider />
        <VCardText class="pa-6">
          <div class="xpro-kicker mb-2">{{ form.program }} · {{ form.fiscalYear }}</div>
          <h2 class="text-h4 mb-3">
            {{ form.title || "Untitled project" }}
          </h2>
          <p class="text-body-1 mb-6">
            {{ form.description || "Add a plain-language description to preview this project." }}
          </p>
          <VRow>
            <VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Location</div>
              <div class="font-weight-semibold">
                {{ form.state || "State not selected" }}{{ form.lga ? `, ${form.lga}` : "" }}
              </div> </VCol
            ><VCol cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Allocation</div>
              <div class="font-weight-semibold">
                {{ amountDisplay }}
              </div>
            </VCol>
          </VRow>
        </VCardText>
        <VDivider /><VCardActions class="pa-5">
          <VSpacer /><VBtn @click="showPreview = false"> Close preview </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
