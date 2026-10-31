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
import { getErrorMessage } from "@/utils/errors"
import { requestsApi } from "@/services/requests-api"
import { catalogApi } from "@/services/catalog-api"
import type { LocationView } from "@/features/requests/api-types"
import type { PublicServiceNode } from "@/features/catalog/types"
import DraftBanner from "@/features/drafts/DraftBanner.vue"
import { useFormDraft } from "@/features/drafts/use-form-draft"
import RequestBundleReceipt from "@/features/discovery/RequestBundleReceipt.vue"
import RequestProjectDetails from "@/features/discovery/RequestProjectDetails.vue"
import RequestServiceCard from "@/features/discovery/RequestServiceCard.vue"
import type { Allowance, RequestDraft, ResolvedService, ServiceUpload } from "@/features/discovery/request-bundle"
import {
  DUPLICATE_SERVICE_MESSAGE,
  MAX_SERVICES_PER_SUBMISSION,
  REQUEST_DRAFT_VERSION,
  addServiceHint,
  allowanceBlockMessage,
  allowanceFrom,
  allowanceInfo,
  buildSubmission,
  canAddService,
  canRemoveService,
  cardsFromDraft,
  contactMethods,
  duplicateCardKeys,
  hasAnswer,
  isCardComplete,
  migrateRequestDraft,
  pathFor,
  pruneAnswers,
  questionsFor,
  readRequestDraft,
  resolveService,
  serviceCap,
  splitServiceErrors,
  toServiceDraft,
} from "@/features/discovery/request-bundle"
import { dateRange, required, validNigerianPhone } from "@/features/discovery/request-rules"
import { queryPrefill } from "@/features/discovery/request-prefill"
import { useServiceCards } from "@/features/discovery/use-service-cards"

const auth = useAuthStore()
const ops = useOperationsStore()
const route = useRoute()
const router = useRouter()
const formRef = ref<VForm>()
const error = ref("")

// Demo mode only: the single file queue. In live mode each Service card holds its own files (MS-8).
const files = ref<File[]>([])
const submitted = ref("")
const submitKey = ref(globalThis.crypto.randomUUID())
const liveError = ref("")
const liveWarning = ref("")
const tree = ref<PublicServiceNode[]>([])

// Live mode: one Service card per requested service. The shared project fields live on `form`.
const { cards, addCard, removeCard, draftFileGroups } = useServiceCards()
const expandedServiceKey = ref(cards.value[0]?.key ?? "")
watch(
  () => cards.value.map(card => card.key),
  keys => {
    if (!keys.includes(expandedServiceKey.value)) expandedServiceKey.value = keys[0] ?? ""
  },
)
const serviceErrors = ref<Record<string, string>>({})
const bundle = ref<{ projectRef: string; requestIds: string[]; warnings: string[] } | null>(null)
const states = ref<LocationView[]>([])
const lgas = ref<LocationView[]>([])
const areas = ref<LocationView[]>([])
const stateId = ref("")
const lgaId = ref("")
const areaId = ref("")
const loadingCatalog = ref(false)
const allowance = ref<Allowance | null>(null)
const submitting = ref(false)
const isCustomer = computed(() => auth.isAuthenticated && auth.user?.role === "customer")
const isOtherRole = computed(() => auth.isAuthenticated && auth.user?.role !== "customer")
const isStaff = computed(() => auth.user?.role === "admin")
const roleBusy = ref(false)
const roleError = ref("")
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
const queryStart = () => (/^\d{4}-\d{2}-\d{2}$/.test(queryText("start")) ? queryText("start") : "")

const queryService = queryText("service")

if (isDemoMode && queryService in intakeFields) {
  if (queryService !== form.service) form.details = {}
  form.service = queryService as RequestInput["service"]
}
if (queryText("title")) form.title = queryText("title")
if (isDemoMode && queryText("city")) form.city = queryText("city")
if (isDemoMode && queryStart()) form.startDate = queryStart()
if (isDemoMode) {
  for (const field of intakeFields[form.service]) {
    const value = queryText(field.key)

    if (value && (!field.options || field.options.includes(value))) form.details[field.key] = value
  }
}

