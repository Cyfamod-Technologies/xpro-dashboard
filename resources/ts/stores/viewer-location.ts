import { defineStore } from "pinia"

import { DEFAULT_COUNTRY, DEFAULT_STATE } from "@/utils/constants"

export const useViewerLocationStore = defineStore("viewer-location", () => {
  const selectedCountry = ref(DEFAULT_COUNTRY)
  const selectedState = ref(DEFAULT_STATE)

  return { selectedCountry, selectedState }
})
