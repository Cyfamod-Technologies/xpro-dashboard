<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'
import { serviceLines } from '@/features/workspace/config'
import { intakeFields } from '@/features/operations/types'
import type { IntakeField, RequestInput } from '@/features/operations/types'
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
const blank: RequestInput = { title: '', service: 'Design', city: '', address: '', phone: ops.preferences?.phone ?? '', contactMethod: 'phone', description: '', budget: 0, startDate: '', details: {}, attachments: [] }
let initial = blank
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as RequestInput | null
  if (saved && saved.service in intakeFields)
    initial = saved
}
catch { /* Start a new brief if a saved draft cannot be read. */ }
const form = reactive<RequestInput>(initial)

form.contactMethod ??= 'phone'

// Pre-fill from the query string (home search, popular jobs, provider pages). It takes priority over a saved draft.
const queryText = (key: string) => {
  const value = route.query[key]

  return typeof value === 'string' ? value.trim() : ''
}

const queryService = queryText('service')

if (queryService in intakeFields) {
  if (queryService !== form.service)
    form.details = {}
  form.service = queryService as RequestInput['service']
}
if (queryText('title'))
  form.title = queryText('title')
if (queryText('city'))
  form.city = queryText('city')
if (/^\d{4}-\d{2}-\d{2}$/.test(queryText('start')))
  form.startDate = queryText('start')
for (const field of intakeFields[form.service]) {
  const value = queryText(field.key)

  if (value && (!field.options || field.options.includes(value)))
    form.details[field.key] = value
}
if (ops.publicProviders.some(item => item.id === queryText('provider')))
  form.details.preferredProviderId = queryText('provider')

const preferred = computed(() => ops.publicProviders.find(item => item.id === form.details.preferredProviderId))
const serviceNames = serviceLines.map(item => item.name)
const contactMethods = [{ title: 'Phone', value: 'phone' }, { title: 'Email', value: 'email' }, { title: 'Phone and email', value: 'both' }]
const selectedLine = computed(() => serviceLines.find(item => item.name === form.service))
const fields = computed(() => intakeFields[form.service])
const choiceFields = computed(() => fields.value.filter(field => field.options))
const inputFields = computed(() => fields.value.filter(field => !field.options))

watch(() => form.service, service => {
  const provider = ops.publicProviders.find(item => item.id === form.details.preferredProviderId)

  form.details = provider?.services.includes(service) ? { preferredProviderId: provider.id } : {}
})

const required = (value: unknown) => Boolean(String(value ?? '').trim()) || 'This field is required.'
const saveDraft = () => sessionStorage.setItem(draftKey, JSON.stringify(form))
const label = (field: IntakeField) => field.required ? `${field.label} *` : field.label
const filled = (field: IntakeField) => Boolean(String(form.details[field.key] ?? '').trim())

const budgetInput = computed({
  get: () => form.budget ? String(form.budget) : '',
  set: value => { form.budget = Math.max(0, Number(value) || 0) },
})

// Progress through the four steps shown above the form.
const stepDone = computed(() => [
  choiceFields.value.filter(field => field.required).every(filled),
  form.title.trim().length >= 3 && inputFields.value.filter(field => field.required).every(filled) && form.description.trim().length >= 20,
  Boolean(form.city.trim() && form.phone.trim() && form.address.trim()),
  Boolean(submitted.value),
])

const steps = computed(() => {
  const labels = ['Service', 'Job details', 'Location & timing', 'Review & submit']
  const current = submitted.value ? -1 : Math.max(0, stepDone.value.findIndex((done, index) => index < 3 && !done)) || (stepDone.value.slice(0, 3).every(Boolean) ? 3 : 0)

  return labels.map((name, index) => ({ name, state: stepDone.value[index] || index < current ? 'done' : index === current ? 'current' : 'todo', number: index + 1 }))
})

const formatDate = (value: string) => value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : ''