// Demo mode: the frozen reducer form, one service from the built-in list.
const serviceNames = serviceLines.map(item => item.name)
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

// Live catalog: `?service=` and friends fill the first Service card, then the start date.
function applyQueryPrefill() {
  const first = cards.value[0]
  const picked = queryPrefill(tree.value, route.query)

  if (!first) return
  if (picked) {
    first.selectedIds = picked.selectedIds
    first.answers = pruneAnswers(tree.value, first.selectedIds, { ...first.answers, ...picked.answers })
  }
  if (queryStart()) first.startDate = queryStart()
}

// Several services: the limit, the duplicate check and the focus after adding or failing.
const maxServicesPerSubmission = ref(MAX_SERVICES_PER_SUBMISSION)
const cap = computed(() => serviceCap(allowance.value, maxServicesPerSubmission.value))
const canAdd = computed(() => canAddService(cards.value.length, cap.value))
const allowanceBlock = computed(() => (isDemoMode ? "" : allowanceBlockMessage(allowance.value, cards.value.length)))
const serviceCountBlock = computed(() =>
  !isDemoMode && cards.value.length > maxServicesPerSubmission.value
    ? `This draft has ${cards.value.length} services, but the current limit is ${maxServicesPerSubmission.value}. Remove ${cards.value.length - maxServicesPerSubmission.value} ${cards.value.length - maxServicesPerSubmission.value === 1 ? "service" : "services"} to continue.`
    : "",
)
const submissionBlock = computed(() => serviceCountBlock.value || allowanceBlock.value)
const allowanceNote = computed(() => allowanceInfo(allowance.value, maxServicesPerSubmission.value))
const addHint = computed(() => addServiceHint(allowance.value, maxServicesPerSubmission.value))
const duplicates = computed(() => duplicateCardKeys(cards.value, tree.value))

function focusCard(key: string | undefined) {
  if (!key) return
  expandedServiceKey.value = key
  nextTick(() => {
    const heading = document.getElementById(`service-card-title-${key}`)

    heading?.scrollIntoView({ block: "center" })
    heading?.focus({ preventScroll: true })
  })
}

const addService = () => focusCard(addCard(cap.value))

function removeService(key: string) {
  const wasExpanded = expandedServiceKey.value === key
  removeCard(key)
  if (wasExpanded) expandedServiceKey.value = cards.value[0]?.key ?? ""
}

// How many requests this customer may still open (MS-6). A failed lookup leaves the allowance unknown, and the
// server decides on submit.
async function loadAllowance() {
  if (!isCustomer.value || isDemoMode) {
    allowance.value = null

    return
  }
  try {
    allowance.value = allowanceFrom(await requestsApi.pending())
  } catch {
    allowance.value = null
  }
}

watch(isCustomer, loadAllowance, { immediate: true })

// A provider submits from the customer workspace of the same account (01 §6.6, §6.16). The draft belongs to the
// user, not the role, so it stays on screen once the form opens.
const useCustomerWorkspace = async () => {
  if (roleBusy.value) return
  roleBusy.value = true
  roleError.value = ""
  try {
    if (auth.holdsRole("customer")) await auth.switchRole("customer")
    else await auth.addRole("customer")
  } catch (cause) {
    roleError.value = getErrorMessage(cause, "We couldn't open your customer workspace. Try again.")
  } finally {
    roleBusy.value = false
  }
}

