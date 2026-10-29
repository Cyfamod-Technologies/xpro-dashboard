<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"
import { serviceLines } from "@/features/workspace/config"
import { intakeFields } from "@/features/operations/types"
import type { IntakeField, RequestInput } from "@/features/operations/types"
import { prepareFiles } from "@/features/operations/files"
import FilePicker from "@/features/operations/FilePicker.vue"
import { useAuthStore } from "@/stores/auth"
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import { requestsApi } from "@/services/requests-api"
import { catalogApi } from "@/services/catalog-api"
import type { LocationView } from "@/features/requests/api-types"
import type { PublicOption, PublicQuestion, PublicServiceNode } from "@/features/catalog/types"
import { isLeaf, questionsAlongPath } from "@/features/catalog/types"
import DraftBanner from "@/features/drafts/DraftBanner.vue"
import { useFormDraft } from "@/features/drafts/use-form-draft"

type AnswerValue = string | number | string[] | null | undefined

const auth = useAuthStore()
const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()
const formRef = ref<VForm>()
const error = ref("")
const files = ref<File[]>([])
const submitted = ref("")
const submitKey = ref(globalThis.crypto.randomUUID())
const liveError = ref("")
const liveWarning = ref("")
const tree = ref<PublicServiceNode[]>([])

// Live mode: the ids picked at each level (top-level service first) and the answers keyed by question id.
const selectedIds = ref<string[]>([])
const answers = reactive<Record<string, AnswerValue>>({})
const cities = ref<LocationView[]>([])
const districts = ref<LocationView[]>([])
const cityId = ref("")
const districtId = ref("")
const loadingCatalog = ref(false)
const pendingRequestId = ref("")
const hasPending = ref(false)
const checkingPending = ref(false)
const submitting = ref(false)
const isCustomer = computed(() => auth.isAuthenticated && auth.user?.role === "customer")
const isOtherRole = computed(() => auth.isAuthenticated && auth.user?.role !== "customer")
const accountLabel = computed(() => (auth.user?.role === "admin" ? "an XPro staff account" : "a provider account"))
const blank: RequestInput = {
  title: "",
  service: "Design",
  city: "",
  address: "",
  phone: ops.preferences?.phone ?? "",
  contactMethod: "phone",
  description: "",
  budget: 0,
  startDate: "",
  details: {},
  attachments: [],
}
const form = reactive<RequestInput>(blank)

form.contactMethod ??= "phone"

// Pre-fill from the query string (home search, popular jobs, service pages). It takes priority over a saved draft.
const queryText = (key: string) => {
  const value = route.query[key]

  return typeof value === "string" ? value.trim() : ""
}

const queryService = queryText("service")

if (isDemoMode && queryService in intakeFields) {
  if (queryService !== form.service) form.details = {}
  form.service = queryService as RequestInput["service"]
}
if (queryText("title")) form.title = queryText("title")
if (queryText("city")) form.city = queryText("city")
if (/^\d{4}-\d{2}-\d{2}$/.test(queryText("start"))) form.startDate = queryText("start")
if (isDemoMode) {
  for (const field of intakeFields[form.service]) {
    const value = queryText(field.key)

    if (value && (!field.options || field.options.includes(value))) form.details[field.key] = value
  }
}
const serviceNames = serviceLines.map(item => item.name)
const contactMethods = [
  { title: "Phone", value: "phone" },
  { title: "Email", value: "email" },
  { title: "Phone and email", value: "both" },
]
const selectedLine = computed(() => serviceLines.find(item => item.name === form.service))
const fields = computed<IntakeField[]>(() => (isDemoMode ? intakeFields[form.service] : []))
const choiceFields = computed(() => fields.value.filter(field => field.options))

// Short option lists render as pills; longer ones (trades, material categories) as a select.
const asSelect = (field: IntakeField) => (field.options?.length ?? 0) > 6
const inputFields = computed(() => fields.value.filter(field => !field.options))

watch(
  () => form.service,
  () => {
    form.details = {}
  },
)

const formatDate = (value: string) =>
  value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)) : ""

// Live catalog: the picked path, one level at a time, and the questions it inherits.
const pathNodes = computed(() => {
  const nodes: PublicServiceNode[] = []
  let level = tree.value

  for (const id of selectedIds.value) {
    const node = level.find(item => item.id === id)

    if (!node) break
    nodes.push(node)
    level = node.children
  }

  return nodes
})
const rootNode = computed(() => pathNodes.value[0])
const leafNode = computed(() => {
  const last = pathNodes.value[pathNodes.value.length - 1]

  return last && isLeaf(last) ? last : undefined
})

