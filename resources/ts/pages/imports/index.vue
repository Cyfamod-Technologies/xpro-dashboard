<script setup lang="ts">
definePage({ meta: { roles: ['super_admin', 'manager'] } })

const stage = ref<'upload' | 'validating' | 'ready'>('upload')

const start = () => {
  stage.value = 'validating'
  setTimeout(() => {
    stage.value = 'ready'
  }, 900)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Bulk data"
      title="CSV imports"
      description="Validate new project and allocation data before creating internal drafts. Imports never bypass Super Admin approval."
    >
      <template #actions>
        <VBtn
          variant="outlined"
          prepend-icon="tabler-download"
        >
          Download template
        </VBtn>
      </template>
    </PageHeader>
    <VCard>
      <VCardText class="pa-8">
        <div
          v-if="stage === 'upload'"
          class="text-center py-10"
        >
          <VAvatar
            color="primary"
            variant="tonal"
            size="72"
            class="mb-5"
          >
            <VIcon
              icon="tabler-file-spreadsheet"
              size="36"
            />
          </VAvatar><h2 class="text-h4 mb-2">
            Upload project allocation CSV
          </h2><p class="text-medium-emphasis mb-6">
            The prototype will simulate header, location, currency and duplicate validation.
          </p><VBtn
            prepend-icon="tabler-upload"
            @click="start"
          >
            Select prototype file
          </VBtn>
        </div><div
          v-else-if="stage === 'validating'"
          class="text-center py-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
            size="56"
            class="mb-5"
          /><h2 class="text-h5">
            Validating 24 rows
          </h2><p class="text-medium-emphasis">
            Checking required fields and references…
          </p>
        </div><div v-else>
          <VAlert
            color="success"
            variant="tonal"
            class="mb-6"
            title="Ready to create drafts"
          >
            22 rows are valid. Two rows need correction and no public data has been changed.
          </VAlert><VTable>
            <thead><tr><th>Result</th><th>Rows</th><th>Next step</th></tr></thead><tbody>
              <tr>
                <td>
                  <VChip
                    color="success"
                    size="small"
                  >
                    Valid
                  </VChip>
                </td><td>22</td><td>Create internal drafts</td>
              </tr><tr>
                <td>
                  <VChip
                    color="warning"
                    size="small"
                  >
                    Needs correction
                  </VChip>
                </td><td>2</td><td>Download row errors</td>
              </tr>
            </tbody>
          </VTable><div class="d-flex justify-end gap-3 mt-6">
            <VBtn
              variant="outlined"
              @click="stage = 'upload'"
            >
              Start over
            </VBtn><VBtn>Create 22 drafts</VBtn>
          </div>
        </div>
      </VCardText>
    </VCard>
  </div>
</template>
