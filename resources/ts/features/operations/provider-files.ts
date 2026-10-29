export type ProviderFilePurpose = "provider_document" | "provider_portfolio" | "provider_photo"

interface ProviderFileRule {
  /** Human readable list, e.g. "PDF, PNG, JPG, WebP, DOC or DOCX". */
  formats: string
  extensions: readonly string[]
  types: readonly string[]
  maxSize: number
  maxFiles: number
}

const MB = 1024 * 1024
const images = ["image/png", "image/jpeg", "image/webp"]

// Mirrors the xpro-server upload rules (`src/storage/file-validation.ts`); the server still has the final say.
export const providerFileRules: Record<ProviderFilePurpose, ProviderFileRule> = {
  provider_document: {
    formats: "PDF, PNG, JPG, WebP, DOC or DOCX",
    extensions: ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx"],
    types: [
      "application/pdf",
      ...images,
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    maxSize: 20 * MB,
    maxFiles: 10,
  },
  provider_portfolio: {
    formats: "PDF, PNG, JPG or WebP",
    extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
    types: ["application/pdf", ...images],
    maxSize: 20 * MB,
    maxFiles: 10,
  },
  provider_photo: {
    formats: "PNG, JPG or WebP",
    extensions: ["png", "jpg", "jpeg", "webp"],
    types: images,
    maxSize: 5 * MB,
    maxFiles: 1,
  },
}

export const providerFileAccept = (purpose: ProviderFilePurpose) =>
  [
    ...providerFileRules[purpose].extensions.map(extension => `.${extension}`),
    ...providerFileRules[purpose].types,
  ].join(",")

export const providerFileHint = (purpose: ProviderFilePurpose) => {
  const rule = providerFileRules[purpose]

  return `${rule.formats}. Up to ${rule.maxSize / MB} MB each${rule.maxFiles > 1 ? `, ${rule.maxFiles} files at most` : ""}.`
}

export const formatFileSize = (size: number) =>
  size >= MB ? `${(size / MB).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

export interface ProviderFileCheck {
  accepted: File[]
  problems: string[]
}

/**
 * Validates freshly picked files for a provider upload purpose.
 * `queued` are files already waiting to upload and `saved` is how many files the provider already has on record.
 */
export function checkProviderFiles(
  purpose: ProviderFilePurpose,
  picked: File[],
  queued: File[] = [],
  saved = 0,
): ProviderFileCheck {
  const rule = providerFileRules[purpose]
  const accepted: File[] = []
  const problems: string[] = []
  let overLimit = false

  for (const file of picked) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? ""

    if (!rule.extensions.includes(extension) || !rule.types.includes(file.type))
      problems.push(`${file.name}: use ${rule.formats} files.`)
    else if (file.size <= 0) problems.push(`${file.name}: this file is empty.`)
    else if (file.size > rule.maxSize) problems.push(`${file.name}: larger than ${rule.maxSize / MB} MB.`)
    else if ([...queued, ...accepted].some(existing => sameFile(existing, file)))
      problems.push(`${file.name}: already added.`)
    else if (saved + queued.length + accepted.length >= rule.maxFiles) overLimit = true
    else accepted.push(file)
  }
  if (overLimit) problems.push(`You can have at most ${rule.maxFiles} files here. Remove one to add another.`)

  return { accepted, problems }
}
