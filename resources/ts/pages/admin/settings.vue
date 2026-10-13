<script setup lang="ts">
import { DEFAULT_COUNTRY, DEFAULT_STATE, NIGERIAN_STATES } from '@/utils/constants'

definePage({ meta: { roles: ['super_admin'] } })

const saved = ref(false)
const settings = reactive({ country: DEFAULT_COUNTRY, state: DEFAULT_STATE, currency: 'NGN', fiscalYear: '2026', viewerRegistration: true, managerMfa: true })
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="System settings"
      description="Prototype defaults for geography, fiscal context, registration and staff security."
    />
    <VSnackbar
      v-model="saved"
      color="success"
    >
      Prototype settings saved.
    </VSnackbar>
    <VRow>
      <VCol
        cols="12"
        lg="8"
      >
        <VCard>
          <VCardItem><VCardTitle>Platform defaults</VCardTitle></VCardItem><VCardText>
            <VRow>
              <VCol
                cols="12"
                sm="6"
              >
                <AppSelect
                  v-model="settings.country"
                  label="Default country"
                  :items="[DEFAULT_COUNTRY]"
                  hint="Nigeria is the platform country"
                  persistent-hint
                  readonly
                />
              </VCol><VCol
                cols="12"
                sm="6"
              >
                <AppSelect
                  v-model="settings.state"
                  label="Default state"
                  :items="NIGERIAN_STATES"
                  hint="Budget viewers start in Niger"
                  persistent-hint
                />
              </VCol><VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="settings.currency"
                  label="Default currency"
                  :items="['NGN']"
                />
              </VCol><VCol
                cols="12"
                md="6"
              >
                <AppSelect
                  v-model="settings.fiscalYear"
                  label="Current fiscal year"
                  :items="['2026', '2025']"
                />
              </VCol><VCol cols="12">
                <VSwitch
                  v-model="settings.viewerRegistration"
                  label="Allow public Budget Viewer registration"
                  color="primary"
                />
              </VCol><VCol cols="12">
                <VSwitch
                  v-model="settings.managerMfa"
                  label="Require MFA for Managers and Super Admins"
                  color="primary"
                  disabled
                />
              </VCol>
            </VRow>
          </VCardText><VCardActions class="pa-5">
            <VSpacer /><VBtn @click="saved = true">
              Save settings
            </VBtn>
          </VCardActions>
        </VCard>
      </VCol><VCol
        cols="12"
        lg="4"
      >
        <VAlert
          color="warning"
          variant="tonal"
          title="API configuration pending"
        >
          Email, storage, map and workflow-provider settings remain deferred until their backend services are selected.
        </VAlert>
      </VCol>
    </VRow>
  </div>
</template>
