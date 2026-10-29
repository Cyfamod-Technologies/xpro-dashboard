<script setup lang="ts">
import { useOperationsStore } from "@/stores/operations"
import { isDemoMode } from "@/utils/demo-mode"
import type { BankInput, ProviderInput, ServiceLine } from "@/features/operations/types"
import { serviceLines } from "@/features/workspace/config"
import { serviceSkills, when } from "@/features/operations/types"
import { prepareFiles } from "@/features/operations/files"
import { checkFiles, fileAccept, fileHint } from "@/features/operations/file-rules"
import { isNuban, maskAccount } from "@/features/operations/banks"
import { payoutReady, profileChangeRows } from "@/features/operations/workflow"
import { defaultWorkingHours, workingHoursProblem } from "@/features/operations/hours"
import { abujaDistricts } from "@/features/operations/dispatch"
import { nigeriaStates, stateForLocation } from "@/utils/nigeria-locations"
import AvailabilityPanel from "@/features/operations/AvailabilityPanel.vue"
import WorkingHoursEditor from "@/features/operations/WorkingHoursEditor.vue"
import Attachments from "@/features/operations/Attachments.vue"
import ProfileSection from "@/features/operations/ProfileSection.vue"
import FilePicker from "@/features/operations/FilePicker.vue"
import BankForm from "@/features/operations/BankForm.vue"
import { providersApi } from "@/services/providers-api"
import { useAuthStore } from "@/stores/auth"
import DraftBanner from "@/features/drafts/DraftBanner.vue"
import { hashString } from "@/features/drafts/draft-envelope"
import { useFormDraft } from "@/features/drafts/use-form-draft"
import { catalogApi } from "@/services/catalog-api"
import type { PublicServiceNode } from "@/features/catalog/types"
import { catalogIdsFromNames, skillOptionsForRoot } from "@/features/catalog/types"

