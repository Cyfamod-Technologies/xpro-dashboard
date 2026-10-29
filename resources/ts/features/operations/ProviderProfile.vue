<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import type { BankInput, ProviderInput, ServiceLine } from "@/features/operations/types"
import { serviceLines } from "@/features/workspace/config"
import { serviceSkills, when } from "@/features/operations/types"
import { prepareFiles } from "@/features/operations/files"
import { isNuban, maskAccount } from "@/features/operations/banks"
import { payoutReady, profileChangeRows } from "@/features/operations/workflow"
import { defaultWorkingHours, workingHoursProblem } from "@/features/operations/hours"
import { abujaDistricts } from "@/features/operations/dispatch"
import { nigeriaStates, stateForLocation } from "@/utils/nigeria-locations"
import AvailabilityPanel from "@/features/operations/AvailabilityPanel.vue"
import WorkingHoursEditor from "@/features/operations/WorkingHoursEditor.vue"
import Attachments from "@/features/operations/Attachments.vue"
import BankForm from "@/features/operations/BankForm.vue"
import { providersApi } from "@/services/providers-api"

const props = defineProps<{ availability?: boolean }>()
const ops = useOperationsStore()
const files = ref<File[]>([])
const documentPickerKey = ref(0)
const portfolioFiles = ref<File[]>([])
const photoFile = ref<File[]>([])
const profile = ops.profile
const known: BankInput | undefined = profile?.payout.pending ?? profile?.payout.current ?? undefined

// Changes already waiting for XPro review are shown (and resubmitted) as the form's proposed values.
const proposed = profile?.pendingChanges ?? profile
const selectedState = ref(stateForLocation(profile?.city ?? "")?.name ?? "")
const form = reactive<ProviderInput>({
  phone: profile?.phone ?? "",
  trade: proposed?.trade ?? "",
  city: profile?.city ?? "",
  services: [...(proposed?.services ?? [])],
  serviceAreas: [...(proposed?.serviceAreas ?? [])],
  skills: structuredClone(toRaw(proposed?.skills ?? {})),
  capacity: proposed?.capacity ?? 3,
  workingHours: structuredClone(toRaw(profile?.workingHours ?? defaultWorkingHours())),
  experience: profile?.experience ?? 0,
  bio: profile?.bio ?? "",
  documents: [...(proposed?.documents ?? [])],
  portfolio: [...(profile?.portfolio ?? [])],
  photo: proposed?.photo ?? null,
  bank: {
    bankCode: known?.bankCode ?? "",
    accountNumber: known?.accountNumber ?? "",
    accountName: known?.accountName ?? "",
  },
})
const current = computed(() => ops.profile?.payout.current ?? null)
const awaitingBank = computed(() =>
  ops.profile?.payout.review?.state === "pending" ? ops.profile.payout.pending : null,
)
const changingBank = ref(false)
const keepCurrent = computed(() => Boolean(current.value) && !changingBank.value && !awaitingBank.value)
const changeRows = computed(() => (ops.profile ? profileChangeRows(ops.profile) : []))
const changesAwaiting = computed(() => ops.profile?.pendingChanges && ops.profile.changesReview?.state === "pending")
const changesRejected = computed(() =>
  ops.profile?.changesReview?.state === "rejected" ? ops.profile.changesReview.note : "",
)
const approved = computed(() => ops.profile?.verification === "approved")
const stateOptions = nigeriaStates.map(state => state.name)
const cityOptions = computed(() => {
  const state = nigeriaStates.find(item => item.name === selectedState.value)

  if (state) return [...state.lgas, state.capital].filter((city, index, cities) => cities.indexOf(city) === index)

  // Preserve an existing city from older profiles until the provider selects a state.
  return form.city.trim() ? [form.city.trim()] : []
})
const areaSuggestions = computed(() => [...new Set([form.city.trim(), "Abuja", ...abujaDistricts].filter(Boolean))])
const coversCity = computed(() =>
  form.serviceAreas.some(area => area.trim().toLowerCase() === form.city.trim().toLowerCase()),
)
const areaProblem = computed(() =>
  !form.serviceAreas.length
    ? "Add at least one service area."
    : form.city.trim() && !coversCity.value
      ? `Include ${form.city.trim()} in your service areas.`
      : "",
)
const missingSkills = computed(() => form.services.filter(service => !form.skills[service]?.length))
const capacityProblem = computed(() =>
  Number.isInteger(form.capacity) && form.capacity >= 1 && form.capacity <= 20
    ? ""
    : "Enter a whole number from 1 to 20.",
)
const hoursProblem = computed(() => workingHoursProblem(form.workingHours))
const coverageReady = computed(
  () =>
    !areaProblem.value &&
    form.services.length > 0 &&
    !missingSkills.value.length &&
    !capacityProblem.value &&
    !hoursProblem.value,
)
const hasSkill = (service: ServiceLine, skill: string) => form.skills[service]?.includes(skill) ?? false