// Staff keep the draft and continue as a guest, signing in again with a customer account.
const signOutForCustomerAccount = async () => {
  auth.logout()
  await router.push({ path: "/login", query: { redirect: "/request" } })
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
const label = (field: IntakeField) => (field.required ? `${field.label} *` : field.label)
const filled = (field: IntakeField) => Boolean(String(form.details[field.key] ?? "").trim())

const budgetInput = computed({
  get: () => (form.budget ? String(form.budget) : ""),
  set: value => {
    form.budget = Math.max(0, Number(value) || 0)
  },
})

// Progress through the steps shown above the form.
const stepLabels = isDemoMode
  ? ["Service", "Job details", "Location & timing", "Review & submit"]
  : ["Project details", "Services", "Review & submit"]
const stepDone = computed(() =>
  isDemoMode
    ? [
        choiceFields.value.filter(field => field.required).every(filled),
        form.title.trim().length >= 3 &&
          inputFields.value.filter(field => field.required).every(filled) &&
          form.description.trim().length >= 20,
        Boolean(form.city.trim() && form.phone.trim() && form.address.trim()),
        Boolean(submitted.value),
      ]
    : [
        form.title.trim().length >= 3 &&
          Boolean(stateId.value && lgaId.value && form.phone.trim() && form.address.trim()),
        cards.value.every(card => isCardComplete(card, tree.value)),
        Boolean(submitted.value),
      ],
)

const steps = computed(() => {
  const last = stepLabels.length - 1
  const current = submitted.value
    ? -1
    : Math.max(
        0,
        stepDone.value.findIndex((done, index) => index < last && !done),
      ) || (stepDone.value.slice(0, last).every(Boolean) ? last : 0)

  return stepLabels.map((name, index) => ({
    name,
    state: stepDone.value[index] || index < current ? "done" : index === current ? "current" : "todo",
    number: index + 1,
  }))
})

const summary = computed(() => [
  { key: "Service", value: form.service },
  ...(form.title.trim() ? [{ key: "Title", value: form.title.trim() }] : []),
  ...fields.value
    .filter(filled)
    .map(field => ({ key: field.label.replace(/ \(.*\)$/, ""), value: form.details[field.key] })),
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

// The chosen place, most specific first (for example `Life Camp, Abuja Municipal, FCT`).
const locationSummary = computed(() =>
  [
    areas.value.find(item => item.id === areaId.value),
    lgas.value.find(item => item.id === lgaId.value),
    states.value.find(item => item.id === stateId.value),
  ]
    .filter(Boolean)
    .map(item => item!.name)
    .join(", "),
)

// Live summary: the shared project rows, then every service with its path and start date.
const liveSummary = computed(() => {
  const fileCount = cards.value.reduce((total, card) => total + card.files.length, 0)

  return [
    ...(form.title.trim() ? [{ key: "Title", value: form.title.trim() }] : []),
    { key: "Location", value: locationSummary.value || "Not set" },
    { key: "Contact", value: contactMethods.find(item => item.value === form.contactMethod)?.title ?? "Phone" },
    ...(fileCount ? [{ key: "Files", value: String(fileCount) }] : []),
  ]
})
const serviceSummaries = computed(() =>
  cards.value.map(card => {
    const nodes = pathFor(tree.value, card.selectedIds)
    const questions = questionsFor(nodes)
    const details = questions
      .filter(question => hasAnswer(card.answers[question.id]))
      .map(question => {
        const answer = card.answers[question.id]
        const choices = new Map(question.options.map(option => [option.id, option.label]))
        const value = Array.isArray(answer) ? answer : [answer]

        return {
          key: question.id,
          label: question.label.replace(/ \(.*\)$/, ""),
          value: value
            .map(item =>
              question.type === "date" ? formatDate(String(item)) : (choices.get(String(item)) ?? String(item)),
            )
            .join(", "),
        }
      })

    return {
      key: card.key,
      path: nodes.map(node => node.name).join(" › ") || "Service not chosen",
      brief: card.description.trim() || "Not added",
      details,
      start: formatDate(card.startDate) || "Flexible",
      budget: card.budget
        ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
            card.budget,
          )
        : "Quote first",
      files: card.files.length,
    }
  }),
)
const submitLabel = computed(() =>
  !auth.isAuthenticated
    ? "Continue to sign in"
    : !isDemoMode && cards.value.length > 1
      ? `Submit ${cards.value.length} requests`
      : "Submit request",
)

const goBack = () => {
  if (window.history.state?.back) router.back()
  else router.push("/")
}

// Customers can only choose served places. Choosing a level clears and reloads the ones below it, and a level with
// exactly one option is chosen for the customer.
const loadServed = (parentId?: string) => requestsApi.locations(parentId, { serviceable: true })

async function chooseState(id: string | null) {
  stateId.value = id || ""
  lgaId.value = ""
  areaId.value = ""
  lgas.value = []
  areas.value = []
  if (!id) return

  const result = await loadServed(id)

  if (stateId.value !== id) return
  lgas.value = result
  if (result.length === 1) await chooseLga(result[0].id)
}

async function chooseLga(id: string | null) {
  lgaId.value = id || ""
  areaId.value = ""
  areas.value = []
  if (!id || !lgas.value.find(item => item.id === id)?.hasChildren) return

  const result = await loadServed(id)

  if (lgaId.value !== id) return
  areas.value = result
  if (result.length === 1) areaId.value = result[0].id
}

// Autosaved draft: text in localStorage, queued files in IndexedDB. A guest's draft follows them through sign-in.
const draft = useFormDraft<RequestDraft>({
  formId: "request",
  version: REQUEST_DRAFT_VERSION,
  legacy: { versions: [1], migrate: migrateRequestDraft },
  owner: () => auth.user?.id ?? "guest",
  adoptGuest: true,
  snapshot: () => ({
    title: form.title,
    address: form.address,
    phone: form.phone,
    contactMethod: form.contactMethod,
    city: form.city,
    stateId: stateId.value,
    lgaId: lgaId.value,
    areaId: areaId.value,
    submitKey: submitKey.value,
    services: isDemoMode ? [] : cards.value.map(toServiceDraft),
    service: form.service,
    details: form.details,
    description: form.description,
    budget: form.budget,
    startDate: form.startDate,
  }),
  restore: async raw => {
    const data = readRequestDraft(raw)

    if (!data) return
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
      cards.value = cardsFromDraft(data.services, tree.value)
      // Walk down the levels, waiting for each list before choosing from it.
      if (states.value.some(item => item.id === data.stateId)) {
        await chooseState(data.stateId)
        if (lgas.value.some(item => item.id === data.lgaId)) {
          await chooseLga(data.lgaId)
          if (areas.value.some(item => item.id === data.areaId)) areaId.value = data.areaId
        }
      }
    }
    // Links that pre-fill the form (popular jobs, service pages) win over a saved draft.
    if (queryText("title")) form.title = queryText("title")
    if (queryText("city") && isDemoMode) form.city = queryText("city")
    if (isDemoMode && queryStart()) form.startDate = queryStart()
    if (!isDemoMode) applyQueryPrefill()
  },
  files: isDemoMode ? { attachments: files } : draftFileGroups,
  // A v1 draft kept its one service's files in the `attachments` group; they now belong to the first Service card.
  onFilesRestored: stored => {
    const first = cards.value[0]

    if (!isDemoMode && first && !first.files.length && stored.attachments?.length) first.files = stored.attachments
  },
})

onMounted(async () => {
  if (isDemoMode) {
    await draft.start()

    return
  }
  loadingCatalog.value = true
  try {
    const [services, locations, config] = await Promise.all([
      catalogApi.publicTree(),
      loadServed(),
      requestsApi.publicConfig(),
    ])
    tree.value = services
    states.value = locations
    maxServicesPerSubmission.value = config.maxServicesPerSubmission
    applyQueryPrefill()
    if (locations.length === 1) await chooseState(locations[0].id)
  } catch (cause) {
    liveError.value = cause instanceof Error ? cause.message : "The request form could not be loaded."
  } finally {
    loadingCatalog.value = false
    await draft.start()
  }
})

// Each file is uploaded once, for the card it belongs to.
async function uploadRequestFiles(queued: File[]) {
  const attachments: Array<{ id: string }> = []
  for (const file of queued) {
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

// One service uses `POST /requests`; several use `POST /request-groups` with the same Idempotency-Key for the whole submission.
async function submitLive() {
  if (!stateId.value || !lgaId.value) throw new Error("Choose your location from the list.")

  const services: ResolvedService[] = []

  for (const card of cards.value) {
    const service = resolveService(card, tree.value)

    if (!service) throw new Error("Choose a service to continue.")
    services.push(service)
  }

  const uploads: ServiceUpload[] = []

  for (const [index, card] of cards.value.entries())
    uploads.push({ service: services[index], attachments: await uploadRequestFiles(card.files) })

  const submission = buildSubmission(
    {
      title: form.title,
      locationId: areaId.value || lgaId.value,
      address: form.address,
      phone: form.phone,
      contactMethod: form.contactMethod,
    },
    uploads,
  )

  if (submission.kind === "single") {
    const result = await requestsApi.create(submission.body, submitKey.value)

    submitted.value = result.id
    liveWarning.value = result.warning ?? ""
  } else {
    const result = await requestsApi.createGroup(submission.body, submitKey.value)
    const requestIds = result.requests.map(item => item.id)

    bundle.value = {
      projectRef: result.group?.ref ?? "",
      requestIds,
      warnings: (result.warnings ?? []).map(item => item.message),
    }
    submitted.value = requestIds[0] ?? result.group?.ref ?? "submitted"
  }
  for (const card of cards.value) card.files = []
  await draft.clear()
}

// A 422 whose field path starts with `services[i]` belongs to card i; anything else goes in the page alert.
function showSubmitError(cause: unknown) {
  // The server's allowance changed since the page loaded: show its message and read the allowance again.
  if (!isDemoMode && (cause as { code?: unknown } | null)?.code === "OPEN_REQUEST_LIMIT") {
    error.value = cause instanceof Error ? cause.message : "You have too many open requests to send this."
    loadAllowance()

    return
  }

  const split = isDemoMode
    ? null
    : splitServiceErrors((cause as { details?: unknown } | null)?.details, cards.value.length)
  const indexes = Object.keys(split?.byService ?? {}).map(Number)

  if (split && indexes.length) {
    serviceErrors.value = Object.fromEntries(indexes.map(index => [cards.value[index].key, split.byService[index]]))
    error.value = split.general[0] ?? ""
    focusCard(cards.value[indexes[0]].key)

    return
  }
  error.value = cause instanceof Error ? cause.message : "Unable to save the brief. Please retry."
}

const submit = async () => {
  error.value = ""
  liveError.value = ""
  liveWarning.value = ""
  serviceErrors.value = {}
  if (!(await formRef.value?.validate())?.valid) return
  if (!isDemoMode && submissionBlock.value) return
  if (!isDemoMode && duplicates.value.size) {
    focusCard([...duplicates.value][0])

    return
  }
  submitting.value = true
  try {
    if (!auth.isAuthenticated) {
      await router.push({ path: "/login", query: { redirect: "/request" } })

      return
    }
    if (!isDemoMode) {
      await submitLive()
    } else {
      form.attachments = [...form.attachments, ...(await prepareFiles(files.value))]
      files.value = []
      if (await ops.run({ type: "request.create", input: JSON.parse(JSON.stringify(form)) as RequestInput })) {
        submitted.value = ops.requests[0]?.id ?? ""
        await draft.clear()
      }
    }
  } catch (cause) {
    showSubmitError(cause)
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

    <RequestBundleReceipt
      v-if="bundle"
      :project-ref="bundle.projectRef"
      :request-ids="bundle.requestIds"
      :warnings="bundle.warnings"
    />
    <VCard v-else-if="submitted" color="success" variant="tonal">
      <VCardText class="pa-6">
        <h2 class="text-h5 mb-2">Your request is on its way.</h2>
        <p>{{ submitted }} has been sent to XPro for review.</p>
        <VAlert v-if="liveWarning" type="warning" variant="tonal" class="mb-4">{{ liveWarning }}</VAlert>
        <VBtn :to="{ path: '/requests', query: { request: submitted } }"> View my request </VBtn>
      </VCardText>
    </VCard>
    <VAlert v-else-if="isOtherRole && isStaff" color="info" variant="tonal">
      <h2 class="text-h6 mb-1">Requests are made from a customer account</h2>
      <p class="mb-4">Staff accounts can't submit requests. Sign out and use a customer account.</p>
      <div class="d-flex flex-wrap gap-3">
        <VBtn color="primary" @click="signOutForCustomerAccount"> Sign out </VBtn>
        <VBtn color="primary" variant="outlined" :to="auth.homePath"> Back to my dashboard </VBtn>
      </div>
    </VAlert>
    <VAlert v-else-if="isOtherRole" color="info" variant="tonal">
      <h2 class="text-h6 mb-1">Requests are made from a customer account</h2>
      <p class="mb-4">
        {{
          auth.holdsRole("customer")
            ? "You're in your provider workspace. Switch to your customer workspace to submit this request."
            : "Requests are submitted from a customer account. Add the customer role to this account to submit it."
        }}
      </p>
      <VAlert v-if="roleError" class="mb-4" color="error" variant="tonal">{{ roleError }}</VAlert>
      <div class="d-flex flex-wrap gap-3">
        <VBtn color="primary" :loading="roleBusy" @click="useCustomerWorkspace">
          {{ auth.holdsRole("customer") ? "Switch to customer workspace" : "Add customer role" }}
        </VBtn>
        <VBtn color="primary" variant="outlined" :to="auth.homePath"> Back to my dashboard </VBtn>
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
          <VAlert v-if="submissionBlock" color="warning" variant="tonal">
            <p class="mb-3">{{ submissionBlock }}</p>
            <VBtn size="small" color="primary" variant="outlined" to="/requests">View my requests</VBtn>
          </VAlert>
          <VAlert v-if="error || liveError || ops.error" color="error" variant="tonal">
            {{ error || liveError || ops.error }}
          </VAlert>

          <template v-if="isDemoMode">
            <VCard>
              <VCardText class="pa-6 d-flex flex-column gap-5">
                <h2 class="text-h6">Service</h2>
                <VSelect
                  v-model="form.service"
                  :items="serviceNames"
                  label="Service"
                  :rules="[required]"
                  :loading="loadingCatalog"
                />
                <div v-if="selectedLine" class="service-note">
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
                <div v-if="inputFields.length" class="field-grid">
                  <VTextField
                    v-for="field in inputFields"
                    :key="`${form.service}-${field.key}`"
                    v-model="form.details[field.key]"
                    :type="field.type ?? 'text'"
                    :label="label(field)"
                    :rules="fieldRules(field)"
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
                  <VTextField v-model="form.city" label="City / service area *" :rules="[required]" />
                  <VTextField
                    v-model="form.phone"
                    label="Contact phone *"
                    type="tel"
                    :rules="[required, validNigerianPhone]"
                  />
                  <VSelect v-model="form.contactMethod" :items="contactMethods" label="Preferred contact method" />
                  <VTextField
                    v-model="form.startDate"
                    label="Preferred start date"
                    type="date"
                    :rules="[...(form.service === 'Hire' ? [required] : []), dateRange]"
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
          </template>

          <template v-else>
            <RequestProjectDetails
              v-model:title="form.title"
              v-model:address="form.address"
              v-model:phone="form.phone"
              v-model:contact-method="form.contactMethod"
              :state-id="stateId"
              :lga-id="lgaId"
              :area-id="areaId"
              :states="states"
              :lgas="lgas"
              :areas="areas"
              @update:state-id="chooseState"
              @update:lga-id="chooseLga"
              @update:area-id="areaId = $event || ''"
            />
            <VCard class="service-accordion-list pa-0" role="group" aria-label="Services">
              <RequestServiceCard
                v-for="(card, index) in cards"
                :key="card.key"
                v-model="cards[index]"
                :tree="tree"
                :loading="loadingCatalog"
                :index="index"
                :total="cards.length"
                :can-remove="canRemoveService(cards.length)"
                :duplicate-message="duplicates.has(card.key) ? DUPLICATE_SERVICE_MESSAGE : undefined"
                :server-error="serviceErrors[card.key]"
                :expanded="expandedServiceKey === card.key"
                @toggle="expandedServiceKey = expandedServiceKey === card.key ? '' : card.key"
                @remove="removeService(card.key)"
              />
            </VCard>
            <VAlert v-if="allowanceNote" type="info" variant="tonal" density="compact">{{ allowanceNote }}</VAlert>
            <div class="d-flex flex-column align-start gap-2">
              <VBtn
                variant="outlined"
                color="primary"
                prepend-icon="tabler-plus"
                :disabled="!canAdd || loadingCatalog"
                aria-describedby="add-service-hint"
                @click="addService"
              >
                Add another service
              </VBtn>
              <p v-if="!canAdd" id="add-service-hint" class="text-body-2 text-medium-emphasis mb-0">
                {{ addHint }}
              </p>
            </div>
          </template>
        </div>

        <aside aria-label="Your request" class="d-flex flex-column gap-4 request-aside">
          <VCard>
            <VCardText class="pa-0">
              <h2 class="text-h6 px-5 py-4 summary-title">Your request</h2>
              <dl v-if="isDemoMode" class="summary px-5 py-4">
                <template v-for="row in summary" :key="row.key">
                  <dt>{{ row.key }}</dt>
                  <dd>{{ row.value }}</dd>
                </template>
              </dl>
              <template v-else>
                <dl class="summary px-5 py-4">
                  <template v-for="row in liveSummary" :key="row.key">
                    <dt>{{ row.key }}</dt>
                    <dd>{{ row.value }}</dd>
                  </template>
                </dl>
                <ol class="service-list px-5 pb-4" aria-label="Services in this request">
                  <li v-for="(item, index) in serviceSummaries" :key="item.key">
                    <strong class="d-block">{{ index + 1 }}. {{ item.path }}</strong>
                    <dl class="service-details">
                      <dt>Brief</dt>
                      <dd>{{ item.brief }}</dd>
                      <template v-for="detail in item.details" :key="detail.key">
                        <dt>{{ detail.label }}</dt>
                        <dd>{{ detail.value }}</dd>
                      </template>
                      <dt>Start</dt>
                      <dd>{{ item.start }}</dd>
                      <dt>Budget</dt>
                      <dd>{{ item.budget }}</dd>
                      <dt>Files</dt>
                      <dd>{{ item.files }}</dd>
                    </dl>
                  </li>
                </ol>
                <p class="text-body-2 px-5 pb-4 mb-0">
                  {{
                    serviceSummaries.length > 1
                      ? `This will create ${serviceSummaries.length} requests, one for each service.`
                      : "This will create 1 request."
                  }}
                </p>
              </template>
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
                  :disabled="!isDemoMode && (loadingCatalog || Boolean(submissionBlock))"
                >
                  {{ submitLabel }}
                </VBtn>
                <span class="text-body-2 text-medium-emphasis text-center">
                  {{
                    auth.isAuthenticated
                      ? `Your submitted ${!isDemoMode && cards.length > 1 ? "requests" : "request"} will appear in My requests.`
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

<style lang="scss" scoped src="./request-form-fields.scss" />

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

.service-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  margin: 0;
  overflow-wrap: anywhere;
}

.service-details {
  display: grid;
  font-size: 0.8125rem;
  gap: 6px 12px;
  grid-template-columns: auto minmax(0, 1fr);
  margin: 6px 0 0;

  dt {
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  }

  dd {
    margin: 0;
    text-align: end;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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

@media (max-width: 960px) {
  .request-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .request-aside {
    position: static;
  }
}
</style>
