export function normalizePhone(value: string): string | null {
  const national = value
    .trim()
    .replace(/[\s().-]/g, "")
    .replace(/^(?:\+234|234|0)/, "")

  return /^\d{10}$/.test(national) ? `+234${national}` : null
}