// Every selected node that has children opens one more level below the top-level select.
const childLevels = computed(() =>
  pathNodes.value
    .map((parent, index) => ({ parent, depth: index + 1, items: parent.children }))
    .filter(level => level.items.length),
)
const pathQuestions = computed(() =>
  questionsAlongPath<PublicQuestion, PublicServiceNode>(pathNodes.value).map(item => item.question),
)
const isChoiceQuestion = (question: PublicQuestion) =>
  question.type === "yes_no" || question.type === "single_choice" || question.type === "multiple_choice"
const choiceQuestions = computed(() => pathQuestions.value.filter(isChoiceQuestion))
const inputQuestions = computed(() => pathQuestions.value.filter(question => !isChoiceQuestion(question)))
const requiresStartDate = computed(() =>
  isDemoMode ? form.service === "Hire" : pathNodes.value.some(node => node.requiresStartDate),
)
const serviceNote = computed(() => {
  const root = rootNode.value

  if (!root) return null

  const line = serviceLines.find(item => item.name === root.name)

  return {
    name: root.name,
    icon: root.icon || line?.icon || "tabler-category",
    description: root.description || line?.description || "",
  }
})

const hasAnswer = (question: PublicQuestion) => {
  const value = answers[question.id]

  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== ""
}
const questionLabel = (question: PublicQuestion) => (question.required ? `${question.label} *` : question.label)
const optionsFor = (question: PublicQuestion): PublicOption[] =>
  question.type === "yes_no"
    ? [
        { id: "Yes", label: "Yes" },
        { id: "No", label: "No" },
      ]
    : question.options

// Short option lists render as pills; longer ones as a select.
const questionAsSelect = (question: PublicQuestion) => optionsFor(question).length > 6

function pruneAnswers() {
  const valid = new Set(pathQuestions.value.map(question => question.id))

  for (const id of Object.keys(answers)) if (!valid.has(id)) delete answers[id]
}

// Changing a level clears every level below it, and the answers to questions that are no longer on the path.
function selectNode(level: number, id: string | null) {
  selectedIds.value = id ? [...selectedIds.value.slice(0, level), id] : selectedIds.value.slice(0, level)
  pruneAnswers()
}

const answerDisplay = (question: PublicQuestion) => {
  const value = answers[question.id]

  if (!hasAnswer(question)) return ""
  if (question.type === "single_choice")
    return question.options.find(option => option.id === value)?.label ?? String(value)
  if (question.type === "multiple_choice")
    return (Array.isArray(value) ? value : [])
      .map(id => question.options.find(option => option.id === id)?.label ?? id)
      .join(", ")
  if (question.type === "date") return formatDate(String(value))

  return String(value)
}

const buildAnswers = () => {
  const result: Record<string, string | number | string[]> = {}

  for (const question of pathQuestions.value) {
    const value = answers[question.id]

    if (!hasAnswer(question) || value === null || value === undefined) continue
    if (question.type === "number") result[question.id] = Number(value)
    else if (Array.isArray(value)) result[question.id] = value
    else result[question.id] = question.type === "short_text" || question.type === "long_text" ? String(value).trim() : String(value)
  }

  return result
}

// The first valid value for a query-string prefill, or undefined when the value does not fit the question.
const prefillValue = (question: PublicQuestion, raw: string): AnswerValue => {
  const match = (value: string) =>
    question.options.find(option => option.id === value || option.label.toLowerCase() === value.toLowerCase())?.id

  switch (question.type) {
    case "yes_no":
      return /^(?:yes|no)$/i.test(raw) ? (raw.toLowerCase() === "yes" ? "Yes" : "No") : undefined
    case "single_choice":
      return match(raw)
    case "multiple_choice": {
      const ids = raw.split(",").map(item => match(item.trim()))

      return ids.length && ids.every(Boolean) ? (ids as string[]) : undefined
    }
    case "number":
      return raw !== "" && Number.isFinite(Number(raw)) ? raw : undefined
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
    default:
      return raw.length <= (question.config.maxLength ?? 2000) ? raw : undefined
  }
}

