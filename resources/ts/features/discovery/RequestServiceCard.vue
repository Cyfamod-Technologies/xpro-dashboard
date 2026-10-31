<script setup lang="ts">
import { serviceLines } from "@/features/workspace/config"
import type { Attachment } from "@/features/operations/types"
import FilePicker from "@/features/operations/FilePicker.vue"
import type { PublicQuestion, PublicServiceNode } from "@/features/catalog/types"
import type { ServiceCardState } from "@/features/discovery/request-bundle"
import { pathFor, pruneAnswers, questionsFor } from "@/features/discovery/request-bundle"
import { briefRules, dateRange, questionRules, required } from "@/features/discovery/request-rules"

/**
 * One Service card of the live request form: the service picker (one level at a time), the questions it inherits,
 * and the per-service brief, budget, start date and files. The shared project fields live in the Project details card.
 */
const props = defineProps<{
  tree: PublicServiceNode[]
  loading: boolean
  index: number
  total: number
  canRemove: boolean
  expanded: boolean

  /** Shown when another card already picked the same service. */
  duplicateMessage?: string

  /** The server's message for this card after a failed submit. */
  serverError?: string
}>()
const emit = defineEmits<{ remove: []; toggle: [] }>()
const card = defineModel<ServiceCardState>({ required: true })
const noSavedFiles: Attachment[] = []

const headingId = computed(() => `service-card-title-${card.value.key}`)
const title = computed(() => (props.total > 1 ? `Service ${props.index + 1}` : "Service"))
const pathNodes = computed(() => pathFor(props.tree, card.value.selectedIds))
const rootNode = computed(() => pathNodes.value[0])

// Every selected node that has children opens one more level below the top-level select.
const childLevels = computed(() =>
  pathNodes.value
    .map((parent, index) => ({ parent, depth: index + 1, items: parent.children }))
    .filter(level => level.items.length),
)
const pathQuestions = computed(() => questionsFor(pathNodes.value))
const isChoiceQuestion = (question: PublicQuestion) =>
  question.type === "yes_no" || question.type === "single_choice" || question.type === "multiple_choice"
const choiceQuestions = computed(() => pathQuestions.value.filter(isChoiceQuestion))
const inputQuestions = computed(() => pathQuestions.value.filter(question => !isChoiceQuestion(question)))
const requiresStartDate = computed(() => pathNodes.value.some(node => node.requiresStartDate))
const serviceNote = computed(() => {
  const root = rootNode.value

  if (!root) return null

  const line = serviceLines.find(item => item.name === root.name)

  return {
    name: root.name,
    description: root.description || line?.description || "",
  }
})

const questionLabel = (question: PublicQuestion) => (question.required ? `${question.label} *` : question.label)
const optionsFor = (question: PublicQuestion) =>
  question.type === "yes_no"
    ? [
        { id: "Yes", label: "Yes" },
        { id: "No", label: "No" },
      ]
    : question.options

// Short option lists render as pills; longer ones as a select.
const questionAsSelect = (question: PublicQuestion) => optionsFor(question).length > 6

// An "end" date must not precede this card's start date or its "start" date answers.
const startDates = () => [
  card.value.startDate,
  ...pathQuestions.value
    .filter(item => item.dateRole === "start")
    .map(item => String(card.value.answers[item.id] ?? "")),
]
const rulesFor = (question: PublicQuestion) => questionRules(question, startDates)

// Changing a level clears every level below it, and the answers to questions that are no longer on the path.
function selectNode(level: number, id: string | null) {
  card.value.selectedIds = id ? [...card.value.selectedIds.slice(0, level), id] : card.value.selectedIds.slice(0, level)
  card.value.answers = pruneAnswers(props.tree, card.value.selectedIds, card.value.answers)
}

const budgetInput = computed({
  get: () => (card.value.budget ? String(card.value.budget) : ""),
  set: value => {
    card.value.budget = Math.max(0, Number(value) || 0)
  },
})
</script>