const selectState = (stateName: string | null) => {
  selectedState.value = stateName ?? ""
  if (!stateName || !cityOptions.value.some(city => city.toLowerCase() === form.city.trim().toLowerCase()))
    form.city = ""
}

onMounted(async () => {
  if (isDemoMode) return
  try {
    await ops.refreshProviderProfile()
    const saved = ops.profile
    if (!saved) return
    Object.assign(form, {
      phone: saved.phone,
      trade: saved.trade,
      city: saved.city,
      services: [...saved.services],
      serviceAreas: [...saved.serviceAreas],
      skills: structuredClone(toRaw(saved.skills)),
      capacity: saved.capacity,
      workingHours: structuredClone(toRaw(saved.workingHours)),
      experience: saved.experience,
      bio: saved.bio,
      documents: [...saved.documents],
      portfolio: [...saved.portfolio],
      photo: saved.photo,
    })
    selectedState.value = stateForLocation(saved.city)?.name ?? ""
    const payout = saved.payout.pending ?? saved.payout.current
    if (payout)
      form.bank = { bankCode: payout.bankCode, accountNumber: payout.accountNumber, accountName: payout.accountName }
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to load your provider profile."
  }
})

const setSkill = (service: ServiceLine, skill: string, on: boolean | null) => {
  const rest = (form.skills[service] ?? []).filter(item => item !== skill)

  form.skills[service] = on ? [...rest, skill] : rest
}

const addCity = () => {
  const city = form.city.trim()

  if (city && !coversCity.value) form.serviceAreas = [city, ...form.serviceAreas]
}

const bankReady = computed(
  () =>
    Boolean(awaitingBank.value) ||
    keepCurrent.value ||
    (Boolean(form.bank.bankCode) && isNuban(form.bank.accountNumber) && form.bank.accountName.trim().length >= 3),
)

const checklist = computed(() => [
  {
    label: "Profile details",
    done: Boolean(
      form.trade.trim() && form.city.trim() && form.phone.trim() && form.services.length && form.bio.trim(),
    ),
  },
  { label: "Service areas", done: !areaProblem.value },
  { label: "Skills", done: form.services.length > 0 && !missingSkills.value.length },
  { label: "Job capacity", done: !capacityProblem.value },
  { label: "Working hours", done: !hoursProblem.value },
  { label: "Documents", done: form.documents.length + files.value.length > 0 },
  { label: "Face photo", done: Boolean(form.photo) },
  { label: "Bank details", done: bankReady.value },
  { label: "Submitted", done: ["pending", "approved", "rejected"].includes(ops.profile?.verification ?? "") },
  { label: "Verified (identity)", done: ops.profile?.verification === "approved" },
  { label: "Bank verified", done: Boolean(ops.profile) && payoutReady(ops.profile!) },
])

const choosePhoto = async (value: File | File[] | null) => {
  const file = Array.isArray(value) ? value[0] : value

  if (!file) return
  try {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use a PNG, JPG or WebP photo.")
    if (isDemoMode) form.photo = (await prepareFiles([file]))[0]
    else {
      photoFile.value = [file]
      form.photo = { id: "pending-upload", name: file.name, size: file.size, type: file.type }
    }
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to read this photo."
  }
}

const addDocuments = (value: File | File[] | null) => {
  const selected = Array.isArray(value) ? value : value ? [value] : []

  files.value.push(...selected)
  documentPickerKey.value += 1
}

