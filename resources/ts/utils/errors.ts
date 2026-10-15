export const getErrorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { data?: { error?: { message?: string } }; message?: string }

    return candidate.data?.error?.message ?? candidate.message ?? fallback
  }

  return fallback
}
