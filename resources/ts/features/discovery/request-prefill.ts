import type { PublicQuestion, PublicServiceNode } from "@/features/catalog/types"
import type { AnswerValue, Answers } from "@/features/discovery/request-bundle"
import { pathFor, questionsFor } from "@/features/discovery/request-bundle"
import { serviceNameCandidates } from "@/features/discovery/service-aliases"

// The first valid value for a query-string prefill, or undefined when the value does not fit the question.
const prefillValue = (question: PublicQuestion, raw: string): AnswerValue => {
  const match = (value: string) =>
    question.options.find(option => option.id === value || option.label.toLowerCase() === value.toLowerCase())?.id

  switch (question.type) {
    case "yes_no":
      return /^(?:yes|no)$/i.test(raw) ? (raw.toLowerCase() === "yes" ? "Yes" : "No") : undefined
    case "single_choice":
      return match(raw)
    case "multiple_choice": {
      const ids = raw.split(",").map(item => match(item.trim()))

      return ids.length && ids.every(Boolean) ? (ids as string[]) : undefined
    }
    case "number":
      return raw !== "" && Number.isFinite(Number(raw)) ? raw : undefined
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
    default:
      return raw.length <= (question.config.maxLength ?? 2000) ? raw : undefined
  }
}

const reserved = ["service", "title", "city", "start"]

/**
 * `?service=<top-level name>` picks the service. Other query values pick a sub-service by name, or fill a question
 * by its key, so the links from older popular-job cards keep working. Returns the picked path and answers for the
 * first Service card, or null when the query names no known service.
 */
export function queryPrefill(
  tree: PublicServiceNode[],
  query: Record<string, unknown>,
): { selectedIds: string[]; answers: Answers } | null {
  const service = typeof query.service === "string" ? query.service.trim() : ""
  const root = serviceNameCandidates(service)
    .map(name => tree.find(item => item.name.toLowerCase() === name.toLowerCase()))
    .find(Boolean)

  if (!root) return null

  const extras = Object.entries(query)
    .filter(([key]) => !reserved.includes(key))
    .flatMap(([key, value]) => (typeof value === "string" && value.trim() ? [[key, value.trim()] as const] : []))
  const path = [root]

  for (let node = root; node.children.length; ) {
    const child = node.children.find(item => extras.some(([, value]) => item.name.toLowerCase() === value.toLowerCase()))

    if (!child) break
    path.push(child)
    node = child
  }

  const selectedIds = path.map(node => node.id)
  const answers: Answers = {}

  for (const question of questionsFor(pathFor(tree, selectedIds))) {
    const raw = extras.find(([key]) => key === question.key)?.[1]
    const value = raw === undefined ? undefined : prefillValue(question, raw)

    if (value !== undefined) answers[question.id] = value
  }

  return { selectedIds, answers }
}