const useDifferentAccount = () => {
  changingBank.value = true
  form.bank = { bankCode: "", accountNumber: "", accountName: "" }
}

const keepAccount = () => {
  changingBank.value = false
  if (current.value)
    form.bank = {
      bankCode: current.value.bankCode,
      accountNumber: current.value.accountNumber,
      accountName: current.value.accountName,
    }
}

const submit = async () => {
  try {
    if (isDemoMode) {
      form.documents.push(...(await prepareFiles(files.value)))
      form.portfolio.push(...(await prepareFiles(portfolioFiles.value)))
    } else {
      form.documents.push(
        ...(await Promise.all(files.value.map(file => providersApi.upload(file, "provider_document")))),
      )
      form.portfolio.push(
        ...(await Promise.all(portfolioFiles.value.map(file => providersApi.upload(file, "provider_portfolio")))),
      )
    }
    files.value = []
    portfolioFiles.value = []
    if (photoFile.value[0]) {
      form.photo = isDemoMode
        ? (await prepareFiles([photoFile.value[0]]))[0]
        : await providersApi.upload(photoFile.value[0], "provider_photo")
      photoFile.value = []
    }
    await ops.run({
      type: "provider.submit",
      input: {
        ...toRaw(form),
        skills: Object.fromEntries(form.services.map(service => [service, form.skills[service] ?? []])),
        serviceAreas: form.serviceAreas.map(area => area.trim()).filter(Boolean),
      },
    })
    if (!isDemoMode) await ops.refreshProviderProfile()
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to read your documents."
  }
}
</script>

