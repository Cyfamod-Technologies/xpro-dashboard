<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import type { ServiceRequest } from "@/features/operations/types"
import { lineTotal, money, when } from "@/features/operations/types"
import { currentAssignment, providerQuoteView } from "@/features/operations/workflow"

// The form is typed in naira; every stored amount is kobo, so convert once on the way in and out.
interface FormItem {
  description: string
  quantity: number
  rate: number
}

const props = defineProps<{ request: ServiceRequest }>()
const blankItem = (): FormItem => ({ description: "", quantity: 1, rate: 0 })
const toKobo = (naira: number) => Math.round(Number(naira) * 100)

const ops = useOperationsStore()
const items = ref<FormItem[]>([blankItem()])
const note = ref("")
const quoteId = ref<string>()
const editing = ref(false)
const isProvider = computed(() => ops.actor?.role === "provider")
const quotes = computed(() =>
  isProvider.value ? [] : props.request.quotes.filter(item => ops.actor?.role === "admin" || item.status !== "draft"),
)
const scope = computed(() => (isProvider.value ? providerQuoteView(props.request) : null))
const costings = computed(() =>
  ops.actor?.role === "customer"
    ? []
    : props.request.contributions.filter(item => ops.actor?.role === "admin" || item.providerId === ops.actor?.id),
)
const kobo = computed(() =>
  items.value.map(item => ({
    description: item.description,
    quantity: Number(item.quantity),
    rate: toKobo(item.rate),
  })),
)
const total = computed(() => kobo.value.reduce((sum, item) => sum + lineTotal(item), 0))
const pricingOpen = computed(
  () =>
    !["in_progress", "blocked", "completion_pending", "acknowledged", "closed", "cancelled", "rejected"].includes(
      props.request.status,
    ),
)

const edit = (id?: string) => {
  const quote = props.request.quotes.find(item => item.id === id)

  quoteId.value = quote?.status === "draft" ? quote.id : undefined
  items.value = quote ? quote.items.map(item => ({ ...item, rate: item.rate / 100 })) : [blankItem()]
  note.value = quote?.note ?? ""
  editing.value = true
}

const save = async () => {
  const command = isProvider.value
    ? { type: "quote.contribute" as const, requestId: props.request.id, items: kobo.value, note: note.value }
    : {
        type: "quote.save" as const,
        requestId: props.request.id,
        quoteId: quoteId.value,
        items: kobo.value,
        note: note.value,
      }
  if (await ops.run(command)) editing.value = false
}
</script>

