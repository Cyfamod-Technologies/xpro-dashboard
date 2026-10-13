<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'
import { serviceLines } from '@/features/workspace/config'
import { intakeFields } from '@/features/operations/types'
import type { RequestInput } from '@/features/operations/types'
import { prepareFiles } from '@/features/operations/files'
import Attachments from '@/features/operations/Attachments.vue'
import { useAuthStore } from '@/stores/auth'
import { useOperationsStore } from '@/stores/operations'

const auth = useAuthStore()
const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()
const draftKey = 'xpro-public-request-draft'
const formRef = ref<VForm>()
const error = ref('')
const files = ref<File[]>([])
const submitted = ref('')
const blank: RequestInput = { title: '', service: 'Design', city: '', address: '', phone: ops.preferences?.phone ?? '', description: '', budget: 0, startDate: '', details: {}, attachments: [] }
let initial = blank
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as RequestInput | null
  if (saved && saved.service in intakeFields)
    initial = saved
}
catch { /* Start a new brief if a saved draft cannot be read. */ }
const form = reactive<RequestInput>(initial)
if (typeof route.query.service === 'string' && route.query.service in intakeFields)
  form.service = route.query.service as RequestInput['service']
if (typeof route.query.provider === 'string')
  form.details.preferredProviderId = route.query.provider
const preferred = computed(() => ops.publicProviders.find(item => item.id === form.details.preferredProviderId))

watch(() => form.service, service => {
  const provider = ops.publicProviders.find(item => item.id === form.details.preferredProviderId)

  form.details = provider?.services.includes(service) ? { preferredProviderId: provider.id } : {}
})

const required = (value: unknown) => Boolean(String(value ?? '').trim()) || 'This field is required.'
const saveDraft = () => sessionStorage.setItem(draftKey, JSON.stringify(form))

const submit = async () => {
  error.value = ''
  if (!(await formRef.value?.validate())?.valid)
    return
  try {
    form.attachments = [...form.attachments, ...await prepareFiles(files.value)]
    files.value = []
    saveDraft()
    if (!auth.isAuthenticated) {
      await router.push({ path: '/login', query: { redirect: '/request' } })

      return
    }
    if (await ops.run({ type: 'request.create', input: JSON.parse(JSON.stringify(form)) as RequestInput })) {
      submitted.value = ops.requests[0]?.id ?? ''
      sessionStorage.removeItem(draftKey)
    }
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Unable to save the brief. Please retry.' }
}
</script>

<template>
  <div class="mb-6">
    <div class="text-overline text-primary">
      START WITH YOUR BRIEF
    </div><h1 class="text-h3 mb-3">
      Request a service
    </h1><p class="text-body-1 text-medium-emphasis">
      Tell us what you need. XPro will review your brief, coordinate a provider and share a quote through your dashboard.
    </p>
  </div>
  <VAlert
    v-if="submitted"
    color="success"
    variant="tonal"
  >
    <h2 class="text-h5 mb-2">
      Your request is on its way.
    </h2><p>{{ submitted }} has been sent to XPro for review.</p><VBtn :to="{ path: '/requests', query: { request: submitted } }">
      View my request
    </VBtn>
  </VAlert>
  <VAlert
    v-else-if="auth.isAuthenticated && auth.user?.role !== 'customer'"
    color="info"
    variant="tonal"
  >
    Service requests are submitted from a customer account. <RouterLink :to="auth.homePath">
      Return to your workspace
    </RouterLink>.
  </VAlert>
  <VForm
    v-else
    ref="formRef"
    @submit.prevent="submit"
  >
    <VAlert
      v-if="error || ops.error"
      color="error"
      variant="tonal"
      class="mb-5"
    >
      {{ error || ops.error }}
    </VAlert>
    <VAlert
      v-if="preferred"
      color="info"
      variant="tonal"
      class="mb-5"
    >
      Preferred provider: {{ preferred.name }}. XPro will confirm suitability and availability.
    </VAlert>
    <VCard class="mb-6">
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-5">
          What would you like help with?
        </h2><VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VSelect
              v-model="form.service"
              :items="serviceLines.map(item => item.name)"
              label="Service"
              :rules="[required]"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.title"
              label="Request title"
              placeholder="For example, office renovation in Lekki"
              :rules="[required, value => String(value).length >= 3 || 'Use at least 3 characters.']"
            />
          </VCol>
          <VCol
            v-for="field in intakeFields[form.service]"
            :key="`${form.service}-${field.key}`"
            cols="12"
            sm="6"
          >
            <VSelect
              v-if="field.options"
              v-model="form.details[field.key]"
              :items="field.options"
              :label="field.label"
              :rules="field.required ? [required] : []"
            /><VTextField
              v-else
              v-model="form.details[field.key]"
              :type="field.type ?? 'text'"
              :label="field.label"
              :rules="field.required ? [required] : []"
            />
          </VCol>
          <VCol cols="12">
            <VTextarea
              v-model="form.description"
              label="Project brief"
              placeholder="Scope, expectations and anything XPro should know."
              :rules="[required, value => String(value).trim().length >= 20 || 'Add at least 20 characters.']"
              counter
            />
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
    <VCard class="mb-6">
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-5">
          Location, timing and contact
        </h2><VRow>
          <VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.city"
              label="City / service area"
              :rules="[required]"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.phone"
              label="Contact phone"
              type="tel"
              :rules="[required]"
            />
          </VCol><VCol cols="12">
            <VTextField
              v-model="form.address"
              label="Site / delivery address"
              :rules="[required]"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model="form.startDate"
              label="Preferred start date"
              type="date"
            />
          </VCol><VCol
            cols="12"
            sm="6"
          >
            <VTextField
              v-model.number="form.budget"
              label="Indicative budget (₦)"
              type="number"
              min="0"
              hint="Leave at 0 if you need a quote first."
              persistent-hint
            />
          </VCol><VCol cols="12">
            <VFileInput
              v-model="files"
              label="Drawings, brief or reference files"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.mp4"
              hint="Up to 6 files, 20 MB each. Small images preview locally; other files retain their details."
              persistent-hint
            /><Attachments :files="form.attachments" /><VBtn
              v-if="form.attachments.length"
              variant="text"
              size="small"
              @click="form.attachments = []"
            >
              Remove saved attachments
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>
    <div class="d-flex justify-space-between align-center flex-wrap gap-4">
      <p class="text-body-2 text-medium-emphasis mb-0">
        {{ auth.isAuthenticated ? 'Your submitted request will appear in My requests.' : 'Sign in to associate this request with your account. Your brief will be kept.' }}
      </p><VBtn
        type="submit"
        size="large"
        :loading="ops.busy"
      >
        {{ auth.isAuthenticated ? 'Submit request' : 'Continue to sign in' }}
      </VBtn>
    </div>
  </VForm>
</template>