// `?service=<top-level name>` picks the service. Other query values pick a sub-service by name, or fill a question
// by its key, so the links from older popular-job cards keep working.
function applyQueryPrefill() {
  const root = tree.value.find(item => item.name.toLowerCase() === queryService.toLowerCase())

  if (!root) return

  const reserved = ["service", "title", "city", "start"]
  const extras = Object.entries(route.query)
    .filter(([key]) => !reserved.includes(key))
    .flatMap(([key, value]) => (typeof value === "string" && value.trim() ? [[key, value.trim()] as const] : []))
  const path = [root]

  for (let node = root; node.children.length; ) {
    const child = node.children.find(item =>
      extras.some(([, value]) => item.name.toLowerCase() === value.toLowerCase()),
    )

    if (!child) break
    path.push(child)
    node = child
  }
  selectedIds.value = path.map(node => node.id)
  for (const question of pathQuestions.value) {
    const raw = extras.find(([key]) => key === question.key)?.[1]
    const value = raw === undefined ? undefined : prefillValue(question, raw)

    if (value !== undefined) answers[question.id] = value
  }
}

// One open request per customer: send them to it instead of starting a second brief.
// The server stays authoritative, so a failed check falls back to the form.
watch(
  isCustomer,
  async customer => {
    hasPending.value = false
    pendingRequestId.value = ""
    if (!customer || isDemoMode) return
    checkingPending.value = true
    try {
      const result = await requestsApi.pending()

      hasPending.value = result.hasPending
      pendingRequestId.value = result.requestId ?? ""
    } catch {
      hasPending.value = false
    } finally {
      checkingPending.value = false
    }
  },
  { immediate: true },
)

const startCustomerSignup = async () => {
  auth.logout()
  await router.push({ path: "/auth/signup", query: { role: "customer" } })
}

const required = (value: unknown) => Boolean(String(value ?? "").trim()) || "This field is required."
const dateRange = (value: unknown) => {
  if (!value) return true
  const selected = Date.parse(`${String(value).slice(0, 10)}T00:00:00+01:00`)
  const watDay = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const earliest = Date.parse(`${watDay}T00:00:00+01:00`)
  const latest = earliest + 365 * 24 * 60 * 60 * 1000

  return (selected >= earliest && selected <= latest) || "Choose a date from today through the next 12 months."
}
const validNigerianPhone = (value: unknown) => {
  const normalized = String(value ?? "").replace(/[\s()-]/g, "")

  return /^(?:\+234|234|0)?[789][01]\d{8}$/.test(normalized) || "Enter a valid Nigerian phone number."
}
const fieldRules = (field: IntakeField) => [
  ...(field.required ? [required] : []),
  ...(field.type === "number"
    ? [
        (value: unknown) =>
          !value || (Number(value) > 0 && Number.isFinite(Number(value))) || `${field.label} must be positive.`,
      ]
    : []),
  ...(field.type === "date" ? [dateRange] : []),
  ...(field.key.toLowerCase().includes("quantity")
    ? [
        (value: unknown) =>
          !value ||
          (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 10) ||
          "Quantity must be a whole number from 1 to 10.",
      ]
    : []),
]
const questionRules = (question: PublicQuestion) => {
  const rules: Array<(value: unknown) => boolean | string> = []
  const config = question.config

  if (question.required)
    rules.push(
      question.type === "multiple_choice"
        ? value => (Array.isArray(value) && value.length > 0) || "Choose at least one option."
        : required,
    )
  if (question.type === "number")
    rules.push(value => {
      if (value === null || value === undefined || value === "") return true

      const number = Number(value)

      if (!Number.isFinite(number)) return `${question.label} must be a number.`
      if (config.integer && !Number.isInteger(number)) return `${question.label} must be a whole number.`
      if (config.min !== undefined && (config.exclusiveMinimum ? number <= config.min : number < config.min))
        return config.exclusiveMinimum
          ? `${question.label} must be more than ${config.min}.`
          : `${question.label} must be at least ${config.min}.`
      if (config.max !== undefined && number > config.max) return `${question.label} must be at most ${config.max}.`

      return true
    })
  if (question.type === "short_text" || question.type === "long_text")
    rules.push(value => {
      const length = String(value ?? "").trim().length

      if (!length) return true
      if (config.minLength !== undefined && length < config.minLength)
        return `Use at least ${config.minLength} characters.`
      if (config.maxLength !== undefined && length > config.maxLength)
        return `Use at most ${config.maxLength} characters.`

      return true
    })
  if (question.type === "date") {
    rules.push(dateRange)
    if (question.dateRole === "end")
      rules.push(value => {
        const starts = [
          form.startDate,
          ...pathQuestions.value
            .filter(item => item.dateRole === "start")
            .map(item => String(answers[item.id] ?? "")),
        ].filter(Boolean)

        return !value || starts.every(start => String(value) >= start) || "The end date cannot be before the start date."
      })
  }

  return rules
}
const label = (field: IntakeField) => (field.required ? `${field.label} *` : field.label)
const filled = (field: IntakeField) => Boolean(String(form.details[field.key] ?? "").trim())