<template>
  <section :id="`service-card-${card.key}`" class="service-accordion" role="group" :aria-labelledby="headingId">
    <div class="service-accordion__heading">
      <button
        :id="headingId"
        type="button"
        class="service-card__toggle"
        :aria-expanded="expanded"
        :aria-controls="`service-card-content-${card.key}`"
        @click="emit('toggle')"
      >
        <span>
          <strong class="d-block text-h6">{{ title }}</strong>
          <span class="text-body-2 text-medium-emphasis">
            {{ pathNodes.map(node => node.name).join(" › ") || "Choose a service" }}
            <template v-if="!expanded && card.description.trim()"> · {{ card.description.trim() }}</template>
          </span>
        </span>
      </button>
      <div class="service-accordion__actions">
        <VBtn
          v-if="canRemove"
          variant="text"
          color="error"
          size="small"
          prepend-icon="tabler-trash"
          :aria-label="`Remove service ${index + 1}`"
          @click="emit('remove')"
        >
          Remove
        </VBtn>
        <button
          type="button"
          class="service-card__expand"
          :aria-label="`${expanded ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`"
          :aria-expanded="expanded"
          :aria-controls="`service-card-content-${card.key}`"
          @click="emit('toggle')"
        >
          <VIcon :icon="expanded ? 'tabler-chevron-up' : 'tabler-chevron-down'" aria-hidden="true" />
        </button>
      </div>
    </div>

    <VAlert v-if="serverError" class="mx-6 mt-4" type="error" variant="tonal" role="alert">{{ serverError }}</VAlert>
    <VAlert v-if="duplicateMessage" class="mx-6 mt-4" type="error" variant="tonal" role="alert">{{
      duplicateMessage
    }}</VAlert>

    <div v-show="expanded" :id="`service-card-content-${card.key}`" class="service-accordion__body">
      <VSelect
        :model-value="card.selectedIds[0]"
        :items="tree"
        item-title="name"
        item-value="id"
        label="Service *"
        :rules="[required]"
        :loading="loading"
        @update:model-value="selectNode(0, $event)"
      />
      <div v-if="serviceNote" class="service-note">
        <div>
          <strong class="d-block">{{ serviceNote.name }}</strong>
          <span class="text-body-2 text-medium-emphasis">{{ serviceNote.description }}</span>
        </div>
      </div>
      <template v-for="level in childLevels" :key="level.parent.id">
        <VSelect
          v-if="level.items.length > 6"
          :model-value="card.selectedIds[level.depth]"
          :items="level.items"
          item-title="name"
          item-value="id"
          :label="`${level.parent.name} *`"
          :rules="[required]"
          @update:model-value="selectNode(level.depth, $event)"
        />
        <VRadioGroup
          v-else
          :model-value="card.selectedIds[level.depth]"
          :label="`${level.parent.name} *`"
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
          v-model="card.answers[question.id]"
          :items="question.options"
          item-title="label"
          item-value="id"
          :label="questionLabel(question)"
          :hint="question.helpText ?? undefined"
          :persistent-hint="Boolean(question.helpText)"
          :rules="rulesFor(question)"
          multiple
          chips
          closable-chips
        />
        <VSelect
          v-else-if="questionAsSelect(question)"
          v-model="card.answers[question.id]"
          :items="optionsFor(question)"
          item-title="label"
          item-value="id"
          :label="questionLabel(question)"
          :hint="question.helpText ?? undefined"
          :persistent-hint="Boolean(question.helpText)"
          :rules="rulesFor(question)"
          :clearable="!question.required"
        />
        <VRadioGroup
          v-else
          v-model="card.answers[question.id]"
          :label="questionLabel(question)"
          :hint="question.helpText ?? undefined"
          :persistent-hint="Boolean(question.helpText)"
          :rules="rulesFor(question)"
          inline
          class="pills"
        >
          <VRadio v-for="option in optionsFor(question)" :key="option.id" :label="option.label" :value="option.id" />
        </VRadioGroup>
      </template>

      <div v-if="inputQuestions.length" class="field-grid">
        <template v-for="question in inputQuestions" :key="question.id">
          <VTextarea
            v-if="question.type === 'long_text'"
            v-model="card.answers[question.id]"
            :label="questionLabel(question)"
            :hint="question.helpText ?? undefined"
            :persistent-hint="Boolean(question.helpText)"
            :rules="rulesFor(question)"
            rows="3"
            class="field-grid__wide"
          />
          <VTextField
            v-else
            v-model="card.answers[question.id]"
            :type="question.type === 'number' ? 'number' : question.type === 'date' ? 'date' : 'text'"
            :label="questionLabel(question)"
            :hint="question.helpText ?? undefined"
            :persistent-hint="Boolean(question.helpText)"
            :rules="rulesFor(question)"
          />
        </template>
      </div>

      <VTextarea
        v-model="card.description"
        label="Brief for this service *"
        placeholder="Scope, expectations and anything XPro should know."
        hint="At least 20 characters. Mention materials, finishes and anything already done."
        persistent-hint
        :rules="briefRules"
        counter
        rows="4"
      />
      <VAlert variant="tonal" color="info"
        >Only share contact details in the project brief if the provider needs them to assess the work. XPro will keep
        your contact private until the request allows sharing.</VAlert
      >
      <div class="field-grid">
        <VTextField
          v-model="card.startDate"
          :label="requiresStartDate ? 'Preferred start date *' : 'Preferred start date'"
          type="date"
          :rules="[...(requiresStartDate ? [required] : []), dateRange]"
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
      <div class="dropzone">
        <div class="d-flex align-center gap-3 mb-3">
          <VIcon icon="tabler-upload" color="primary-darken-1" size="26" />
          <div>
            <strong class="d-block text-body-2">Add files for this service</strong>
            <span class="text-body-2 text-medium-emphasis">Up to 6 files, 20 MB each</span>
          </div>
        </div>
        <FilePicker
          v-model:queued="card.files"
          :saved="noSavedFiles"
          purpose="request_attachment"
          label="Drawings, brief or reference files for this service"
        />
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped src="./request-form-fields.scss" />

<style lang="scss" scoped>
.service-accordion {
  border-block-end: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-inline: 24px;

  &:last-child {
    border-block-end: 0;
  }
}

.service-accordion__heading {
  align-items: center;
  display: flex;
  gap: 12px;
  min-block-size: 72px;
}

.service-accordion__actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.service-card__toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 0;
  text-align: start;
  text-decoration: none;

  > span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &:focus-visible {
    border-radius: 4px;
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 4px;
  }
}

.service-card__expand {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 40px;
  height: 40px;
  justify-content: center;
  padding: 0;
  width: 40px;

  &:hover {
    background: rgba(var(--v-theme-on-surface), 0.06);
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}

.service-accordion__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-block: 4px 24px;
}

@media (max-width: 600px) {
  .service-accordion {
    padding-inline: 16px;
  }

  .service-accordion__heading {
    gap: 4px;
  }

  .service-accordion__actions {
    gap: 2px;
  }
}
</style>