const summary = computed(() => [
  { key: 'Service', value: form.service },
  ...(form.title.trim() ? [{ key: 'Title', value: form.title.trim() }] : []),
  ...fields.value.filter(filled).map(field => ({ key: field.label.replace(/ \(.*\)$/, ''), value: form.details[field.key] })),
  { key: 'Location', value: form.city.trim() || 'Not set' },
  { key: 'Contact', value: contactMethods.find(item => item.value === form.contactMethod)?.title ?? 'Phone' },
  { key: 'Start', value: formatDate(form.startDate) || 'Flexible' },
  { key: 'Budget', value: form.budget ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(form.budget) : 'Quote first' },
  ...(form.attachments.length || files.value.length ? [{ key: 'Files', value: String(form.attachments.length + files.value.length) }] : []),
])

const removePreferred = () => {
  delete form.details.preferredProviderId
}

const goBack = () => {
  if (window.history.state?.back)
    router.back()
  else
    router.push('/')
}

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
  <div class="xp-container pt-7 pb-12">
    <div class="mb-5">
      <VBtn
        variant="text"
        size="small"
        prepend-icon="tabler-arrow-left"
        class="mb-1"
        @click="goBack"
      >
        Back
      </VBtn>
      <h1 class="text-h4 mb-1">
        Request a service
      </h1>
      <p class="text-body-1 text-medium-emphasis mb-0">
        Tell us about the job. XPro reviews your brief, matches a verified provider and sends your quote.
      </p>
    </div>

    <VCard
      v-if="submitted"
      color="success"
      variant="tonal"
    >
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-2">
          Your request is on its way.
        </h2>
        <p>{{ submitted }} has been sent to XPro for review.</p>
        <VBtn :to="{ path: '/requests', query: { request: submitted } }">
          View my request
        </VBtn>
      </VCardText>
    </VCard>
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
      id="request-form"
      ref="formRef"
      aria-label="Request details"
      @submit.prevent="submit"
    >
      <VCard class="mb-6">
        <ol
          aria-label="Steps"
          class="steps pa-4 pa-sm-5"
        >
          <li
            v-for="step in steps"
            :key="step.name"
            class="step"
            :class="`step--${step.state}`"
            :aria-current="step.state === 'current' ? 'step' : undefined"
          >
            <span class="step__badge">
              <VIcon
                v-if="step.state === 'done'"
                icon="tabler-check"
                size="16"
                aria-label="Completed"
              />
              <template v-else>{{ step.number }}</template>
            </span>
            {{ step.name }}
          </li>
        </ol>
      </VCard>

      <div class="request-layout">
        <div class="d-flex flex-column gap-6 min-w-0">
          <VAlert
            v-if="error || ops.error"
            color="error"
            variant="tonal"
          >
            {{ error || ops.error }}
          </VAlert>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">
                Service
              </h2>
              <VSelect
                v-model="form.service"
                :items="serviceNames"
                label="Service"
                :rules="[required]"
              />
              <div
                v-if="selectedLine"
                class="service-note"
              >
                <VAvatar
                  color="primary"
                  variant="tonal"
                  size="44"
                >
                  <VIcon :icon="selectedLine.icon" />
                </VAvatar>
                <div>
                  <strong class="d-block">{{ selectedLine.name }}</strong>
                  <span class="text-body-2 text-medium-emphasis">{{ selectedLine.description }}</span>
                </div>
              </div>
              <VRadioGroup
                v-for="field in choiceFields"
                :key="`${form.service}-${field.key}`"
                v-model="form.details[field.key]"
                :label="label(field)"
                :rules="field.required ? [required] : []"
                inline
                class="pills"
              >
                <VRadio
                  v-for="option in field.options"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </VRadioGroup>
            </VCardText>
          </VCard>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">
                Job details
              </h2>
              <VTextField
                v-model="form.title"
                label="Request title *"
                placeholder="For example, office renovation in Lekki"
                :rules="[required, value => String(value).length >= 3 || 'Use at least 3 characters.']"
              />
              <div
                v-if="inputFields.length"
                class="field-grid"
              >
                <VTextField
                  v-for="field in inputFields"
                  :key="`${form.service}-${field.key}`"
                  v-model="form.details[field.key]"
                  :type="field.type ?? 'text'"
                  :label="label(field)"
                  :rules="field.required ? [required] : []"
                />
              </div>
              <VTextarea
                v-model="form.description"
                label="Project brief *"
                placeholder="Scope, expectations and anything XPro should know."
                hint="At least 20 characters. Mention materials, finishes and anything already done."
                persistent-hint
                :rules="[required, value => String(value).trim().length >= 20 || 'Add at least 20 characters.']"
                counter
                rows="4"
              />
              <div class="dropzone">
                <div class="d-flex align-center gap-3 mb-3">
                  <VIcon
                    icon="tabler-upload"
                    color="primary-darken-1"
                    size="26"
                  />
                  <div>
                    <strong class="d-block text-body-2">Add drawings, photos or a brief</strong>
                    <span class="text-body-2 text-medium-emphasis">Up to 6 files, 20 MB each</span>
                  </div>
                </div>
                <VFileInput
                  v-model="files"
                  label="Drawings, brief or reference files"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.mp4"
                  hint="Small images preview locally; other files retain their details."
                  persistent-hint
                  prepend-icon=""
                  prepend-inner-icon="tabler-paperclip"
                />
                <Attachments :files="form.attachments" />
                <VBtn
                  v-if="form.attachments.length"
                  variant="text"
                  size="small"
                  @click="form.attachments = []"
                >
                  Remove saved attachments
                </VBtn>
              </div>
            </VCardText>
          </VCard>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">
                Location, timing and contact
              </h2>
              <div class="field-grid">
                <VTextField
                  v-model="form.city"
                  label="City / service area *"
                  :rules="[required]"
                />
                <VTextField
                  v-model="form.phone"
                  label="Contact phone *"
                  type="tel"
                  :rules="[required]"
                />
                <VSelect
                  v-model="form.contactMethod"
                  :items="contactMethods"
                  label="Preferred contact method"
                />
                <VTextField
                  v-model="form.startDate"
                  label="Preferred start date"
                  type="date"
                />
                <VTextField
                  v-model="form.address"
                  label="Site address *"
                  hint="Only shared with your provider once the schedule is confirmed."
                  persistent-hint
                  :rules="[required]"
                  class="field-grid__wide"
                />
                <VTextField
                  v-model="budgetInput"
                  label="Indicative budget (₦)"
                  placeholder="Leave blank if you need a quote first"
                  type="number"
                  min="0"
                  persistent-placeholder
                />
              </div>
            </VCardText>
          </VCard>
        </div>

        <aside
          aria-label="Your request"
          class="d-flex flex-column gap-4 request-aside"
        >
          <VCard>
            <VCardText class="pa-0">
              <h2 class="text-h6 px-5 py-4 summary-title">
                Your request
              </h2>
              <dl class="summary px-5 py-4">
                <template
                  v-for="row in summary"
                  :key="row.key"
                >
                  <dt>{{ row.key }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
              </dl>
              <div class="preferred mx-5 mb-4">
                <template v-if="preferred">
                  <div>
                    <span class="text-body-2 text-medium-emphasis d-block">Preferred provider</span>
                    <strong>{{ preferred.name }}</strong>
                  </div>
                  <VBtn
                    variant="text"
                    size="small"
                    @click="removePreferred"
                  >
                    Remove
                  </VBtn>
                </template>
                <template v-else>
                  <div>
                    <span class="text-body-2 text-medium-emphasis d-block">Preferred provider</span>
                    <strong>None, XPro will match one</strong>
                  </div>
                  <VBtn
                    to="/providers"
                    variant="text"
                    size="small"
                  >
                    Browse
                  </VBtn>
                </template>
              </div>
              <div class="px-5 pb-5 d-flex flex-column gap-3">
                <VBtn
                  type="submit"
                  size="large"
                  block
                  :loading="ops.busy"
                >
                  {{ auth.isAuthenticated ? 'Submit request' : 'Continue to sign in' }}
                </VBtn>
                <span class="text-body-2 text-medium-emphasis text-center">
                  {{ auth.isAuthenticated ? 'Your submitted request will appear in My requests.' : 'Your brief is kept while you sign in or create an account.' }}
                </span>
              </div>
            </VCardText>
          </VCard>
          <VCard
            color="primary"
            variant="tonal"
          >
            <VCardText class="on-tonal pa-5">
              <strong class="d-block mb-3">What happens next</strong>
              <ol class="next-list text-body-2">
                <li>XPro reviews your brief and may ask a quick question.</li>
                <li>A verified provider is matched and XPro sends your quote.</li>
                <li>Accept the quote, confirm a date and track the work in your dashboard.</li>
              </ol>
              <span class="text-body-2 d-block mt-3">No consultation fee.</span>
            </VCardText>
          </VCard>
        </aside>
      </div>
    </VForm>
  </div>
</template>

<style lang="scss" scoped>
.request-layout {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) 360px;
}