<template>
  <VAlert variant="tonal" color="info" class="mb-5">
    {{
      isProvider
        ? "XPro prepares the customer quote. You see the scope agreed with the customer, never the customer price. Your own costing is visible only to you and XPro."
        : "XPro prepares and publishes the customer quote. Published versions retain their original line items. Provider costing is visible only to the provider and XPro."
    }}
  </VAlert>
  <VBtn
    v-if="
      pricingOpen &&
      (ops.can('quote.manage') || (ops.actor?.role === 'provider' && currentAssignment(request)?.status === 'accepted'))
    "
    class="mb-5"
    @click="edit"
  >
    {{ ops.actor?.role === "admin" ? "Create quote version" : "Submit costing" }}
  </VBtn>
  <VCard v-if="editing" class="mb-5">
    <VCardText>
      <h3 class="text-h5 mb-4">
        {{ ops.actor?.role === "provider" ? "Provider costing" : quoteId ? "Edit draft" : "New quote version" }}
      </h3>
      <VRow v-for="(item, index) in items" :key="index">
        <VCol cols="12" md="5">
          <VTextField v-model="item.description" :label="`Item ${index + 1} description`" /> </VCol
        ><VCol cols="5" md="2">
          <VTextField v-model.number="item.quantity" label="Quantity" type="number" min="0.01" /> </VCol
        ><VCol cols="5" md="4">
          <VTextField v-model.number="item.rate" label="Unit price (₦)" type="number" min="1" /> </VCol
        ><VCol cols="2" md="1">
          <VBtn icon="tabler-x" aria-label="Remove line item" variant="text" @click="items.splice(index, 1)" />
        </VCol> </VRow
      ><VBtn variant="text" prepend-icon="tabler-plus" @click="items.push(blankItem())"> Add line item </VBtn
      ><VTextarea v-model="note" label="Scope / inclusions / exclusions" rows="2" class="mt-4" />
      <p class="text-h6">Total: {{ Number.isFinite(total) ? money(total) : "—" }}</p>
      <div class="d-flex gap-3">
        <VBtn :loading="ops.busy" @click="save"> Save {{ ops.actor?.role === "provider" ? "costing" : "draft" }} </VBtn
        ><VBtn variant="text" @click="editing = false"> Cancel </VBtn>
      </div>
    </VCardText>
  </VCard>
  <VCard v-for="quote in [...quotes].reverse()" :key="quote.id" class="mb-5">
    <VCardText>
      <div class="d-flex justify-space-between flex-wrap gap-2 mb-4">
        <h3 class="text-h5">Quote · version {{ quote.version }}</h3>
        <VChip variant="tonal" color="primary">
          {{ quote.status.replaceAll("_", " ") }}
        </VChip>
      </div>
      <div v-for="(item, index) in quote.items" :key="index" class="d-flex justify-space-between flex-wrap gap-2 py-2">
        <span>{{ item.description }} · {{ item.quantity }} × {{ money(item.rate) }}</span
        ><strong>{{ money(lineTotal(item)) }}</strong>
      </div>
      <VDivider class="my-3" />
      <p class="text-h5">
        {{ money(quote.total) }}
      </p>
      <p>{{ quote.note }}</p>
      <p v-if="quote.responseNote" class="text-body-2">Customer response: {{ quote.responseNote }}</p>
      <small class="text-medium-emphasis">Created {{ when(quote.createdAt) }}</small>
      <p v-if="ops.actor?.role === 'admin' && quote.publishedBy" class="text-body-2 mt-2 mb-0">
        Published by {{ ops.staffById(quote.publishedBy)?.name ?? "Former staff member" }}
      </p>
      <p
        v-if="ops.actor?.role === 'admin' && quote.status === 'draft' && quote.approvalRequestedBy"
        class="text-body-2 text-warning mt-2 mb-0"
      >
        Awaiting super admin approval (requested by
        {{ ops.staffById(quote.approvalRequestedBy)?.name ?? "Former staff member" }})
      </p>
      <div
        v-if="ops.actor?.role === 'admin' && quote.status === 'draft' && pricingOpen"
        class="d-flex flex-wrap gap-3 mt-4"
      >
        <VBtn v-if="ops.can('quote.manage')" variant="outlined" @click="edit(quote.id)"> Edit draft </VBtn
        ><VBtn
          v-if="ops.can('quote.manage') && (!quote.approvalRequestedBy || ops.can('quote.approve'))"
          :loading="ops.busy"
          @click="ops.run({ type: 'quote.publish', requestId: request.id, quoteId: quote.id })"
        >
          Publish to customer
        </VBtn>
      </div>
      <div v-if="ops.actor?.role === 'customer' && quote.status === 'sent' && pricingOpen" class="mt-4">
        <VTextarea v-model="note" label="Response / requested changes" rows="2" />
        <div class="d-flex flex-wrap gap-2">
          <VBtn
            :disabled="ops.busy"
            @click="
              ops.run({ type: 'quote.respond', requestId: request.id, quoteId: quote.id, decision: 'accepted', note })
            "
          >
            Accept quote </VBtn
          ><VBtn
            variant="outlined"
            :disabled="ops.busy"
            @click="
              ops.run({
                type: 'quote.respond',
                requestId: request.id,
                quoteId: quote.id,
                decision: 'revision_requested',
                note,
              })
            "
          >
            Request revision </VBtn
          ><VBtn
            color="error"
            variant="text"
            :disabled="ops.busy"
            @click="
              ops.run({ type: 'quote.respond', requestId: request.id, quoteId: quote.id, decision: 'declined', note })
            "
          >
            Decline quote
          </VBtn>
        </div>
      </div>
    </VCardText>
  </VCard>
  <VCard v-if="scope" class="mb-5">
    <VCardText>
      <div class="d-flex justify-space-between flex-wrap gap-2 mb-4">
        <h3 class="text-h5">Scope agreed with the customer</h3>
        <VChip variant="tonal" color="primary">
          {{ scope.status === "accepted" ? "accepted" : "awaiting customer decision" }}
        </VChip>
      </div>
      <div v-for="(line, index) in scope.lines" :key="index" class="d-flex justify-space-between flex-wrap gap-2 py-2">
        <span>{{ line.description }}</span
        ><strong>Qty {{ line.quantity }}</strong>
      </div>
    </VCardText>
  </VCard>
  <p v-if="isProvider ? !scope : !quotes.length" class="text-medium-emphasis">
    {{
      isProvider
        ? "The agreed scope appears here once XPro has sent the customer quote."
        : "No customer quote has been published for this request yet."
    }}
  </p>
  <VCard v-if="costings.length">
    <VCardText>
      <h3 class="text-h5 mb-4">Private provider costing</h3>
      <div v-for="costing in costings" :key="costing.id" class="mb-4">
        <strong>{{ money(costing.total) }}</strong>
        <p>{{ costing.note }}</p>
        <div v-for="(item, index) in costing.items" :key="index" class="text-body-2">
          {{ item.description }} · {{ item.quantity }} × {{ money(item.rate) }}
        </div>
      </div>
    </VCardText>
  </VCard>
</template>
