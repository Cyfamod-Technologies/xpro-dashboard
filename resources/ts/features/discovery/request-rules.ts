import type { PublicQuestion } from "@/features/catalog/types"

export type Rule = (value: unknown) => boolean | string

export const required: Rule = value => Boolean(String(value ?? "").trim()) || "This field is required."

export const dateRange: Rule = value => {
  if (!value) return true
  const selected = Date.parse(`${String(value).slice(0, 10)}T00:00:00+01:00`)
  const watDay = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const earliest = Date.parse(`${watDay}T00:00:00+01:00`)
  const latest = earliest + 365 * 24 * 60 * 60 * 1000

  return (selected >= earliest && selected <= latest) || "Choose a date from today through the next 12 months."
}

export const validNigerianPhone: Rule = value => {
  const normalized = String(value ?? "").replace(/[\s()-]/g, "")

  return /^(?:\+234|234|0)?[789][01]\d{8}$/.test(normalized) || "Enter a valid Nigerian phone number."
}

export const titleRules: Rule[] = [
  required,
  value => (String(value).trim().length >= 3 && String(value).length <= 120) || "Use 3 to 120 characters.",
]

export const briefRules: Rule[] = [
  required,
  value => String(value).trim().length >= 20 || "Add at least 20 characters.",
]

/**
 * Rules for one catalogue question. `startDates` returns the dates an "end" date must not precede:
 * the card's preferred start date and the answers to any "start" date questions on its path.
 */
export const questionRules = (question: PublicQuestion, startDates: () => string[]) => {
  const rules: Rule[] = []
  const config = question.config

  if (question.required)
    rules.push(
      question.type === "multiple_choice"
        ? value => (Array.isArray(value) && value.length > 0) || "Choose at least one option."
        : required,
    )
  if (question.type === "number")
    rules.push(value => {
      if (value === null || value === undefined || value === "") return true

      const number = Number(value)

      if (!Number.isFinite(number)) return `${question.label} must be a number.`
      if (config.integer && !Number.isInteger(number)) return `${question.label} must be a whole number.`
      if (config.min !== undefined && (config.exclusiveMinimum ? number <= config.min : number < config.min))
        return config.exclusiveMinimum
          ? `${question.label} must be more than ${config.min}.`
          : `${question.label} must be at least ${config.min}.`
      if (config.max !== undefined && number > config.max) return `${question.label} must be at most ${config.max}.`

      return true
    })
  if (question.type === "short_text" || question.type === "long_text")
    rules.push(value => {
      const length = String(value ?? "").trim().length

      if (!length) return true
      if (config.minLength !== undefined && length < config.minLength)
        return `Use at least ${config.minLength} characters.`
      if (config.maxLength !== undefined && length > config.maxLength)
        return `Use at most ${config.maxLength} characters.`

      return true
    })
  if (question.type === "date") {
    rules.push(dateRange)
    if (question.dateRole === "end")
      rules.push(value => {
        const starts = startDates().filter(Boolean)

        return !value || starts.every(start => String(value) >= start) || "The end date cannot be before the start date."
      })
  }

  return rules
}
