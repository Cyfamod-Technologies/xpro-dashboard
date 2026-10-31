/**
 * Live catalog names that replaced the names the static service content (covers, popular jobs, descriptions) is keyed
 * by. Demo mode still uses the old names, so lookups resolve a live name to its static name and pass anything else
 * through unchanged.
 */
const LIVE_TO_STATIC: Record<string, string> = {
  Hiring: "Hire",
  "Facility Management": "Facility management",
  "Waste Management": "Waste management",
}

export const staticServiceName = (name: string): string => LIVE_TO_STATIC[name] ?? name

/**
 * The names a service may be known by, the given one first: the live name, then its static name for a live name, or its
 * live name for a static one. Used to match old links and stored names against the renamed catalog roots.
 */
export const serviceNameCandidates = (name: string): string[] => {
  const live = Object.entries(LIVE_TO_STATIC).find(([, old]) => old.toLowerCase() === name.trim().toLowerCase())?.[0]

  return [name, ...(live ? [live] : [])]
}
