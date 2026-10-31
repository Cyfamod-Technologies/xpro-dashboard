<script setup lang="ts">
import { briefRules, dateRange, required, titleRules, validNigerianPhone } from "@/features/discovery/request-rules"
import { checkFiles, fileAccept, fileHint, formatFileSize } from "@/features/operations/file-rules"
import DraftBanner from "@/features/drafts/DraftBanner.vue"
import { useFormDraft } from "@/features/drafts/use-form-draft"
import { contactMethodLabels, nairaToKobo, prefillFromRequest } from "@/features/v1/helpers"
import type { V1ContactMethod, V1FormOptions, V1Request } from "@/features/v1/types"
import { uploadV1Files } from "@/features/v1/uploads"
import { v1Api } from "@/services/v1-api"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

// The V1 request form: one service per request, no provider choice. `?from=<id>` prefills it from a denied request
// ("Create a new request"); the copy is a new draft with a new id and never changes the denied record.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const options = ref<V1FormOptions>({ services: [], locations: [] })
const optionsError = ref("")
const form = reactive({
  service: "",
  title: "",
  description: "",
  location: "",
  address: "",
  phone: auth.user?.phone ?? "",
  contactMethod: "phone" as V1ContactMethod,
  budget: "",
  preferredDate: "",
})
const files = ref<File[]>([])
const fileProblems = ref<string[]>([])
const submitting = ref(false)
const submitError = ref("")
const created = ref<V1Request | null>(null)
const copiedFrom = ref("")
const picker = ref<HTMLInputElement | null>(null)
const draft = useFormDraft({
  formId: "request",
  version: 1,
  owner: () => auth.user?.id ?? "guest",
  snapshot: () => ({ ...form }),
  restore: data => {
    Object.assign(form, data)
  },
  files: { attachments: files },
  adoptGuest: true,
  enabled: () => !created.value,
})

const isCustomer = computed(() => auth.isAuthenticated && auth.user?.role === "customer")
const contactItems = Object.entries(contactMethodLabels).map(([value, title]) => ({ value, title }))
const budgetRule = (value: unknown) =>
  !String(value ?? "").trim() || nairaToKobo(String(value)) !== null || "Enter an amount in naira, or leave it empty."

onMounted(async () => {
  try {
    options.value = await v1Api.formOptions()
  } catch (cause) {
    optionsError.value = getErrorMessage(cause, "The form could not be loaded.")
  }

  // `?service=<name>` comes from the public Services page.
  const service = typeof route.query.service === "string" ? route.query.service : ""
  const match = options.value.services.find(item => item.name.toLowerCase() === service.toLowerCase())

  if (match) form.service = match.id

  const from = isCustomer.value && typeof route.query.from === "string" ? route.query.from : ""

  if (!from) {
    await draft.start()

    return
  }

  try {
    const source = await v1Api.getRequest(from)

    if (source.status !== "denied" && source.status !== "cancelled") return

    const copy = prefillFromRequest(source)

    if (!options.value.locations.some(item => item.id === copy.location)) copy.location = ""

    Object.assign(form, { ...copy, budget: copy.budgetKobo ? String(copy.budgetKobo / 100) : "" })
    copiedFrom.value = source.id
  } catch {
    // A missing source just leaves the form empty.
  } finally {
    await draft.start()
  }
})

const pick = (event: Event) => {
  const input = event.target as HTMLInputElement
  const result = checkFiles("request_attachment", Array.from(input.files ?? []), files.value)

  fileProblems.value = result.problems
  files.value = [...files.value, ...result.accepted]
  input.value = ""
}

const submit = async (event: Promise<{ valid: boolean }>) => {
  if (!auth.isAuthenticated) {
    draft.flush()
    await router.push({ path: "/auth/signup", query: { role: "customer", redirect: "/request" } })

    return
  }
  const { valid } = await event

  if (!valid || submitting.value) return

  submitting.value = true
  submitError.value = ""
  try {
    const attachments = await uploadV1Files(files.value, "request_attachment")

    created.value = await v1Api.createRequest({
      service: form.service,
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location,
      address: form.address.trim(),
      phone: form.phone.trim(),
      contactMethod: form.contactMethod,
      budgetKobo: nairaToKobo(form.budget) ?? 0,
      preferredDate: form.preferredDate,
      attachments,
    })
    await draft.clear()
  } catch (cause) {
    submitError.value = getErrorMessage(cause, "Your request could not be submitted. Try again.")
  } finally {
    submitting.value = false
  }
}

const goBack = () => (window.history.state?.back ? router.back() : router.push("/"))
</script>