.request-aside {
  inset-block-start: 24px;
  position: sticky;
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  list-style: none;
  margin: 0;
}

.step {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  display: flex;
  font-weight: 500;
  gap: 10px;

  &__badge {
    align-items: center;
    background: rgba(var(--v-theme-on-surface), 0.08);
    block-size: 28px;
    border-radius: 50%;
    box-sizing: border-box;
    display: flex;
    font-size: 0.8125rem;
    font-weight: 600;
    inline-size: 28px;
    justify-content: center;
  }

  &--current {
    color: rgb(var(--v-theme-on-surface));

    .step__badge {
      background: rgba(var(--v-theme-primary), 0.14);
      border: 2px solid rgb(var(--v-theme-primary));
      color: rgb(var(--v-theme-primary-darken-1));
    }
  }

  &--done {
    color: rgb(var(--v-theme-on-surface));

    .step__badge { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
  }
}

.service-note {
  align-items: center;
  background: rgba(var(--v-theme-primary), 0.06);
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 6px;
  display: flex;
  gap: 14px;
  padding: 14px;
}

.pills {
  :deep(.v-selection-control-group) { gap: 8px; }

  :deep(.v-radio) {
    border: 1px solid rgba(var(--v-border-color), 0.3);
    border-radius: 6px;
    padding-inline: 4px 14px;
  }

  :deep(.v-radio:has(.v-selection-control--dirty)) {
    background: rgba(var(--v-theme-primary), 0.06);
    border-color: rgb(var(--v-theme-primary));
  }

  :deep(.v-radio:focus-within) { outline: 2px solid rgb(var(--v-theme-primary)); }
}

.field-grid {
  display: grid;
  gap: 20px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  &__wide { grid-column: 1 / -1; }
}

.dropzone {
  background: rgba(var(--v-theme-primary), 0.03);
  border: 1px dashed rgba(var(--v-theme-secondary), 0.6);
  border-radius: 6px;
  padding: 20px;
}

.summary-title { border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }

.summary {
  display: grid;
  font-size: 0.875rem;
  gap: 10px 16px;
  grid-template-columns: auto 1fr;
  margin: 0;

  dt { color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); }
  dd { font-weight: 500; margin: 0; overflow-wrap: anywhere; text-align: end; }
}

.preferred {
  align-items: center;
  background: rgb(var(--v-theme-background));
  border-radius: 6px;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  padding: 10px 14px;
}

.on-tonal { color: rgb(var(--v-theme-on-surface)) !important; }

.next-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-inline-start: 18px;
}

@media (max-width: 600px) {
  .field-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 960px) {
  .request-layout { grid-template-columns: minmax(0, 1fr); }
  .request-aside { position: static; }
}
</style>
