import { serviceNameCandidates } from "@/features/discovery/service-aliases"

export type QuestionType =
  | "yes_no"
  | "single_choice"
  | "multiple_choice"
  | "short_text"
  | "long_text"
  | "number"
  | "date"

export type DateRole = "start" | "end"

export interface QuestionConfig {
  min?: number
  max?: number
  integer?: boolean
  exclusiveMinimum?: boolean
  minLength?: number
  maxLength?: number
}

export interface PublicOption {
  id: string
  label: string
}

export interface PublicQuestion {
  id: string
  key: string
  label: string
  helpText: string | null
  type: QuestionType
  required: boolean
  options: PublicOption[]
  config: QuestionConfig
  dateRole: DateRole | null
  sensitive: boolean
  matchesSkill: boolean
}

/** `GET /services`: only active nodes, questions and options, already sorted. */
export interface PublicServiceNode {
  id: string
  name: string
  description: string | null
  requiresStartDate: boolean
  questions: PublicQuestion[]
  children: PublicServiceNode[]
}

export interface AdminOption {
  id: string
  label: string
  active: boolean
}

export interface AdminQuestion {
  id: string
  serviceId: string
  key: string
  label: string
  helpText: string | null
  type: QuestionType
  required: boolean
  sortOrder: number
  active: boolean
  options: AdminOption[]
  config: QuestionConfig
  dateRole: DateRole | null
  sensitive: boolean
  matchesSkill: boolean
  version: number
}

export interface AdminServiceNode {
  id: string
  parentId: string | null

  /** 0 is a top-level service. */
  depth: number
  name: string
  description: string | null
  sortOrder: number
  active: boolean
  requiresStartDate: boolean
  version: number
  usage: { requests: number; providers: number }
  questions: AdminQuestion[]
  children: AdminServiceNode[]
}

export interface AdminCatalog {
  maxDepth: number
  services: AdminServiceNode[]
}

export interface ServiceInput {
  parentId?: string
  name: string
  description?: string
  requiresStartDate?: boolean
}

export interface ServicePatch {
  version: number
  name?: string
  description?: string
  active?: boolean
  requiresStartDate?: boolean
}

export interface QuestionInput {
  label: string
  helpText?: string
  type: QuestionType
  required?: boolean
  options?: Array<{ id?: string; label: string; active?: boolean }>
  config?: QuestionConfig
  dateRole?: DateRole | null
  sensitive?: boolean
}

export type QuestionPatch = Partial<QuestionInput> & { version: number }

export const questionTypeLabels: Record<QuestionType, string> = {
  yes_no: "Yes / No",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
}

export const isChoiceType = (type: QuestionType) => type === "single_choice" || type === "multiple_choice"

interface TreeNode<T> {
  id: string
  children: T[]
}

export const isLeaf = (node: { children: unknown[] }) => node.children.length === 0

export const findNode = <T extends TreeNode<T>>(nodes: T[], id: string): T | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node

    const found = findNode(node.children, id)

    if (found) return found
  }

  return undefined
}

/** The nodes from the top-level service down to `id`, or an empty array when `id` is not in the tree. */
export const pathTo = <T extends TreeNode<T>>(nodes: T[], id: string): T[] => {
  for (const node of nodes) {
    if (node.id === id) return [node]

    const rest = pathTo(node.children, id)

    if (rest.length) return [node, ...rest]
  }

  return []
}

/** The questions that apply along a path, ancestors first, each with the node it comes from. */
export const questionsAlongPath = <Q, N extends { questions: Q[] }>(path: N[]): Array<{ question: Q; from: N }> =>
  path.flatMap(node => node.questions.map(question => ({ question, from: node })))

interface SkillEntry {
  id: string
  name: string

  /** The leaf's name, followed by its parent's when that parent is not the top-level service ("Tiling · Floor Finishing"). */
  label: string
}

/** Ids of every leaf at or below `node`; a leaf is its own single id. */
export const leafIdsOf = <T extends TreeNode<T>>(node: T): string[] =>
  node.children.length ? node.children.flatMap(leafIdsOf) : [node.id]

/**
 * Ids to show while searching the service tree by name: the nodes whose name matches, their ancestors (so a match is
 * never orphaned) and everything below a match. Null for an empty search, meaning show everything.
 */
export const visibleNodeIds = (roots: PublicServiceNode[], query: string): Set<string> | null => {
  const needle = query.trim().toLowerCase()

  if (!needle) return null

  const ids = new Set<string>()
  const visit = (node: PublicServiceNode, trail: string[], parentHit: boolean) => {
    const hit = parentHit || node.name.toLowerCase().includes(needle)

    if (hit) {
      ids.add(node.id)
      for (const id of trail) ids.add(id)
    }
    for (const child of node.children) visit(child, [...trail, node.id], hit)
  }

  for (const root of roots) visit(root, [], false)

  return ids
}

/** The leaves a provider can pick under a top-level service: every leaf at depth 1 or deeper. Questions play no part. */
const skillEntriesForRoot = (root: PublicServiceNode): SkillEntry[] => {
  const entries: SkillEntry[] = []
  const visit = (node: PublicServiceNode, parent?: PublicServiceNode) => {
    if (node.children.length) {
      for (const child of node.children) visit(child, node)

      return
    }
    if (parent)
      entries.push({
        id: node.id,
        name: node.name,
        label: parent.id === root.id ? node.name : `${node.name} · ${parent.name}`,
      })
  }

  visit(root)

  return entries
}

/**
 * The skills a provider can list under a top-level service, as `{ id, label }`: the leaves of its sub-service tree,
 * exactly as the admin built it. A top-level service with no sub-services has none, and is selectable on its own.
 */
export const skillOptionsForRoot = (root: PublicServiceNode): { id: string; label: string }[] =>
  skillEntriesForRoot(root).map(({ id, label }) => ({ id, label }))

const matchName = <T>(items: T[], name: string, nameOf: (item: T) => string): T | undefined =>
  items.find(item => nameOf(item) === name) ??
  items.find(item => nameOf(item).trim().toLowerCase() === name.trim().toLowerCase())

// A root stored under its pre-rename name ("Hire") still finds the renamed root ("Hiring").
const matchRoot = (roots: PublicServiceNode[], name: string) => {
  for (const candidate of serviceNameCandidates(name)) {
    const found = matchName(roots, candidate, item => item.name)

    if (found) return found
  }

  return undefined
}

/**
 * Turns stored names into catalog ids: the client twin of the server's `idsFromNames`. Names are matched exactly, then
 * ignoring case and spacing. Names that match nothing are dropped. Only used to seed a profile that has no ids yet.
 */
export const catalogIdsFromNames = (
  roots: PublicServiceNode[],
  services: string[],
  skills: Partial<Record<string, string[]>>,
): { serviceIds: string[]; skillIds: Record<string, string[]> } => {
  const serviceIds: string[] = []
  const skillIds: Record<string, string[]> = {}

  for (const name of services) {
    const root = matchRoot(roots, name)

    if (root && !serviceIds.includes(root.id)) serviceIds.push(root.id)
  }
  for (const [rootName, names] of Object.entries(skills)) {
    const root = matchRoot(roots, rootName)

    if (!root) continue

    const entries = skillEntriesForRoot(root)
    const ids = (names ?? [])
      .map(name => (matchName(entries, name, entry => entry.name) ?? matchName(entries, name, entry => entry.label))?.id)
      .filter((id): id is string => Boolean(id))

    if (ids.length) skillIds[root.id] = [...new Set(ids)]
  }

  return { serviceIds, skillIds }
}
