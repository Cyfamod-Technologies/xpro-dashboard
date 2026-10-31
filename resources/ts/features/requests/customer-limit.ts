import type { CustomerRequestLimitView } from "@/features/requests/api-types"

/** Pure rules behind the staff "Customer's open-request limit" control (Spec 04 §11.2, MS-7). */

export const LIMIT_MIN = 1
export const LIMIT_MAX = 50
export const LIMIT_NOTE_MIN = 5
export const LIMIT_NOTE_MAX = 500

export const limitMessage = "Choose a limit from 1 to 50, or leave it empty to use the default."
export const limitNoteMessage = "Add a note explaining why this limit changes."

/** The permission that lets staff change the limit. */
export const SET_LIMIT_PERMISSION = "account.limit"

/** `null` means "use the platform default" and is always valid; otherwise a whole number from 1 to 50. */
export const limitError = (value: unknown, useDefault: boolean) => {
  if (useDefault) return ""

  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value

  return typeof number === "number" && Number.isInteger(number) && number >= LIMIT_MIN && number <= LIMIT_MAX
    ? ""
    : limitMessage
}

export const noteError = (note: string) => {
  const length = note.trim().length

  return length >= LIMIT_NOTE_MIN && length <= LIMIT_NOTE_MAX ? "" : limitNoteMessage
}

/** The body for `PUT /admin/customers/:userId/request-limit`, or null while the form is invalid. */
export const limitBody = (value: unknown, useDefault: boolean, note: string) =>
  limitError(value, useDefault) || noteError(note)
    ? null
    : { limit: useDefault ? null : Number(value), note: note.trim() }

/** `3 (platform default)` or `3`, for the staff request screen. */
export const limitLabel = (view: Pick<CustomerRequestLimitView, "override" | "effective">) =>
  view.override === null ? `${view.effective} (platform default)` : String(view.effective)
