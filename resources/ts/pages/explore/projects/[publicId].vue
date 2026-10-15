<script setup lang="ts">
import { projectApi } from "@/services/xpro-api"
import type { TrackedProject } from "@/types/domain"
import { useRemoteData } from "@/composables/useRemoteData"

definePage({ meta: { roles: ["budget_viewer"] } })

const route = useRoute()
const publicId = computed(() => String((route.params as Record<string, string | string[]>).publicId))
const {
  data: project,
  loading,
  error,
  load,
} = useRemoteData(() => projectApi.get(publicId.value), null as TrackedProject | null)
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
</script>

<template>
  <div>
    <VBtn variant="text" prepend-icon="tabler-arrow-left" to="/explore" class="mb-4"> Back to explore </VBtn>
    <VAlert v-if="error" color="error" variant="tonal">
      {{ error }} <VBtn variant="text" @click="load"> Retry </VBtn> </VAlert
    ><VSkeletonLoader v-else-if="loading" type="article, actions, table" />
    <template v-else-if="project">
      <PageHeader
        :eyebrow="`${project.programName} · Approved public version v${project.version}`"
        :title="project.title"
        :description="project.description"
      >
        <template #actions>
          <VBtn variant="outlined" prepend-icon="tabler-share"> Share </VBtn
          ><VBtn v-if="project.actionRequired" color="warning" prepend-icon="tabler-speakerphone"> Take action </VBtn>
        </template>
      </PageHeader>
      <VRow>
        <VCol cols="12" lg="8">
          <VCard class="mb-6">
            <VCardItem>
              <VCardTitle>Project information</VCardTitle
              ><template #append>
                <ProjectStatusChip :status="project.trackingStatus" />
              </template> </VCardItem
            ><VCardText>
              <VRow>
                <VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Location</div>
                  <div class="font-weight-semibold">
                    {{ project.lga }}, {{ project.state }}, {{ project.country }}
                  </div> </VCol
                ><VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Responsible agency</div>
                  <div class="font-weight-semibold">
                    {{ project.agency }}
                  </div> </VCol
                ><VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Fiscal year</div>
                  <div class="font-weight-semibold">
                    {{ project.fiscalYear }}
                  </div> </VCol
                ><VCol cols="12" sm="6">
                  <div class="text-caption text-medium-emphasis">Last verified</div>
                  <div class="font-weight-semibold">
                    {{
                      project.lastVerifiedAt ? new Date(project.lastVerifiedAt).toLocaleDateString() : "Not verified"
                    }}
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
          <VCard>
            <VCardItem
              ><VCardTitle>Approved public evidence</VCardTitle
              ><VCardSubtitle
                >{{ project.evidenceCount }} evidence items are associated with this project</VCardSubtitle
              ></VCardItem
            ><VCardText>
              <VAlert color="info" variant="tonal">
                Evidence previews will appear here after the file API and visibility classifications are connected.
              </VAlert>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="4">
          <VCard class="mb-6 xpro-soft-surface">
            <VCardText class="pa-6">
              <div class="xpro-kicker mb-2">Approved allocation</div>
              <div class="text-h2 font-weight-bold text-primary mb-2">
                {{ money(project.allocation, project.currency) }}
              </div>
              <div class="text-body-2">{{ project.fiscalYear }} Approved Budget</div>
            </VCardText> </VCard
          ><VCard v-if="project.actionRequired">
            <VCardItem><VCardTitle>Why action is needed</VCardTitle></VCardItem
            ><VCardText>
              <p>The latest approved tracking update indicates that this project needs public attention.</p>
              <VBtn block color="warning" prepend-icon="tabler-speakerphone"> View action guidance </VBtn>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </div>
</template>
