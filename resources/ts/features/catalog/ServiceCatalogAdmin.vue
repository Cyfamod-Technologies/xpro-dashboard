<script setup lang="ts">
import { VForm } from "vuetify/components/VForm"
import { CatalogApiError, catalogApi } from "@/services/catalog-api"
import type {
  AdminCatalog,
  AdminQuestion,
  AdminServiceNode,
  DateRole,
  QuestionConfig,
  QuestionInput,
  QuestionType,
} from "@/features/catalog/types"
import { findNode, isChoiceType, pathTo, questionTypeLabels, questionsAlongPath } from "@/features/catalog/types"

interface OptionDraft {
  id?: string
  label: string
  active: boolean
}

interface QuestionDraft {
  label: string
  helpText: string
  type: QuestionType
  required: boolean
  options: OptionDraft[]
  min: string
  max: string
  integer: boolean
  minLength: string
  maxLength: string
  dateRole: "" | DateRole
  sensitive: boolean
}

interface TreeRow {
  node: AdminServiceNode
  siblings: AdminServiceNode[]
  index: number
}

const conflictMessage = "Someone else changed this. Reload and try again."
const catalog = ref<AdminCatalog | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref("")
const notice = ref("")
const dialogError = ref("")
const selectedId = ref<string | null>(null)
const expanded = ref<string[]>([])
const maxDepthDraft = ref("2")
const draft = reactive({ name: "", description: "", requiresStartDate: false, active: true })

const typeItems = (Object.keys(questionTypeLabels) as QuestionType[]).map(value => ({
  title: questionTypeLabels[value],
  value,
}))
const dateRoleItems = [
  { title: "None", value: "" },
  { title: "Job start date", value: "start" },
  { title: "Job end date", value: "end" },
]

const selected = computed(() =>
  catalog.value && selectedId.value ? findNode(catalog.value.services, selectedId.value) : undefined,
)
const path = computed(() => (catalog.value && selectedId.value ? pathTo(catalog.value.services, selectedId.value) : []))
const inherited = computed(() => questionsAlongPath<AdminQuestion, AdminServiceNode>(path.value.slice(0, -1)))
const maxDepth = computed(() => catalog.value?.maxDepth ?? 2)
const canAddChild = computed(() => (selected.value ? selected.value.depth + 1 < maxDepth.value : false))
const canDelete = computed(() =>
  selected.value ? selected.value.usage.requests === 0 && selected.value.children.length === 0 : false,
)

const rows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = []
  const walk = (nodes: AdminServiceNode[]) => {
    nodes.forEach((node, index) => {
      result.push({ node, siblings: nodes, index })
      if (expanded.value.includes(node.id)) walk(node.children)
    })
  }

  walk(catalog.value?.services ?? [])

  return result
})

const allIds = (nodes: AdminServiceNode[]): string[] => nodes.flatMap(node => [node.id, ...allIds(node.children)])
const parentsWithChildren = (nodes: AdminServiceNode[]): string[] =>
  nodes.flatMap(node => (node.children.length ? [node.id, ...parentsWithChildren(node.children)] : []))

function resetDraft(node?: AdminServiceNode) {
  Object.assign(draft, {
    name: node?.name ?? "",
    description: node?.description ?? "",
    requiresStartDate: node?.requiresStartDate ?? false,
    active: node?.active ?? true,
  })
}

watch(
  () => (selected.value ? `${selected.value.id}:${selected.value.version}` : ""),
  () => resetDraft(selected.value),
  { immediate: true },
)

async function load(first = false) {
  loading.value = true
  try {
    const data = await catalogApi.adminTree()
    const unchanged = !catalog.value || String(catalog.value.maxDepth) === maxDepthDraft.value

    catalog.value = data
    if (first) expanded.value = parentsWithChildren(data.services)
    if (first || unchanged) maxDepthDraft.value = String(data.maxDepth)
    if (selectedId.value && !allIds(data.services).includes(selectedId.value)) selectedId.value = null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "The service catalog could not be loaded."
  } finally {
    loading.value = false
  }
}

// Runs one change, then re-fetches the tree. A stale `version` (409) reloads so the next try starts from fresh data.
async function run(task: () => Promise<unknown>, message: string, target = error): Promise<boolean> {
  busy.value = true
  error.value = ""
  notice.value = ""
  dialogError.value = ""
  try {
    await task()
    await load()
    notice.value = message

    return true
  } catch (cause) {
    const conflict = cause instanceof CatalogApiError && cause.status === 409

    target.value = conflict
      ? conflictMessage
      : cause instanceof Error
        ? cause.message
        : "That change could not be saved."
    if (conflict) await load()

    return false
  } finally {
    busy.value = false
  }
}