const budgetInput = computed({
  get: () => (form.budget ? String(form.budget) : ""),
  set: value => {
    form.budget = Math.max(0, Number(value) || 0)
  },
})

// Progress through the four steps shown above the form.
const stepDone = computed(() => [
  isDemoMode
    ? choiceFields.value.filter(field => field.required).every(filled)
    : Boolean(leafNode.value) && choiceQuestions.value.filter(question => question.required).every(hasAnswer),
  form.title.trim().length >= 3 &&
    (isDemoMode
      ? inputFields.value.filter(field => field.required).every(filled)
      : inputQuestions.value.filter(question => question.required).every(hasAnswer)) &&
    form.description.trim().length >= 20,
  Boolean(form.city.trim() && form.phone.trim() && form.address.trim()),
  Boolean(submitted.value),
])

const steps = computed(() => {
  const labels = ["Service", "Job details", "Location & timing", "Review & submit"]
  const current = submitted.value
    ? -1
    : Math.max(
        0,
        stepDone.value.findIndex((done, index) => index < 3 && !done),
      ) || (stepDone.value.slice(0, 3).every(Boolean) ? 3 : 0)

  return labels.map((name, index) => ({
    name,
    state: stepDone.value[index] || index < current ? "done" : index === current ? "current" : "todo",
    number: index + 1,
  }))
})

const summary = computed(() => [
  { key: "Service", value: isDemoMode ? form.service : pathNodes.value.map(node => node.name).join(" › ") || "Not chosen" },
  ...(form.title.trim() ? [{ key: "Title", value: form.title.trim() }] : []),
  ...(isDemoMode
    ? fields.value
        .filter(filled)
        .map(field => ({ key: field.label.replace(/ \(.*\)$/, ""), value: form.details[field.key] }))
    : pathQuestions.value
        .filter(hasAnswer)
        .map(question => ({ key: question.label.replace(/ \(.*\)$/, ""), value: answerDisplay(question) }))),
  { key: "Location", value: form.city.trim() || "Not set" },
  { key: "Contact", value: contactMethods.find(item => item.value === form.contactMethod)?.title ?? "Phone" },
  { key: "Start", value: formatDate(form.startDate) || "Flexible" },
  {
    key: "Budget",
    value: form.budget
      ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
          form.budget,
        )
      : "Quote first",
  },
  ...(form.attachments.length || files.value.length
    ? [{ key: "Files", value: String(form.attachments.length + files.value.length) }]
    : []),
])

const goBack = () => {
  if (window.history.state?.back) router.back()
  else router.push("/")
}

async function loadLocations(parentId?: string) {
  const result = await requestsApi.locations(parentId)
  if (parentId) districts.value = result
  else cities.value = result.filter(item => item.kind === "city")
}

watch(cityId, async value => {
  districtId.value = ""
  districts.value = []
  if (value) await loadLocations(value)
  form.city = cities.value.find(item => item.id === value)?.name ?? ""
})

// Autosaved draft: text in localStorage, queued files in IndexedDB. A guest's draft follows them through sign-in.
interface RequestDraft {
  title: string
  address: string
  phone: string
  contactMethod: RequestInput["contactMethod"]
  description: string
  budget: number
  startDate: string
  city: string
  service: string
  details: RequestInput["details"]
  selectedIds: string[]
  answers: Record<string, AnswerValue>
  cityId: string
  districtId: string
  submitKey: string
}