<template>
  <VAlert variant="tonal" :color="ops.profile?.verification === 'approved' ? 'success' : 'warning'" class="mb-5">
    Profile status: {{ ops.profile?.verification.replaceAll("_", " ") ?? "draft" }}. {{ ops.profile?.reviewNote }}
  </VAlert>
  <VAlert v-if="changesAwaiting" variant="tonal" color="warning" class="mb-5">
    <strong>Changes awaiting XPro review.</strong> Your current details stay in use until XPro approves them.
    <ul class="ps-5 mt-2">
      <li v-for="row in changeRows" :key="row.label">{{ row.label }}: {{ row.current }} → {{ row.proposed }}</li>
    </ul>
  </VAlert>
  <VAlert v-else-if="changesRejected" variant="tonal" color="error" class="mb-5">
    XPro did not approve your last profile changes: {{ changesRejected }}
  </VAlert>
  <VCard v-if="!props.availability" class="mb-5">
    <VCardText>
      <h2 class="text-h5 mb-4">Onboarding checklist</h2>
      <div class="d-flex flex-wrap gap-x-6 gap-y-2">
        <span v-for="item in checklist" :key="item.label" class="d-flex align-center gap-2">
          <VIcon
            :icon="item.done ? 'tabler-circle-check' : 'tabler-circle-dashed'"
            :color="item.done ? 'success' : undefined"
            :aria-label="item.done ? 'Done' : 'Pending'"
            role="img"
            size="20"
          />{{ item.label }}
        </span>
      </div>
    </VCardText>
  </VCard>
  <AvailabilityPanel v-if="props.availability" />
  <template v-else>
    <VCard class="mb-5">
      <VCardText>
        <h2 class="text-h5 mb-5">Your provider profile</h2>
        <VRow>
          <VCol cols="12" sm="6"> <VTextField v-model="form.trade" label="Trade / business specialism" /> </VCol
          ><VCol cols="12" sm="6">
            <VSelect
              :model-value="selectedState"
              :items="stateOptions"
              label="State"
              clearable
              @update:model-value="selectState"
            />
          </VCol>
          <VCol cols="12" sm="6">
            <VSelect
              v-model="form.city"
              :items="cityOptions"
              label="City / LGA"
              :disabled="!selectedState"
              :hint="
                selectedState ? `Select an LGA or the state capital in ${selectedState}.` : 'Choose a state first.'
              "
              persistent-hint
            /> </VCol
          ><VCol cols="12" sm="6"> <VTextField v-model="form.phone" label="Private contact phone" /> </VCol
          ><VCol cols="12" sm="6">
            <VTextField v-model.number="form.experience" label="Years of experience" type="number" min="0" /> </VCol
          ><VCol cols="12">
            <VSelect
              v-model="form.services"
              :items="serviceLines.map(item => item.name)"
              label="Services offered"
              multiple
              chips
            /> </VCol
          ><VCol cols="12">
            <h3 class="text-h6 mb-1">Where you work</h3>
            <p class="text-body-2 text-medium-emphasis">
              XPro assigns you jobs, so tell us which areas you cover, what you are skilled at and how many jobs you can
              run at once.<template v-if="approved">
                Changes to your areas, skills and capacity are reviewed by XPro before they affect your offers.
              </template>
            </p>
            <VCombobox
              v-model="form.serviceAreas"
              :items="areaSuggestions"
              label="Service areas"
              hint="Pick from the list, or type an area and press Enter."
              persistent-hint
              multiple
              chips
              closable-chips
              :error-messages="areaProblem"
            /><VBtn v-if="form.city.trim() && !coversCity" variant="text" size="small" class="mt-1" @click="addCity">
              Add {{ form.city.trim() }}
            </VBtn> </VCol
          ><VCol v-if="form.services.length" cols="12">
            <h3 class="text-h6 mb-1">Skills</h3>
            <p class="text-body-2 text-medium-emphasis">
              Choose at least one skill for each service you offer. XPro uses these to match you to the right jobs.
            </p>
            <fieldset v-for="service in form.services" :key="service" class="skills-group">
              <legend class="text-subtitle-1">
                {{ service }}
              </legend>
              <div class="skills-grid">
                <VCheckbox
                  v-for="skill in serviceSkills[service]"
                  :key="skill"
                  :model-value="hasSkill(service, skill)"
                  :label="skill"
                  density="compact"
                  hide-details
                  @update:model-value="setSkill(service, skill, $event)"
                />
              </div>
              <p v-if="missingSkills.includes(service)" class="text-body-2 text-error mt-1 mb-0" role="alert">
                Choose at least one {{ service }} skill.
              </p>
            </fieldset> </VCol
          ><VCol cols="12" sm="6">
            <VTextField
              v-model.number="form.capacity"
              label="Job capacity"
              type="number"
              min="1"
              max="20"
              hint="The most jobs you can have active at once (1 to 20)."
              persistent-hint
              :error-messages="capacityProblem"
            /> </VCol
          ><VCol cols="12">
            <h3 class="text-h6 mb-1">Weekly working hours</h3>
            <p class="text-body-2 text-medium-emphasis">
              Required. XPro only offers you jobs that start on a day you work. Hours apply as soon as you save.
            </p>
            <WorkingHoursEditor v-model="form.workingHours" /> </VCol
          ><VCol cols="12"> <VTextarea v-model="form.bio" label="Public introduction" /> </VCol
          ><VCol cols="12">
            <h3 class="text-h6 mb-3">Private verification documents</h3>
            <p class="text-body-2 text-medium-emphasis">
              Identity, qualification or business documents are visible to XPro review staff.
            </p>
            <div v-for="file in form.documents" :key="file.id" class="d-flex align-center gap-2">
              <Attachments :files="[file]" class="flex-grow-1" />
              <VBtn
                icon="tabler-x"
                variant="text"
                size="small"
                :aria-label="`Remove ${file.name}`"
                @click="form.documents = form.documents.filter(document => document.id !== file.id)"
              />
            </div>
            <div v-for="(file, index) in files" :key="`${file.name}-${file.size}-${index}`" class="d-flex align-center gap-2 my-3">
              <span class="flex-grow-1 text-body-2">{{ file.name }} · {{ Math.ceil(file.size / 1024) }} KB (ready to upload)</span>
              <VBtn
                icon="tabler-x"
                variant="text"
                size="small"
                :aria-label="`Remove ${file.name}`"
                @click="files.splice(index, 1)"
              />
            </div>
            <VFileInput
              :key="documentPickerKey"
              multiple
              label="Add verification documents"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              hint="Select several files at once, or add more in separate picks."
              persistent-hint
              @update:model-value="addDocuments"
            /> </VCol
          ><VCol cols="12">
            <h3 class="text-h6 mb-3">Face photo</h3>
            <p class="text-body-2 text-medium-emphasis">
              Used by XPro staff to verify your identity. Not shown publicly.
            </p>
            <VImg
              v-if="form.photo?.dataUrl"
              :src="form.photo.dataUrl"
              :alt="form.photo.name"
              max-width="160"
              max-height="160"
              rounded
              class="my-3"
            /><Attachments v-else-if="form.photo" :files="[form.photo]" /><VFileInput
              v-model="photoFile"
              label="Upload a clear face photo"
              accept="image/png,image/jpeg,image/webp"
              @update:model-value="choosePhoto"
            /> </VCol
          ><VCol cols="12">
            <h3 class="text-h6 mb-3">Public portfolio</h3>
            <p class="text-body-2 text-medium-emphasis">These samples appear on your public profile after approval.</p>
            <Attachments :files="form.portfolio" /><VBtn
              v-if="form.portfolio.length"
              variant="text"
              size="small"
              @click="form.portfolio = []"
            >
              Remove existing portfolio </VBtn
            ><VFileInput
              v-model="portfolioFiles"
              multiple
              label="Add public portfolio samples"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
            />
          </VCol> </VRow
        ><VCard variant="outlined" class="mb-5">
          <VCardText>
            <h3 class="text-h6 mb-1">Bank details</h3>
            <p class="text-body-2 text-medium-emphasis">
              XPro pays you into this account once Finance has verified it. The account name must match your business or
              personal name.
            </p>
            <template v-if="awaitingBank">
              <p class="mb-1">{{ awaitingBank.bankName }} · {{ maskAccount(awaitingBank.accountNumber) }}</p>
              <p class="text-body-2 text-medium-emphasis">
                {{ awaitingBank.accountName }}
              </p>
              <VAlert variant="tonal" color="warning">
                Your bank change is awaiting XPro review. Payouts are paused until XPro verifies your new bank details.
                You can change bank details again once it is reviewed.
              </VAlert> </template
            ><template v-else-if="keepCurrent">
              <p class="mb-1">{{ current!.bankName }} · {{ maskAccount(current!.accountNumber) }}</p>
              <p class="text-body-2 text-medium-emphasis">
                {{ current!.accountName }}
              </p>
              <VBtn variant="text" size="small" @click="useDifferentAccount"> Use a different account </VBtn> </template
            ><template v-else>
              <BankForm v-model="form.bank" :holder-name="ops.actor?.name ?? ''" /><VBtn
                v-if="current"
                variant="text"
                size="small"
                @click="keepAccount"
              >
                Keep my current account
              </VBtn>
            </template>
          </VCardText> </VCard
        ><VAlert v-if="ops.profile?.verification === 'approved'" color="info" variant="tonal" class="mb-4">
          Changes to your phone, city, experience, bio, portfolio and weekly working hours apply straight away. Changes
          to your trade, services, service areas, skills, job capacity, verification documents or face photo are
          reviewed by XPro first. Your current details stay in use while they are reviewed. </VAlert
        ><VBtn
          :disabled="ops.profile?.verification === 'pending' || !bankReady || !coverageReady"
          :loading="ops.busy"
          @click="submit"
        >
          {{
            ops.profile?.verification === "pending"
              ? "Awaiting XPro review"
              : ops.profile?.verification === "approved"
                ? "Save profile changes"
                : "Submit profile for review"
          }}
        </VBtn>
      </VCardText> </VCard
    ><VCard v-if="ops.profile?.history.length">
      <VCardText>
        <h2 class="text-h5 mb-4">Review history</h2>
        <p v-for="(entry, index) in ops.profile.history" :key="index">
          {{ entry.status.replaceAll("_", " ") }} · {{ entry.note }}<br /><small class="text-medium-emphasis">{{
            when(entry.createdAt)
          }}</small>
        </p>
      </VCardText>
    </VCard>
  </template>
</template>

<style scoped>
.skills-group {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 0.5rem 1rem 0.75rem;
  margin-block-end: 0.75rem;
}
.skills-group legend {
  padding-inline: 0.5rem;
}
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  column-gap: 1rem;
}
</style>