const props = defineProps<{ availability?: boolean }>()
const ops = useOperationsStore()
const files = ref<File[]>([])
const portfolioFiles = ref<File[]>([])
const photoFile = ref<File[]>([])
const photoProblem = ref("")
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
// Live mode keeps what the provider offers as catalog ids (renames then change nothing); demo mode keeps names in `form`.
const ids = reactive({
  serviceIds: [...(proposed?.serviceIds ?? [])],
  skillIds: structuredClone(toRaw(proposed?.skillIds ?? {})) as Record<string, string[]>,
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
// Live mode offers the catalog's top-level services and their skills; demo mode keeps the static lists.
// A service is its name in demo mode and its id in live mode, and so is a skill.
const catalogRoots = ref<PublicServiceNode[]>([])
const serviceOptions = computed(() =>
  isDemoMode
    ? serviceLines.map(item => item.name)
    : catalogRoots.value.map(item => ({ title: item.name, value: item.id })),
)
const chosenServices = computed<string[]>({
  get: () => (isDemoMode ? form.services : ids.serviceIds),
  set: value => {
    if (isDemoMode) form.services = value as ServiceLine[]
    else ids.serviceIds = value
  },
})
const chosenSkills = () => (isDemoMode ? form.skills : ids.skillIds) as Partial<Record<string, string[]>>
const serviceName = (service: string) =>
  isDemoMode ? service : (catalogRoots.value.find(item => item.id === service)?.name ?? service)
const skillsFor = (service: string): { id: string; label: string }[] => {
  if (isDemoMode) return (serviceSkills[service as ServiceLine] ?? []).map(skill => ({ id: skill, label: skill }))

  const root = catalogRoots.value.find(item => item.id === service)

  return root ? skillOptionsForRoot(root) : []
}
// A top-level service with no sub-services has no skills to choose, so it cannot be missing one.
const missingSkills = computed(() =>
  chosenServices.value.filter(
    service => (isDemoMode || !catalogRoots.value.length || skillsFor(service).length) && !chosenSkills()[service]?.length,
  ),
)
const capacityProblem = computed(() =>
  Number.isInteger(form.capacity) && form.capacity >= 1 && form.capacity <= 20
    ? ""
    : "Enter a whole number from 1 to 20.",
)
const hoursProblem = computed(() => workingHoursProblem(form.workingHours))
const coverageReady = computed(
  () =>
    !areaProblem.value &&
    chosenServices.value.length > 0 &&
    !missingSkills.value.length &&
    !capacityProblem.value &&
    !hoursProblem.value,
)
const hasSkill = (service: string, skill: string) => chosenSkills()[service]?.includes(skill) ?? false

const selectState = (stateName: string | null) => {
  selectedState.value = stateName ?? ""
  if (!stateName || !cityOptions.value.some(city => city.toLowerCase() === form.city.trim().toLowerCase()))
    form.city = ""
}

// Autosaved draft: text fields in localStorage, queued files in IndexedDB. The bank account number is never kept.
interface ProfileDraft {
  phone: string
  trade: string
  city: string
  state: string
  services: string[]
  serviceAreas: string[]
  skills: ProviderInput["skills"]
  serviceIds: string[]
  skillIds: Record<string, string[]>
  capacity: number
  workingHours: ProviderInput["workingHours"]
  experience: number
  bio: string
  bankCode: string
}

const auth = useAuthStore()
const profileFingerprint = () => {
  const saved = ops.profile

  return hashString(JSON.stringify(saved ? [saved.verification, saved.history.length, saved.changesReview?.state] : null))
}
const resetBank = () => {
  const payout = ops.profile?.payout.pending ?? ops.profile?.payout.current

  changingBank.value = false
  form.bank = payout
    ? { bankCode: payout.bankCode, accountNumber: payout.accountNumber, accountName: payout.accountName }
    : { bankCode: "", accountNumber: "", accountName: "" }
}
const draft = useFormDraft<ProfileDraft>({
  formId: "provider-profile",
  version: 2,
  owner: () => auth.user?.id ?? "guest",
  snapshot: () => ({
    phone: form.phone,
    trade: form.trade,
    city: form.city,
    state: selectedState.value,
    services: form.services,
    serviceAreas: form.serviceAreas,
    skills: form.skills,
    serviceIds: ids.serviceIds,
    skillIds: ids.skillIds,
    capacity: form.capacity,
    workingHours: form.workingHours,
    experience: form.experience,
    bio: form.bio,
    bankCode: keepCurrent.value || awaitingBank.value ? "" : form.bank.bankCode,
  }),
  restore: data => {
    Object.assign(form, {
      phone: data.phone,
      trade: data.trade,
      city: data.city,
      services: [...data.services],
      serviceAreas: [...data.serviceAreas],
      skills: structuredClone(data.skills),
      capacity: data.capacity,
      workingHours: structuredClone(data.workingHours),
      experience: data.experience,
      bio: data.bio,
    })
    ids.serviceIds = [...data.serviceIds]
    ids.skillIds = structuredClone(data.skillIds)
    selectedState.value = data.state
    if (data.bankCode) {
      changingBank.value = Boolean(current.value)
      form.bank = { bankCode: data.bankCode, accountNumber: "", accountName: "" }
    }
  },
  files: { documents: files, portfolio: portfolioFiles, photo: photoFile },
  onFilesRestored: restored => {
    const photo = restored.photo?.[0]

    if (photo) form.photo = { id: "pending-upload", name: photo.name, size: photo.size, type: photo.type }
  },
  onDiscard: () => {
    resetBank()
    photoProblem.value = ""
    form.photo = ops.profile?.pendingChanges?.photo ?? ops.profile?.photo ?? null
  },
  base: profileFingerprint,
  // A profile waiting for review is locked, so there is nothing to draft.
  enabled: () => ops.profile?.verification !== "pending",
})

// Drops ids the catalog no longer offers (a deactivated service or skill), so a resubmit is not rejected.
const pruneIds = () => {
  if (!catalogRoots.value.length) return
  ids.serviceIds = ids.serviceIds.filter(id => catalogRoots.value.some(root => root.id === id))
  for (const [id, chosen] of Object.entries(ids.skillIds)) {
    const offered = skillsFor(id).map(skill => skill.id)

    ids.skillIds[id] = chosen.filter(skill => offered.includes(skill))
  }
}

onMounted(async () => {
  if (isDemoMode) {
    if (!props.availability) await draft.start()

    return
  }
  try {
    catalogRoots.value = await catalogApi.publicTree()
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "The service list could not be loaded."
  }
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
    // A profile that has not been backfilled has no ids yet; derive them from its names.
    const offered = saved.pendingChanges ?? saved
    const fromNames =
      offered.serviceIds && offered.skillIds
        ? null
        : catalogIdsFromNames(catalogRoots.value, offered.services, offered.skills)

    ids.serviceIds = [...(offered.serviceIds ?? fromNames?.serviceIds ?? [])]
    ids.skillIds = structuredClone(toRaw(offered.skillIds ?? fromNames?.skillIds ?? {}))
    selectedState.value = stateForLocation(saved.city)?.name ?? ""
    const payout = saved.payout.pending ?? saved.payout.current
    if (payout)
      form.bank = { bankCode: payout.bankCode, accountNumber: payout.accountNumber, accountName: payout.accountName }
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to load your provider profile."
  } finally {
    // The form now holds the saved profile, so a draft can be laid over it.
    pruneIds()
    if (!props.availability && (await draft.start())) pruneIds()
  }
})

const setSkill = (service: string, skill: string, on: boolean | null) => {
  const skills = chosenSkills()
  const rest = (skills[service] ?? []).filter(item => item !== skill)

  skills[service] = on ? [...rest, skill] : rest
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
      form.trade.trim() && form.city.trim() && form.phone.trim() && chosenServices.value.length && form.bio.trim(),
    ),
  },
  { label: "Service areas", done: !areaProblem.value },
  { label: "Skills", done: chosenServices.value.length > 0 && !missingSkills.value.length },
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

  photoProblem.value = ""
  if (!file) return

  const { problems } = checkFiles("provider_photo", [file])

  if (problems.length) {
    photoFile.value = []
    photoProblem.value = problems[0]

    return
  }
  try {
    if (isDemoMode) form.photo = (await prepareFiles([file]))[0]
    else {
      photoFile.value = [file]
      form.photo = { id: "pending-upload", name: file.name, size: file.size, type: file.type }
    }
  } catch (cause) {
    ops.error = cause instanceof Error ? cause.message : "Unable to read this photo."
  }
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
    const submitted = await ops.run({
      type: "provider.submit",
      input: {
        ...toRaw(form),
        skills: Object.fromEntries(form.services.map(service => [service, form.skills[service] ?? []])),
        ...(isDemoMode
          ? {}
          : {
              serviceIds: [...ids.serviceIds],
              skillIds: Object.fromEntries(ids.serviceIds.map(id => [id, ids.skillIds[id] ?? []])),
            }),
        serviceAreas: form.serviceAreas.map(area => area.trim()).filter(Boolean),
      },
    })
    if (!isDemoMode) await ops.refreshProviderProfile()
    if (submitted) {
      await draft.clear()
      // A profile now waiting for review is locked; an approved one can be edited again.
      if (ops.profile?.verification !== "pending") draft.resume()
    }
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
    <DraftBanner :draft="draft" />
    <ProfileSection
      title="Profile details"
      subtitle="Who you are and where you are based."
    >
      <VRow>
        <VCol cols="12" sm="6">
          <VTextField v-model="form.trade" label="Trade / business specialism" />
        </VCol>
        <VCol cols="12" sm="6">
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
            :hint="selectedState ? `Select an LGA or the state capital in ${selectedState}.` : 'Choose a state first.'"
            persistent-hint
          />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField v-model="form.phone" label="Private contact phone" />
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField v-model.number="form.experience" label="Years of experience" type="number" min="0" />
        </VCol>
        <VCol cols="12">
          <VTextarea
            v-model="form.bio"
            label="Public introduction"
            hint="Shown on your public profile after approval."
            persistent-hint
          />
        </VCol>
      </VRow>
    </ProfileSection>

    <ProfileSection
      title="Services & skills"
      subtitle="Choose at least one skill for each service you offer. XPro uses these to match you to the right jobs."
    >
      <VRow>
        <VCol cols="12">
          <VSelect
            v-model="chosenServices"
            :items="serviceOptions"
            label="Services offered"
            multiple
            chips
          />
        </VCol>
        <VCol v-if="chosenServices.length" cols="12">
          <fieldset v-for="service in chosenServices" :key="service" class="skills-group">
            <legend class="text-subtitle-1">
              {{ serviceName(service) }}
            </legend>
            <div class="skills-grid">
              <VCheckbox
                v-for="skill in skillsFor(service)"
                :key="skill.id"
                :model-value="hasSkill(service, skill.id)"
                :label="skill.label"
                density="compact"
                hide-details
                @update:model-value="setSkill(service, skill.id, $event)"
              />
            </div>
            <p v-if="missingSkills.includes(service)" class="text-body-2 text-error mt-1 mb-0" role="alert">
              Choose at least one {{ serviceName(service) }} skill.
            </p>
          </fieldset>
        </VCol>
      </VRow>
    </ProfileSection>

    <ProfileSection
      title="Coverage & capacity"
      subtitle="XPro assigns you jobs, so tell us which areas you cover and how many jobs you can run at once."
    >
      <VAlert v-if="approved" variant="tonal" color="info" density="comfortable" class="mb-4">
        Changes to your areas, skills and capacity are reviewed by XPro before they affect your offers.
      </VAlert>
      <VRow>
        <VCol cols="12">
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
          />
          <VBtn v-if="form.city.trim() && !coversCity" variant="text" size="small" class="mt-1" @click="addCity">
            Add {{ form.city.trim() }}
          </VBtn>
        </VCol>
        <VCol cols="12" sm="6">
          <VTextField
            v-model.number="form.capacity"
            label="Job capacity"
            type="number"
            min="1"
            max="20"
            hint="The most jobs you can have active at once (1 to 20)."
            persistent-hint
            :error-messages="capacityProblem"
          />
        </VCol>
      </VRow>
    </ProfileSection>

    <ProfileSection
      title="Weekly working hours"
      subtitle="Required. XPro only offers you jobs that start on a day you work. Hours apply as soon as you save."
    >
      <WorkingHoursEditor v-model="form.workingHours" />
    </ProfileSection>

    <ProfileSection
      title="Private verification documents"
      subtitle="Identity, qualification or business documents. Only XPro review staff can see these. Files upload when you submit your profile."
    >
      <FilePicker
        v-model:saved="form.documents"
        v-model:queued="files"
        purpose="provider_document"
        label="Add verification documents"
      />
    </ProfileSection>

    <ProfileSection
      title="Face photo"
      subtitle="Used by XPro staff to verify your identity. Not shown publicly. Your photo uploads when you submit your profile."
    >
      <VImg
        v-if="form.photo?.dataUrl"
        :src="form.photo.dataUrl"
        :alt="form.photo.name"
        max-width="160"
        max-height="160"
        rounded
        class="mb-3"
      />
      <Attachments v-else-if="form.photo" :files="[form.photo]" />
      <VFileInput
        v-model="photoFile"
        label="Upload a clear face photo"
        :accept="fileAccept('provider_photo')"
        :hint="fileHint('provider_photo')"
        persistent-hint
        :error-messages="photoProblem"
        @update:model-value="choosePhoto"
      />
    </ProfileSection>

    <ProfileSection
      title="Public portfolio"
      subtitle="These samples appear on your public profile after approval. Files upload when you submit your profile."
    >
      <FilePicker
        v-model:saved="form.portfolio"
        v-model:queued="portfolioFiles"
        purpose="provider_portfolio"
        label="Add public portfolio samples"
      />
    </ProfileSection>

    <ProfileSection
      title="Bank details"
      subtitle="XPro pays you into this account once Finance has verified it. The account name must match your business or personal name."
    >
      <template v-if="awaitingBank">
        <p class="mb-1">{{ awaitingBank.bankName }} · {{ maskAccount(awaitingBank.accountNumber) }}</p>
        <p class="text-body-2 text-medium-emphasis">
          {{ awaitingBank.accountName }}
        </p>
        <VAlert variant="tonal" color="warning">
          Your bank change is awaiting XPro review. Payouts are paused until XPro verifies your new bank details. You
          can change bank details again once it is reviewed.
        </VAlert>
      </template>
      <template v-else-if="keepCurrent">
        <p class="mb-1">{{ current!.bankName }} · {{ maskAccount(current!.accountNumber) }}</p>
        <p class="text-body-2 text-medium-emphasis">
          {{ current!.accountName }}
        </p>
        <VBtn variant="text" size="small" @click="useDifferentAccount"> Use a different account </VBtn>
      </template>
      <template v-else>
        <BankForm v-model="form.bank" :holder-name="ops.actor?.name ?? ''" />
        <VBtn v-if="current" variant="text" size="small" @click="keepAccount"> Keep my current account </VBtn>
      </template>
    </ProfileSection>

    <VAlert v-if="ops.profile?.verification === 'approved'" color="info" variant="tonal" class="mb-5">
      Changes to your phone, city, experience, bio, portfolio and weekly working hours apply straight away. Changes to
      your trade, services, service areas, skills, job capacity, verification documents or face photo are reviewed by
      XPro first. Your current details stay in use while they are reviewed.
    </VAlert>
    <VBtn
      class="mb-5"
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

    <VCard v-if="ops.profile?.history.length">
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
