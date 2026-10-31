// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001F\u007F]/

/**
 * An in-app path that is safe to send someone to after sign-in or verification (spec 01 §6.5), or `null`. Only
 * relative paths are allowed, never another origin, and never back into the sign-in pages themselves.
 */
export const safeRedirectPath = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null
  if (value.includes("\\") || controlCharacters.test(value)) return null
  if (value.startsWith("/login") || value.startsWith("/auth/") || value.startsWith("/access-denied")) return null

  return value
}
