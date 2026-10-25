type ErrorRecord = Record<string, unknown>

function asRecord(value: unknown): ErrorRecord | undefined {
  return typeof value === "object" && value !== null ? value as ErrorRecord : undefined
}

function firstDetailMessage(details: unknown): string | undefined {
  if (!Array.isArray(details)) return typeof details === "string" ? details : undefined

  for (const detail of details) {
    if (typeof detail === "string") return detail

    const detailRecord = asRecord(detail)
    if (typeof detailRecord?.message === "string") return detailRecord.message

    const constraints = asRecord(detailRecord?.constraints)
    const constraintMessage = Object.values(constraints ?? {}).find(value => typeof value === "string")
    if (typeof constraintMessage === "string") return constraintMessage
  }

  return undefined
}

export const getErrorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  const candidate = asRecord(error)
  if (!candidate) return fallback

  const response = asRecord(candidate.response)
  const payload = asRecord(candidate.data) ?? asRecord(response?._data)
  const apiError = asRecord(payload?.error) ?? payload
  const detailMessage = firstDetailMessage(apiError?.details) ?? firstDetailMessage(candidate.details)

  return detailMessage
    ?? (typeof apiError?.message === "string" ? apiError.message : undefined)
    ?? (typeof candidate.message === "string" ? candidate.message : undefined)
    ?? fallback
}