const draft = useFormDraft<RequestDraft>({
  formId: "request",
  version: 1,
  owner: () => auth.user?.id ?? "guest",
  adoptGuest: true,
  snapshot: () => ({
    title: form.title,
    address: form.address,
    phone: form.phone,
    contactMethod: form.contactMethod,
    description: form.description,
    budget: form.budget,
    startDate: form.startDate,
    city: form.city,
    service: form.service,
    details: form.details,
    selectedIds: selectedIds.value,
    answers,
    cityId: cityId.value,
    districtId: districtId.value,
    submitKey: submitKey.value,
  }),
  restore: async data => {
    Object.assign(form, {
      title: data.title,
      address: data.address,
      phone: data.phone,
      contactMethod: data.contactMethod ?? "phone",
      description: data.description,
      budget: data.budget,
      startDate: data.startDate,
    })
    submitKey.value = (data.submitKey || submitKey.value) as typeof submitKey.value
    if (isDemoMode) {
      form.city = data.city
      if (!(queryService in intakeFields) && data.service in intakeFields) {
        form.service = data.service as RequestInput["service"]
        // Changing the service clears the answers; wait for that before putting them back.
        await nextTick()
        form.details = { ...data.details }
      }
    } else {
      let level = tree.value
      const path: string[] = []

      for (const id of data.selectedIds) {
        const node = level.find(item => item.id === id)

        if (!node) break
        path.push(id)
        level = node.children
      }
      selectedIds.value = path
      for (const key of Object.keys(answers)) delete answers[key]
      Object.assign(answers, data.answers)
      pruneAnswers()
      if (cities.value.some(item => item.id === data.cityId)) {
        cityId.value = data.cityId
        // The city watcher resets the district and loads its list; wait for the list before choosing one.
        await nextTick()
        await loadLocations(data.cityId)
        if (districts.value.some(item => item.id === data.districtId)) districtId.value = data.districtId
      }
    }
    // Links that pre-fill the form (popular jobs, service pages) win over a saved draft.
    if (queryText("title")) form.title = queryText("title")
    if (queryText("city") && isDemoMode) form.city = queryText("city")
    if (/^\d{4}-\d{2}-\d{2}$/.test(queryText("start"))) form.startDate = queryText("start")
    if (!isDemoMode) {
      applyQueryPrefill()
      pruneAnswers()
    }
  },
  files: { attachments: files },
})

onMounted(async () => {
  if (isDemoMode) {
    await draft.start()

    return
  }
  loadingCatalog.value = true
  try {
    const [services, locations] = await Promise.all([catalogApi.publicTree(), requestsApi.locations()])
    tree.value = services
    cities.value = locations.filter(item => item.kind === "city")
    applyQueryPrefill()
  } catch (cause) {
    liveError.value = cause instanceof Error ? cause.message : "The service catalogue could not be loaded."
  } finally {
    loadingCatalog.value = false
    await draft.start()
  }
})

async function uploadRequestFiles() {
  const attachments: Array<{ id: string }> = []
  for (const file of files.value) {
    const upload = await requestsApi.createUpload({
      name: file.name,
      size: file.size,
      type: file.type,
      purpose: "request_attachment",
    })
    const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })
    if (!response.ok) throw new Error(`Could not upload ${file.name}.`)
    await requestsApi.completeUpload(upload.id)
    attachments.push({ id: upload.id })
  }

  return attachments
}

