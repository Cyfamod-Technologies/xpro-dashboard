<script setup lang="ts">
import { counterNoteMaxLength, koboToNairaInput, nairaToKobo, todayIso, validateCounter } from "@/features/v1/helpers"
import type { V1Counter, V1Message } from "@/features/v1/types"
import { v1Api } from "@/services/v1-api"
import { getErrorMessage } from "@/utils/errors"

const props = defineProps<{
  modelValue: boolean
  requestId: string
  /** "quote" starts an offer (Send quote); "counter" answers the latest card. */
  mode: "quote" | "counter"
  /** The card being answered, used to prefill the amount and date. */
  seed?: V1Counter | null
}>()
const emit = defineEmits<{ "update:modelValue": [value: boolean]; sent: [message: V1Message] }>()

const amount = ref("")
const date = ref("")
const note = ref("")
const submitted = ref(false)
const busy = ref(false)
const error = ref("")

const amountKobo = computed(() => nairaToKobo(amount.value))
const check = computed(() =>
  validateCounter({ amountKobo: amountKobo.value, date: date.value || null, note: note.value }),
)
const title = computed(() => (props.mode === "quote" ? "Send quote" : "Counter offer"))

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    amount.value = koboToNairaInput(props.seed?.amountKobo)
    date.value = props.seed?.date ?? ""
    note.value = ""
    submitted.value = false
    error.value = ""
  },
)

const close = () => emit("update:modelValue", false)

const send = async () => {
  submitted.value = true
  if (!check.value.valid || !amountKobo.value) return

  busy.value = true
  error.value = ""
  try {
    const message = await v1Api.sendMessage(props.requestId, {
      kind: "counter",
      text: "",
      attachments: [],
      counter: { amountKobo: amountKobo.value, date: date.value || null, note: note.value.trim() },
    })

    emit("sent", message)
    close()
  } catch (cause) {
    error.value = getErrorMessage(cause, "The offer could not be sent.")
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <VDialog :model-value="modelValue" max-width="480" persistent @update:model-value="emit('update:modelValue', $event)">
    <VCard>
      <VCardTitle class="pt-5 px-6">{{ title }}</VCardTitle>
      <VCardText class="px-6">
        <p class="text-body-2 text-medium-emphasis">
          {{
            mode === "quote"
              ? "This appears in the chat as an offer card. The customer can counter it."
              : "This replaces the latest offer. The other side can counter again."
          }}
        </p>
        <VAlert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">{{ error }}</VAlert>
        <VTextField
          v-model="amount"
          label="Amount"
          prefix="₦"
          inputmode="decimal"
          autofocus
          :error-messages="submitted ? check.errors.amount : undefined"
        />
        <VTextField
          v-model="date"
          label="Start date (optional)"
          type="date"
          :min="todayIso()"
          :error-messages="submitted ? check.errors.date : undefined"
        />
        <VTextarea
          v-model="note"
          label="Note (optional)"
          rows="2"
          auto-grow
          :counter="counterNoteMaxLength"
          :error-messages="submitted ? check.errors.note : undefined"
        />
      </VCardText>
      <VCardActions class="px-6 pb-5">
        <VSpacer />
        <VBtn variant="text" :disabled="busy" @click="close">Cancel</VBtn>
        <VBtn color="primary" :loading="busy" @click="send">
          {{ mode === "quote" ? "Send quote" : "Send counter" }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
