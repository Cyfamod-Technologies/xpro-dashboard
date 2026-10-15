export type FormRule = (value: unknown) => true | string

export const required =
  (label: string): FormRule =>
  value => {
    if (typeof value === "boolean") return value || `${label} is required.`

    return String(value ?? "").trim().length > 0 || `${label} is required.`
  }

export const validEmail: FormRule = value => {
  const email = String(value ?? "").trim()

  if (!email) return true

  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email) || "Enter a valid email address."
}

export const fullName: FormRule = value => {
  const name = String(value ?? "").trim()

  if (!name) return true

  return name.length >= 2 || "Full name must contain at least 2 characters."
}

export const strongPassword: FormRule = value => {
  const password = String(value ?? "")

  if (!password) return true

  return (
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password) ||
    "Use at least 8 characters with uppercase, lowercase, a number, and a symbol."
  )
}

export const matches =
  (getTarget: () => string, label: string): FormRule =>
  value =>
    String(value ?? "") === getTarget() || `${label} does not match.`

export const sixDigitCode: FormRule = value =>
  /^\d{6}$/.test(String(value ?? "")) || "Enter the 6-digit authentication code."

export const emailRules = [required("Email address"), validEmail]
export const passwordRules = [required("Password"), strongPassword]
