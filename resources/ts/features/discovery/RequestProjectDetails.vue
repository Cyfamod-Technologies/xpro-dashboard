<script setup lang="ts">
import type { RequestInput } from "@/features/operations/types"
import type { LocationView } from "@/features/requests/api-types"
import { contactMethods } from "@/features/discovery/request-bundle"
import { required, titleRules, validNigerianPhone } from "@/features/discovery/request-rules"

/**
 * The "Project details" card of the live request form: what every service in the submission shares
 * (title, site and contact). Files belong to each Service card, never to the project (MS-8).
 */
defineProps<{
  states: LocationView[]
  lgas: LocationView[]

  /** Only the areas of the chosen LGA that are served; the Area select shows when there are any. */
  areas: LocationView[]
}>()
const title = defineModel<string>("title", { required: true })
const stateId = defineModel<string>("stateId", { required: true })
const lgaId = defineModel<string>("lgaId", { required: true })
const areaId = defineModel<string>("areaId", { required: true })
const address = defineModel<string>("address", { required: true })
const phone = defineModel<string>("phone", { required: true })
const contactMethod = defineModel<RequestInput["contactMethod"]>("contactMethod")
</script>

<template>
  <VCard role="group" aria-labelledby="project-details-title">
    <VCardText class="pa-6 d-flex flex-column gap-5">
      <h2 id="project-details-title" class="text-h6">Project details</h2>
      <VTextField
        v-model="title"
        label="Request title *"
        placeholder="For example, office renovation in Lekki"
        :rules="titleRules"
      />
      <div class="field-grid">
        <VSelect
          v-model="stateId"
          :items="states.map(item => ({ title: item.name, value: item.id }))"
          label="State *"
          :rules="[required]"
        />
        <VSelect
          v-model="lgaId"
          :items="lgas.map(item => ({ title: item.name, value: item.id }))"
          label="LGA *"
          :disabled="!stateId"
          :rules="[required]"
        />
        <VSelect
          v-if="areas.length"
          v-model="areaId"
          :items="areas.map(item => ({ title: item.name, value: item.id }))"
          label="Area"
          clearable
        />
        <VTextField v-model="phone" label="Contact phone *" type="tel" :rules="[required, validNigerianPhone]" />
        <VSelect v-model="contactMethod" :items="contactMethods" label="Preferred contact method" />
        <VTextField
          v-model="address"
          label="Site address *"
          hint="Only shared with your provider once the schedule is confirmed."
          persistent-hint
          :rules="[required]"
          class="field-grid__wide"
        />
      </div>
    </VCardText>
  </VCard>
</template>

<style lang="scss" scoped src="./request-form-fields.scss" />