const toggleExpanded = (id: string) => {
  expanded.value = expanded.value.includes(id) ? expanded.value.filter(item => item !== id) : [...expanded.value, id]
}

const select = (node: AdminServiceNode) => {
  selectedId.value = node.id
  notice.value = ""
  error.value = ""
}

const saveMaxDepth = () => {
  const value = Number(maxDepthDraft.value)

  if (!Number.isInteger(value) || value < 2 || value > 10) {
    error.value = "Maximum depth must be a whole number from 2 to 10."

    return
  }
  run(() => catalogApi.saveSettings({ maxDepth: value }), "Maximum depth saved.")
}

const saveService = () => {
  const node = selected.value

  if (!node) return
  run(
    () =>
      catalogApi.updateService(node.id, {
        version: node.version,
        name: draft.name.trim(),
        description: draft.description.trim(),
        requiresStartDate: draft.requiresStartDate,
        active: draft.active,
      }),
    "Service saved.",
  )
}

async function move(row: TreeRow, direction: -1 | 1) {
  const ids = row.siblings.map(item => item.id)
  const target = row.index + direction

  if (target < 0 || target >= ids.length) return
  ;[ids[row.index], ids[target]] = [ids[target], ids[row.index]]
  await run(() => catalogApi.reorderServices(row.node.parentId, ids), "Order saved.")
}

// New service dialog (top level, or a sub-service of the selected node).
const createDialog = ref(false)
const createParent = ref<AdminServiceNode | null>(null)
const createForm = reactive({ name: "", description: "", requiresStartDate: false })

function openCreate(parent: AdminServiceNode | null) {
  createParent.value = parent
  Object.assign(createForm, { name: "", description: "", requiresStartDate: false })
  dialogError.value = ""
  createDialog.value = true
}

async function createService() {
  const parent = createParent.value
  let created: AdminServiceNode | undefined

  const ok = await run(
    async () => {
      created = await catalogApi.createService({
        ...(parent ? { parentId: parent.id } : {}),
        name: createForm.name.trim(),
        ...(createForm.description.trim() ? { description: createForm.description.trim() } : {}),
        requiresStartDate: createForm.requiresStartDate,
      })
    },
    "Service created.",
    dialogError,
  )

  if (!ok) return
  createDialog.value = false
  if (parent && !expanded.value.includes(parent.id)) expanded.value = [...expanded.value, parent.id]
  if (created) selectedId.value = created.id
}

// Confirm dialog, shared by deleting a service and a question.
const confirm = reactive({ open: false, title: "", text: "", action: async () => {} })

function askConfirm(title: string, text: string, action: () => Promise<void>) {
  Object.assign(confirm, { open: true, title, text, action })
}

async function confirmed() {
  await confirm.action()
  confirm.open = false
}

function askDeleteService() {
  const node = selected.value

  if (!node) return
  askConfirm(
    "Delete service?",
    `"${node.name}" and its questions will be removed. This cannot be undone.`,
    async () => {
      await run(() => catalogApi.deleteService(node.id), "Service deleted.")
    },
  )
}

// Questions.
const questionDialog = ref(false)
const editing = ref<AdminQuestion | null>(null)
const questionForm = reactive<QuestionDraft>(blankQuestion())
const questionFormRef = ref<VForm>()

function blankQuestion(): QuestionDraft {
  return {
    label: "",
    helpText: "",
    type: "yes_no",
    required: false,
    options: [],
    min: "",
    max: "",
    integer: false,
    minLength: "",
    maxLength: "",
    dateRole: "",
    sensitive: false,
  }
}

const text = (value: number | undefined) => (value === undefined ? "" : String(value))

function openQuestion(question: AdminQuestion | null) {
  editing.value = question
  dialogError.value = ""
  Object.assign(
    questionForm,
    question
      ? {
          label: question.label,
          helpText: question.helpText ?? "",
          type: question.type,
          required: question.required,
          options: question.options.map(option => ({ ...option })),
          min: text(question.config.min),
          max: text(question.config.max),
          integer: question.config.integer ?? false,
          minLength: text(question.config.minLength),
          maxLength: text(question.config.maxLength),
          dateRole: question.dateRole ?? "",
          sensitive: question.sensitive,
        }
      : blankQuestion(),
  )
  questionDialog.value = true
}