<template>
  <div class="xp-container pt-7 pb-12">
    <div class="mb-5">
      <VBtn variant="text" size="small" prepend-icon="tabler-arrow-left" class="mb-1" @click="goBack">Back</VBtn>
      <h1 class="text-h4 mb-1">Request a service</h1>
      <p class="text-body-1 text-medium-emphasis mb-0">
        Tell us about the job. Xpro reviews your request, talks through the price and date with you, and then approves
        or declines it.
      </p>
    </div>

    <VCard v-if="created" color="success" variant="tonal">
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-2">Your request is on its way.</h2>
        <p>{{ created.id }} has been sent to Xpro. We'll email you when it is decided.</p>
        <VBtn :to="{ path: '/requests', query: { request: created.id } }">View my request</VBtn>
      </VCardText>
    </VCard>

    <VAlert v-else-if="auth.isAuthenticated && !isCustomer" type="info" variant="tonal">
      <h2 class="text-h6 mb-1">Requests are made from a customer account</h2>
      <p class="mb-4">Use a customer account to submit a request.</p>
      <VBtn variant="outlined" :to="auth.homePath">Back to my dashboard</VBtn>
    </VAlert>

    <VCard v-else>
      <VCardText class="pa-6">
        <DraftBanner :draft="draft" />
        <VAlert v-if="!auth.isAuthenticated" type="info" variant="tonal" density="compact" class="mb-4">
          Start a request draft now. Sign in or create a customer account before sending it to Xpro.
          <div class="d-flex flex-wrap gap-2 mt-3">
            <VBtn size="small" :to="{ path: '/login', query: { redirect: '/request' } }">Sign in</VBtn>
            <VBtn
              size="small"
              variant="outlined"
              :to="{ path: '/auth/signup', query: { role: 'customer', redirect: '/request' } }"
              >Create account</VBtn
            >
          </div>
        </VAlert>
        <VAlert v-if="copiedFrom" type="info" variant="tonal" density="compact" class="mb-4">
          Started from your denied request {{ copiedFrom }}. Change anything you need before you submit.
        </VAlert>
        <VAlert v-if="optionsError" type="error" variant="tonal" density="compact" class="mb-4">
          {{ optionsError }}
        </VAlert>
        <VAlert v-if="submitError" type="error" variant="tonal" density="compact" class="mb-4">
          {{ submitError }}
        </VAlert>

        <VForm @submit.prevent="submit">
          <VRow>
            <VCol cols="12" md="6">
              <VSelect
                v-model="form.service"
                :items="options.services"
                item-title="name"
                item-value="id"
                label="Service"
                :rules="[required]"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VSelect
                v-model="form.location"
                :items="options.locations"
                item-title="name"
                item-value="id"
                label="Location"
                hint="Where the work will happen. Only areas Xpro serves are listed."
                persistent-hint
                :rules="[required]"
              />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.title" label="Title" :rules="titleRules" counter="120" />
            </VCol>
            <VCol cols="12">
              <VTextarea v-model="form.description" label="Describe the job" rows="4" auto-grow :rules="briefRules" />
            </VCol>
            <VCol cols="12">
              <VTextField v-model="form.address" label="Site address" :rules="[required]" />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="form.phone"
                label="Phone number"
                inputmode="tel"
                :rules="[required, validNigerianPhone]"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VSelect v-model="form.contactMethod" :items="contactItems" label="Best way to reach you" />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="form.budget"
                label="Budget (optional)"
                prefix="₦"
                inputmode="decimal"
                :rules="[budgetRule]"
              />
            </VCol>
            <VCol cols="12" md="6">
              <VTextField
                v-model="form.preferredDate"
                label="Preferred start date (optional)"
                type="date"
                :rules="[dateRange]"
              />
            </VCol>
            <VCol cols="12">
              <div class="text-subtitle-2 mb-1">Files (optional)</div>
              <VBtn variant="outlined" prepend-icon="tabler-paperclip" @click="picker?.click()">Add files</VBtn>
              <input
                ref="picker"
                type="file"
                multiple
                hidden
                :accept="fileAccept('request_attachment')"
                @change="pick"
              />
              <div class="text-caption text-medium-emphasis mt-1">{{ fileHint("request_attachment") }}</div>
              <VAlert
                v-for="problem in fileProblems"
                :key="problem"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                {{ problem }}
              </VAlert>
              <div
                v-for="(file, index) in files"
                :key="`${file.name}-${file.size}`"
                class="d-flex align-center gap-2 mt-2"
              >
                <VIcon icon="tabler-file" size="18" />
                <span class="text-body-2">{{ file.name }} · {{ formatFileSize(file.size) }}</span>
                <VBtn
                  icon="tabler-x"
                  size="x-small"
                  variant="text"
                  :aria-label="`Remove ${file.name}`"
                  @click="files.splice(index, 1)"
                />
              </div>
            </VCol>
          </VRow>
          <div class="d-flex justify-end mt-4">
            <VBtn type="submit" color="primary" :loading="submitting">{{
              isCustomer ? "Submit request" : "Continue to sign up"
            }}</VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </div>
</template>