const submit = async () => {
  error.value = ""
  liveError.value = ""
  liveWarning.value = ""
  if (!(await formRef.value?.validate())?.valid) return
  submitting.value = true
  try {
    if (!auth.isAuthenticated) {
      await router.push({ path: "/login", query: { redirect: "/request" } })

      return
    }
    if (!isDemoMode) {
      if (!cityId.value || !districtId.value)
        throw new Error("Choose a city and district from the available locations.")
      const leaf = leafNode.value

      if (!leaf) throw new Error("Choose a service to continue.")

      const attachments = await uploadRequestFiles()
      const result = await requestsApi.create(
        {
          title: form.title,
          serviceId: leaf.id,
          cityId: cityId.value,
          districtId: districtId.value,
          address: form.address,
          phone: form.phone,
          contactMethod: form.contactMethod,
          description: form.description,
          budget: form.budget ? Math.round(form.budget * 100) : 0,
          startDate: form.startDate || undefined,
          answers: buildAnswers(),
          attachments,
        },
        submitKey.value,
      )
      submitted.value = result.id
      liveWarning.value = result.warning ?? ""
      files.value = []
      await draft.clear()
    } else {
      form.attachments = [...form.attachments, ...(await prepareFiles(files.value))]
      files.value = []
      if (await ops.run({ type: "request.create", input: JSON.parse(JSON.stringify(form)) as RequestInput })) {
        submitted.value = ops.requests[0]?.id ?? ""
        await draft.clear()
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Unable to save the brief. Please retry."
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="xp-container pt-7 pb-12">
    <div class="mb-5">
      <VBtn variant="text" size="small" prepend-icon="tabler-arrow-left" class="mb-1" @click="goBack"> Back </VBtn>
      <h1 class="text-h4 mb-1">Request a service</h1>
      <p class="text-body-1 text-medium-emphasis mb-0">
        Tell us about the job. XPro reviews your brief, assigns a verified provider and sends your quote.
      </p>
    </div>

    <VCard v-if="submitted" color="success" variant="tonal">
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-2">Your request is on its way.</h2>
        <p>{{ submitted }} has been sent to XPro for review.</p>
        <VAlert v-if="liveWarning" type="warning" variant="tonal" class="mb-4">{{ liveWarning }}</VAlert>
        <VBtn :to="{ path: '/requests', query: { request: submitted } }"> View my request </VBtn>
      </VCardText>
    </VCard>
    <VAlert v-else-if="isOtherRole" color="info" variant="tonal">
      <h2 class="text-h6 mb-1">Requests are made from a customer account</h2>
      <p class="mb-4">
        You're signed in with {{ accountLabel }}. To request a service, sign out and create a customer account with a
        different email address.
      </p>
      <div class="d-flex flex-wrap gap-3">
        <VBtn color="primary" @click="startCustomerSignup"> Create a customer account </VBtn>
        <VBtn color="primary" variant="outlined" :to="auth.homePath"> Back to my dashboard </VBtn>
      </div>
    </VAlert>
    <VCard v-else-if="checkingPending" class="pa-6 d-flex align-center gap-3" aria-busy="true">
      <VProgressCircular indeterminate size="24" color="primary" />
      <span class="text-body-1">Checking your open requests…</span>
    </VCard>
    <VAlert v-else-if="hasPending" color="info" variant="tonal">
      <h2 class="text-h6 mb-1">You already have a request in progress</h2>
      <p class="mb-4">
        <template v-if="pendingRequestId">{{ pendingRequestId }} is</template>
        <template v-else>Your last request is</template>
        still open with XPro. Follow it from your dashboard. You can start a new request once it's closed.
      </p>
      <div class="d-flex flex-wrap gap-3">
        <VBtn v-if="pendingRequestId" color="primary" :to="{ path: '/requests', query: { request: pendingRequestId } }">
          View my request
        </VBtn>
        <VBtn color="primary" :variant="pendingRequestId ? 'outlined' : 'elevated'" :to="auth.homePath">
          Go to my dashboard
        </VBtn>
      </div>
    </VAlert>
    <VForm v-else id="request-form" ref="formRef" aria-label="Request details" @submit.prevent="submit">
      <DraftBanner :draft="draft" />
      <VCard class="mb-6">
        <ol aria-label="Steps" class="steps pa-4 pa-sm-5">
          <li
            v-for="step in steps"
            :key="step.name"
            class="step"
            :class="`step--${step.state}`"
            :aria-current="step.state === 'current' ? 'step' : undefined"
          >
            <span class="step__badge">
              <VIcon v-if="step.state === 'done'" icon="tabler-check" size="16" aria-label="Completed" />
              <template v-else>{{ step.number }}</template>
            </span>
            {{ step.name }}
          </li>
        </ol>
      </VCard>

      <div class="request-layout">
        <div class="d-flex flex-column gap-6 min-w-0">
          <VAlert v-if="error || liveError || ops.error" color="error" variant="tonal">
            {{ error || liveError || ops.error }}
          </VAlert>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">Service</h2>
              <template v-if="isDemoMode">
                <VSelect
                  v-model="form.service"
                  :items="serviceNames"
                  label="Service"
                  :rules="[required]"
                  :loading="loadingCatalog"
                />
                <div v-if="selectedLine" class="service-note">
                  <VAvatar color="primary" variant="tonal" size="44">
                    <VIcon :icon="selectedLine.icon" />
                  </VAvatar>
                  <div>
                    <strong class="d-block">{{ selectedLine.name }}</strong>
                    <span class="text-body-2 text-medium-emphasis">{{ selectedLine.description }}</span>
                  </div>
                </div>
                <template v-for="field in choiceFields" :key="`${form.service}-${field.key}`">
                  <VSelect
                    v-if="asSelect(field)"
                    v-model="form.details[field.key]"
                    :items="field.options"
                    :label="label(field)"
                    :rules="fieldRules(field)"
                    :clearable="!field.required"
                  />
                  <VRadioGroup
                    v-else
                    v-model="form.details[field.key]"
                    :label="label(field)"
                    :rules="fieldRules(field)"
                    inline
                    class="pills"
                  >
                    <VRadio v-for="option in field.options" :key="option" :label="option" :value="option" />
                  </VRadioGroup>
                </template>
              </template>
              <template v-else>
                <VSelect
                  :model-value="selectedIds[0]"
                  :items="tree"
                  item-title="name"
                  item-value="id"
                  label="Service *"
                  :rules="[required]"
                  :loading="loadingCatalog"
                  @update:model-value="selectNode(0, $event)"
                />
                <div v-if="serviceNote" class="service-note">
                  <VAvatar color="primary" variant="tonal" size="44">
                    <VIcon :icon="serviceNote.icon" />
                  </VAvatar>
                  <div>
                    <strong class="d-block">{{ serviceNote.name }}</strong>
                    <span class="text-body-2 text-medium-emphasis">{{ serviceNote.description }}</span>
                  </div>
                </div>
                <template v-for="level in childLevels" :key="level.parent.id">
                  <VSelect
                    v-if="level.items.length > 6"
                    :model-value="selectedIds[level.depth]"
                    :items="level.items"
                    item-title="name"
                    item-value="id"
                    :label="`Choose a ${level.parent.name.toLowerCase()} service *`"
                    :rules="[required]"
                    @update:model-value="selectNode(level.depth, $event)"
                  />
                  <VRadioGroup
                    v-else
                    :model-value="selectedIds[level.depth]"
                    :label="`Choose a ${level.parent.name.toLowerCase()} service *`"
                    :rules="[required]"
                    inline
                    class="pills"
                    @update:model-value="selectNode(level.depth, $event)"
                  >
                    <VRadio v-for="item in level.items" :key="item.id" :label="item.name" :value="item.id" />
                  </VRadioGroup>
                </template>
                <template v-for="question in choiceQuestions" :key="question.id">
                  <VSelect
                    v-if="question.type === 'multiple_choice'"
                    v-model="answers[question.id]"
                    :items="question.options"
                    item-title="label"
                    item-value="id"
                    :label="questionLabel(question)"
                    :hint="question.helpText ?? undefined"
                    :persistent-hint="Boolean(question.helpText)"
                    :rules="questionRules(question)"
                    multiple
                    chips
                    closable-chips
                  />
                  <VSelect
                    v-else-if="questionAsSelect(question)"
                    v-model="answers[question.id]"
                    :items="optionsFor(question)"
                    item-title="label"
                    item-value="id"
                    :label="questionLabel(question)"
                    :hint="question.helpText ?? undefined"
                    :persistent-hint="Boolean(question.helpText)"
                    :rules="questionRules(question)"
                    :clearable="!question.required"
                  />
                  <VRadioGroup
                    v-else
                    v-model="answers[question.id]"
                    :label="questionLabel(question)"
                    :hint="question.helpText ?? undefined"
                    :persistent-hint="Boolean(question.helpText)"
                    :rules="questionRules(question)"
                    inline
                    class="pills"
                  >
                    <VRadio
                      v-for="option in optionsFor(question)"
                      :key="option.id"
                      :label="option.label"
                      :value="option.id"
                    />
                  </VRadioGroup>
                </template>
              </template>
            </VCardText>
          </VCard>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">Job details</h2>
              <VTextField
                v-model="form.title"
                label="Request title *"
                placeholder="For example, office renovation in Lekki"
                :rules="[
                  required,
                  value =>
                    (String(value).trim().length >= 3 && String(value).length <= 120) || 'Use 3 to 120 characters.',
                ]"
              />
              <div v-if="isDemoMode ? inputFields.length : inputQuestions.length" class="field-grid">
                <template v-if="isDemoMode">
                  <VTextField
                    v-for="field in inputFields"
                    :key="`${form.service}-${field.key}`"
                    v-model="form.details[field.key]"
                    :type="field.type ?? 'text'"
                    :label="label(field)"
                    :rules="fieldRules(field)"
                  />
                </template>
                <template v-else>
                  <template v-for="question in inputQuestions" :key="question.id">
                    <VTextarea
                      v-if="question.type === 'long_text'"
                      v-model="answers[question.id]"
                      :label="questionLabel(question)"
                      :hint="question.helpText ?? undefined"
                      :persistent-hint="Boolean(question.helpText)"
                      :rules="questionRules(question)"
                      rows="3"
                      class="field-grid__wide"
                    />
                    <VTextField
                      v-else
                      v-model="answers[question.id]"
                      :type="question.type === 'number' ? 'number' : question.type === 'date' ? 'date' : 'text'"
                      :label="questionLabel(question)"
                      :hint="question.helpText ?? undefined"
                      :persistent-hint="Boolean(question.helpText)"
                      :rules="questionRules(question)"
                    />
                  </template>
                </template>
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
                  <VIcon icon="tabler-upload" color="primary-darken-1" size="26" />
                  <div>
                    <strong class="d-block text-body-2">Add drawings, photos or a brief</strong>
                    <span class="text-body-2 text-medium-emphasis">Up to 6 files, 20 MB each</span>
                  </div>
                </div>
                <FilePicker
                  v-model:saved="form.attachments"
                  v-model:queued="files"
                  purpose="request_attachment"
                  label="Drawings, brief or reference files"
                />
              </div>
            </VCardText>
          </VCard>

          <VCard>
            <VCardText class="pa-6 d-flex flex-column gap-5">
              <h2 class="text-h6">Location, timing and contact</h2>
              <div class="field-grid">
                <template v-if="!isDemoMode">
                  <VSelect
                    v-model="cityId"
                    :items="cities.map(item => ({ title: item.name, value: item.id }))"
                    label="City *"
                    :rules="[required]"
                  />
                  <VSelect
                    v-model="districtId"
                    :items="districts.map(item => ({ title: item.name, value: item.id }))"
                    label="District *"
                    :disabled="!cityId"
                    :rules="[required]"
                  />
                </template>
                <VTextField v-else v-model="form.city" label="City / service area *" :rules="[required]" />
                <VTextField
                  v-model="form.phone"
                  label="Contact phone *"
                  type="tel"
                  :rules="[required, validNigerianPhone]"
                />
                <VSelect v-model="form.contactMethod" :items="contactMethods" label="Preferred contact method" />
                <VTextField
                  v-model="form.startDate"
                  :label="requiresStartDate && !isDemoMode ? 'Preferred start date *' : 'Preferred start date'"
                  type="date"
                  :rules="[...(requiresStartDate ? [required] : []), dateRange]"
                />
                <VAlert v-if="!isDemoMode" variant="tonal" color="info" class="field-grid__wide"
                  >Only share contact details in the project brief if the provider needs them to assess the work. XPro
                  will keep your contact private until the request allows sharing.</VAlert
                >
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

        <aside aria-label="Your request" class="d-flex flex-column gap-4 request-aside">
          <VCard>
            <VCardText class="pa-0">
              <h2 class="text-h6 px-5 py-4 summary-title">Your request</h2>
              <dl class="summary px-5 py-4">
                <template v-for="row in summary" :key="row.key">
                  <dt>{{ row.key }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
              </dl>
              <div class="assigned mx-5 mb-4">
                <VIcon icon="tabler-shield-check" color="primary-darken-1" size="22" />
                <strong class="text-body-2">XPro assigns a verified provider for you</strong>
              </div>
              <div class="px-5 pb-5 d-flex flex-column gap-3">
                <VBtn
                  type="submit"
                  size="large"
                  block
                  :loading="submitting || (isDemoMode && ops.busy)"
                  :disabled="!isDemoMode && loadingCatalog"
                >
                  {{ auth.isAuthenticated ? "Submit request" : "Continue to sign in" }}
                </VBtn>
                <span class="text-body-2 text-medium-emphasis text-center">
                  {{
                    auth.isAuthenticated
                      ? "Your submitted request will appear in My requests."
                      : "Your brief is kept while you sign in or create an account."
                  }}
                </span>
              </div>
            </VCardText>
          </VCard>
          <VCard color="primary" variant="tonal">
            <VCardText class="on-tonal pa-5">
              <strong class="d-block mb-3">What happens next</strong>
              <ol class="next-list text-body-2">
                <li>XPro reviews your brief and may ask a quick question.</li>
                <li>XPro assigns a verified provider and sends your quote.</li>
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

    .step__badge {
      background: rgb(var(--v-theme-primary));
      color: rgb(var(--v-theme-on-primary));
    }
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
  :deep(.v-selection-control-group) {
    gap: 8px;
  }

  :deep(.v-radio) {
    border: 1px solid rgba(var(--v-border-color), 0.3);
    border-radius: 6px;
    padding-inline: 4px 14px;
  }

  :deep(.v-radio:has(.v-selection-control--dirty)) {
    background: rgba(var(--v-theme-primary), 0.06);
    border-color: rgb(var(--v-theme-primary));
  }

  :deep(.v-radio:focus-within) {
    outline: 2px solid rgb(var(--v-theme-primary));
  }
}

.field-grid {
  display: grid;
  gap: 20px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  &__wide {
    grid-column: 1 / -1;
  }
}

.dropzone {
  background: rgba(var(--v-theme-primary), 0.03);
  border: 1px dashed rgba(var(--v-theme-secondary), 0.6);
  border-radius: 6px;
  padding: 20px;
}

.summary-title {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.summary {
  display: grid;
  font-size: 0.875rem;
  gap: 10px 16px;
  grid-template-columns: auto 1fr;
  margin: 0;

  dt {
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  }
  dd {
    font-weight: 500;
    margin: 0;
    overflow-wrap: anywhere;
    text-align: end;
  }
}

.assigned {
  align-items: center;
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: 6px;
  display: flex;
  gap: 10px;
  padding: 10px 14px;
}

.on-tonal {
  color: rgb(var(--v-theme-on-surface)) !important;
}

.next-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-inline-start: 18px;
}

@media (max-width: 600px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .request-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .request-aside {
    position: static;
  }
}
</style>