watch(
  () => questionForm.type,
  type => {
    if (type !== "date") questionForm.dateRole = ""
  },
)

const addOption = () => questionForm.options.push({ label: "", active: true })
const moveOption = (index: number, direction: -1 | 1) => {
  const target = index + direction

  if (target < 0 || target >= questionForm.options.length) return
  ;[questionForm.options[index], questionForm.options[target]] = [
    questionForm.options[target],
    questionForm.options[index],
  ]
}

const numberText = (value: string) => value.trim() === "" || Number.isFinite(Number(value)) || "Enter a number."
const wholeText = (value: string) =>
  value.trim() === "" || (Number.isInteger(Number(value)) && Number(value) >= 0) || "Enter a whole number."
const requiredText = (value: unknown) => Boolean(String(value ?? "").trim()) || "This field is required."

const questionPayload = (): QuestionInput => {
  const form = questionForm
  const num = (value: string) => (value.trim() === "" ? undefined : Number(value))
  const config: QuestionConfig = {}

  if (form.type === "number") {
    Object.assign(config, { min: num(form.min), max: num(form.max), integer: form.integer })
    if (editing.value?.config.exclusiveMinimum) config.exclusiveMinimum = true
  } else if (form.type === "short_text" || form.type === "long_text") {
    Object.assign(config, { minLength: num(form.minLength), maxLength: num(form.maxLength) })
  }

  return {
    label: form.label.trim(),
    helpText: form.helpText.trim(),
    type: form.type,
    required: form.required,
    ...(isChoiceType(form.type)
      ? {
          options: form.options.map(option => ({
            ...(option.id ? { id: option.id } : {}),
            label: option.label.trim(),
            active: option.active,
          })),
        }
      : {}),
    config,
    dateRole: form.type === "date" ? form.dateRole || null : null,
    sensitive: form.sensitive,
  }
}

async function saveQuestion() {
  const node = selected.value

  if (!node || !(await questionFormRef.value?.validate())?.valid) return
  if (isChoiceType(questionForm.type) && !questionForm.options.some(option => option.active)) {
    dialogError.value = "Add at least one active option."

    return
  }
  if (questionForm.min.trim() && questionForm.max.trim() && Number(questionForm.min) > Number(questionForm.max)) {
    dialogError.value = "The minimum cannot be above the maximum."

    return
  }
  if (
    questionForm.minLength.trim() &&
    questionForm.maxLength.trim() &&
    Number(questionForm.minLength) > Number(questionForm.maxLength)
  ) {
    dialogError.value = "The minimum length cannot be above the maximum length."

    return
  }

  const body = questionPayload()
  const question = editing.value
  const ok = await run(
    () =>
      question
        ? catalogApi.updateQuestion(question.id, { ...body, version: question.version })
        : catalogApi.createQuestion(node.id, body),
    question ? "Question saved." : "Question added.",
    dialogError,
  )

  if (ok) questionDialog.value = false
}

async function moveQuestion(index: number, direction: -1 | 1) {
  const node = selected.value

  if (!node) return

  const ids = node.questions.map(item => item.id)
  const target = index + direction

  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target], ids[index]]
  await run(() => catalogApi.reorderQuestions(node.id, ids), "Order saved.")
}

function askDeleteQuestion(question: AdminQuestion) {
  askConfirm(
    "Delete question?",
    `"${question.label}" will no longer be asked. Requests already made keep the answers they were given.`,
    async () => {
      await run(() => catalogApi.deleteQuestion(question.id), "Question deleted.")
    },
  )
}

onMounted(() => load(true))
</script>

<template>
  <div class="d-flex flex-column gap-5">
    <VAlert v-if="error" type="error" variant="tonal" closable @click:close="error = ''">{{ error }}</VAlert>
    <VAlert v-if="notice" type="success" variant="tonal" closable @click:close="notice = ''">{{ notice }}</VAlert>
    <VProgressLinear v-if="loading" indeterminate />

    <VCard>
      <VCardText class="d-flex flex-wrap align-start gap-4">
        <VTextField
          v-model="maxDepthDraft"
          type="number"
          min="2"
          max="10"
          label="Maximum depth"
          hint="How many levels customers pick through. 2 means Service › Sub-service."
          persistent-hint
          class="depth-field"
        />
        <VBtn variant="outlined" :loading="busy" class="mt-1" @click="saveMaxDepth"> Save </VBtn>
        <VSpacer />
        <VBtn color="primary" prepend-icon="tabler-plus" class="mt-1" @click="openCreate(null)"> Add service </VBtn>
      </VCardText>
    </VCard>

    <VRow>
      <VCol cols="12" md="5">
        <VCard>
          <VCardTitle class="pt-4">Services</VCardTitle>
          <VList v-if="rows.length" aria-label="Services" density="compact">
            <VListItem
              v-for="row in rows"
              :key="row.node.id"
              :active="row.node.id === selectedId"
              color="primary"
              :class="{ 'text-medium-emphasis': !row.node.active }"
              @click="select(row.node)"
            >
              <template #prepend>
                <span class="indent" :style="{ inlineSize: `${row.node.depth * 20}px` }" />
                <VBtn
                  v-if="row.node.children.length"
                  :icon="expanded.includes(row.node.id) ? 'tabler-chevron-down' : 'tabler-chevron-right'"
                  :aria-label="`${expanded.includes(row.node.id) ? 'Collapse' : 'Expand'} ${row.node.name}`"
                  :aria-expanded="expanded.includes(row.node.id)"
                  variant="text"
                  size="x-small"
                  class="me-2"
                  @click.stop="toggleExpanded(row.node.id)"
                />
                <span v-else class="indent me-2" style="inline-size: 28px" />
              </template>
              <VListItemTitle>{{ row.node.name }}</VListItemTitle>
              <VListItemSubtitle>
                {{ row.node.usage.requests }} {{ row.node.usage.requests === 1 ? "request" : "requests" }} ·
                {{ row.node.usage.providers }} {{ row.node.usage.providers === 1 ? "provider" : "providers" }}
              </VListItemSubtitle>
              <template #append>
                <VChip v-if="!row.node.active" size="small" color="warning" variant="tonal" class="me-1">
                  Inactive
                </VChip>
                <VBtn
                  icon="tabler-arrow-up"
                  variant="text"
                  size="x-small"
                  :disabled="busy || row.index === 0"
                  :aria-label="`Move ${row.node.name} up`"
                  @click.stop="move(row, -1)"
                />
                <VBtn
                  icon="tabler-arrow-down"
                  variant="text"
                  size="x-small"
                  :disabled="busy || row.index === row.siblings.length - 1"
                  :aria-label="`Move ${row.node.name} down`"
                  @click.stop="move(row, 1)"
                />
              </template>
            </VListItem>
          </VList>
          <VCardText v-else class="text-medium-emphasis">
            {{ loading ? "Loading services…" : "No services yet. Add the first one." }}
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" md="7">
        <VCard v-if="selected">
          <VCardText class="d-flex flex-column gap-5">
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ path.map(item => item.name).join(" › ") }}
              </div>
              <h2 class="text-h6">Edit service</h2>
            </div>

            <VForm class="d-flex flex-column gap-4" @submit.prevent="saveService">
              <VTextField v-model="draft.name" label="Name *" :rules="[requiredText]" />
              <VTextarea v-model="draft.description" label="Description" rows="2" auto-grow />
              <VSwitch
                v-model="draft.requiresStartDate"
                label="Requires a start date"
                color="primary"
                hide-details
                density="compact"
              />
              <VSwitch
                v-model="draft.active"
                label="Active"
                color="primary"
                hint="Inactive services, and everything under them, are hidden from new requests."
                persistent-hint
                density="compact"
              />
              <div>
                <VBtn type="submit" :loading="busy" :disabled="!draft.name.trim()"> Save </VBtn>
              </div>
            </VForm>

            <VDivider />

            <div class="d-flex flex-wrap align-center gap-3">
              <VBtn
                variant="outlined"
                prepend-icon="tabler-plus"
                :disabled="!canAddChild"
                @click="openCreate(selected)"
              >
                Add sub-service
              </VBtn>
              <span v-if="!canAddChild" class="text-body-2 text-medium-emphasis">
                Raise the maximum depth to add another level.
              </span>
              <VSpacer />
              <VBtn
                v-if="canDelete"
                color="error"
                variant="outlined"
                prepend-icon="tabler-trash"
                @click="askDeleteService"
              >
                Delete
              </VBtn>
              <span v-else class="text-body-2 text-medium-emphasis">
                In use — deactivate it instead to hide it from new requests.
              </span>
            </div>

            <VDivider />

            <section aria-label="Questions" class="d-flex flex-column gap-3">
              <div class="d-flex align-center gap-3">
                <h3 class="text-subtitle-1">Questions</h3>
                <VSpacer />
                <VBtn size="small" prepend-icon="tabler-plus" @click="openQuestion(null)"> Add question </VBtn>
              </div>

              <VList
                v-if="inherited.length"
                density="compact"
                lines="two"
                class="py-0"
                aria-label="Inherited questions"
              >
                <VListItem v-for="item in inherited" :key="item.question.id">
                  <VListItemTitle>{{ item.question.label }}</VListItemTitle>
                  <VListItemSubtitle>
                    From {{ item.from.name }} · {{ questionTypeLabels[item.question.type] }}
                    <template v-if="item.question.required"> · Required</template>
                    <template v-if="!item.question.active"> · Inactive</template>
                  </VListItemSubtitle>
                </VListItem>
              </VList>

              <VList
                v-if="selected.questions.length"
                density="compact"
                class="py-0"
                aria-label="Questions on this service"
              >
                <VListItem v-for="(question, index) in selected.questions" :key="question.id">
                  <VListItemTitle class="text-wrap">{{ question.label }}</VListItemTitle>
                  <div class="d-flex flex-wrap gap-1 mt-1">
                    <VChip size="x-small" variant="tonal">{{ questionTypeLabels[question.type] }}</VChip>
                    <VChip v-if="question.required" size="x-small" color="primary" variant="tonal">Required</VChip>
                    <VChip v-if="question.sensitive" size="x-small" color="warning" variant="tonal">Sensitive</VChip>
                    <VChip v-if="!question.active" size="x-small" color="warning" variant="tonal">Inactive</VChip>
                  </div>
                  <template #append>
                    <VBtn
                      icon="tabler-arrow-up"
                      variant="text"
                      size="x-small"
                      :disabled="busy || index === 0"
                      :aria-label="`Move ${question.label} up`"
                      @click="moveQuestion(index, -1)"
                    />
                    <VBtn
                      icon="tabler-arrow-down"
                      variant="text"
                      size="x-small"
                      :disabled="busy || index === selected.questions.length - 1"
                      :aria-label="`Move ${question.label} down`"
                      @click="moveQuestion(index, 1)"
                    />
                    <VBtn
                      icon="tabler-pencil"
                      variant="text"
                      size="x-small"
                      :aria-label="`Edit ${question.label}`"
                      @click="openQuestion(question)"
                    />
                    <VBtn
                      icon="tabler-trash"
                      variant="text"
                      size="x-small"
                      color="error"
                      :aria-label="`Delete ${question.label}`"
                      @click="askDeleteQuestion(question)"
                    />
                  </template>
                </VListItem>
              </VList>
              <p v-else-if="!inherited.length" class="text-body-2 text-medium-emphasis mb-0">
                No questions yet. Customers will only choose this service.
              </p>
            </section>
          </VCardText>
        </VCard>
        <VCard v-else>
          <VCardText class="text-center text-medium-emphasis py-10">
            Select a service to edit it, or add a new one.
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <VDialog v-model="createDialog" max-width="520">
      <VCard>
        <VForm @submit.prevent="createService">
          <VCardTitle class="pt-4">{{
            createParent ? `Add a sub-service to ${createParent.name}` : "Add service"
          }}</VCardTitle>
          <VCardText class="d-flex flex-column gap-4">
            <VAlert v-if="dialogError" type="error" variant="tonal">{{ dialogError }}</VAlert>
            <VTextField v-model="createForm.name" label="Name *" :rules="[requiredText]" autofocus />
            <VTextarea v-model="createForm.description" label="Description" rows="2" auto-grow />
            <VSwitch
              v-model="createForm.requiresStartDate"
              label="Requires a start date"
              color="primary"
              hide-details
              density="compact"
            />
          </VCardText>
          <VCardActions class="px-6 pb-4">
            <VSpacer />
            <VBtn variant="text" @click="createDialog = false"> Cancel </VBtn>
            <VBtn type="submit" :loading="busy"> Add </VBtn>
          </VCardActions>
        </VForm>
      </VCard>
    </VDialog>

    <VDialog v-model="questionDialog" max-width="640" scrollable>
      <VCard>
        <VCardTitle class="pt-4">{{ editing ? "Edit question" : "Add question" }}</VCardTitle>
        <VCardText>
          <VForm ref="questionFormRef" class="d-flex flex-column gap-4" @submit.prevent="saveQuestion">
            <VAlert v-if="dialogError" type="error" variant="tonal">{{ dialogError }}</VAlert>
            <VTextField v-model="questionForm.label" label="Question *" :rules="[requiredText]" />
            <VTextField v-model="questionForm.helpText" label="Help text" />
            <VSelect
              v-model="questionForm.type"
              :items="typeItems"
              label="Answer type"
              :disabled="Boolean(editing)"
              :hint="editing ? 'The answer type cannot change once the question exists.' : undefined"
              :persistent-hint="Boolean(editing)"
            />
            <VSwitch v-model="questionForm.required" label="Required" color="primary" hide-details density="compact" />

            <section v-if="isChoiceType(questionForm.type)" aria-label="Options" class="d-flex flex-column gap-2">
              <h4 class="text-subtitle-2">Options</h4>
              <div v-for="(option, index) in questionForm.options" :key="option.id ?? index" class="option-row">
                <VTextField
                  v-model="option.label"
                  :label="`Option ${index + 1}`"
                  density="compact"
                  hide-details="auto"
                  :rules="[requiredText]"
                />
                <VSwitch
                  v-model="option.active"
                  label="Active"
                  color="primary"
                  density="compact"
                  hide-details
                  class="flex-shrink-0"
                />
                <VBtn
                  icon="tabler-arrow-up"
                  variant="text"
                  size="x-small"
                  :disabled="index === 0"
                  :aria-label="`Move option ${index + 1} up`"
                  @click="moveOption(index, -1)"
                />
                <VBtn
                  icon="tabler-arrow-down"
                  variant="text"
                  size="x-small"
                  :disabled="index === questionForm.options.length - 1"
                  :aria-label="`Move option ${index + 1} down`"
                  @click="moveOption(index, 1)"
                />
                <VBtn
                  v-if="!option.id"
                  icon="tabler-x"
                  variant="text"
                  size="x-small"
                  :aria-label="`Remove option ${index + 1}`"
                  @click="questionForm.options.splice(index, 1)"
                />
                <span v-else class="option-row__spacer" />
              </div>
              <div>
                <VBtn size="small" variant="outlined" prepend-icon="tabler-plus" @click="addOption"> Add option </VBtn>
              </div>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Saved options can be switched off but not removed, so past answers keep their label.
              </p>
            </section>

            <div v-if="questionForm.type === 'number'" class="d-flex flex-column gap-3">
              <div class="limits">
                <VTextField v-model="questionForm.min" type="number" label="Minimum" :rules="[numberText]" />
                <VTextField v-model="questionForm.max" type="number" label="Maximum" :rules="[numberText]" />
              </div>
              <VSwitch
                v-model="questionForm.integer"
                label="Whole numbers only"
                color="primary"
                hide-details
                density="compact"
              />
            </div>

            <div v-if="questionForm.type === 'short_text' || questionForm.type === 'long_text'" class="limits">
              <VTextField v-model="questionForm.minLength" type="number" label="Minimum length" :rules="[wholeText]" />
              <VTextField v-model="questionForm.maxLength" type="number" label="Maximum length" :rules="[wholeText]" />
            </div>

            <VSelect
              v-if="questionForm.type === 'date'"
              v-model="questionForm.dateRole"
              :items="dateRoleItems"
              label="Date role"
              hint="Marks this date as when the job starts or ends."
              persistent-hint
            />

            <VSwitch
              v-model="questionForm.sensitive"
              label="Sensitive"
              color="primary"
              hint="Hidden from providers until XPro shares it."
              persistent-hint
              density="compact"
            />
          </VForm>
        </VCardText>
        <VCardActions class="px-6 pb-4">
          <VSpacer />
          <VBtn variant="text" @click="questionDialog = false"> Cancel </VBtn>
          <VBtn :loading="busy" @click="saveQuestion"> Save </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="confirm.open" max-width="440">
      <VCard>
        <VCardTitle class="pt-4">{{ confirm.title }}</VCardTitle>
        <VCardText>{{ confirm.text }}</VCardText>
        <VCardActions class="px-6 pb-4">
          <VSpacer />
          <VBtn variant="text" @click="confirm.open = false"> Cancel </VBtn>
          <VBtn color="error" :loading="busy" @click="confirmed"> Delete </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style lang="scss" scoped>
.depth-field {
  flex: 0 1 320px;
  min-inline-size: 220px;
}

.indent {
  display: inline-block;
  flex-shrink: 0;
}

.option-row {
  align-items: center;
  display: flex;
  gap: 4px;

  &__spacer {
    flex-shrink: 0;
    inline-size: 28px;
  }
}

.limits {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 600px) {
  .limits {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
