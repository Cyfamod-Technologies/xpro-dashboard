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
  matchesSkill?: boolean
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
  label: string

  /** The node that owns the skill question, or the leaf's parent for a leaf skill. Used to tell equal labels apart. */
  context: string
}

const skillEntriesForRoot = (root: PublicServiceNode): SkillEntry[] => {
  const entries: SkillEntry[] = []
  const visit = (node: PublicServiceNode, depth: number, parent?: PublicServiceNode, inherited?: { question: PublicQuestion; owner: PublicServiceNode }) => {
    const own = node.questions.find(question => question.matchesSkill)
    const skillQuestion = inherited ?? (own ? { question: own, owner: node } : undefined)

    if (isLeaf(node)) {
      if (skillQuestion)
        entries.push(
          ...skillQuestion.question.options.map(option => ({
            id: option.id,
            label: option.label,
            context: skillQuestion.owner.name,
          })),
        )
      else if (depth > 0) entries.push({ id: node.id, label: node.name, context: parent?.name ?? "" })

      return
    }
    for (const child of node.children) visit(child, depth + 1, node, skillQuestion)
  }

  visit(root, 0)

  return entries.filter((entry, index) => entries.findIndex(other => other.id === entry.id) === index)
}

/**
 * The skills a provider can list under a top-level service, taken from the public tree, as `{ id, label }`.
 * This mirrors the server's skill rule: a path's skill is the answer to its `matchesSkill` question (on the leaf or
 * any ancestor), or, with none, a leaf that sits below the top level. The id is the option's or the leaf's id.
 * Labels can repeat across branches, so equal labels under one root get their context in brackets.
 */
export const skillOptionsForRoot = (root: PublicServiceNode): { id: string; label: string }[] => {
  const entries = skillEntriesForRoot(root)
  const shared = (label: string) => entries.filter(entry => entry.label === label).length > 1

  return entries.map(entry => ({
    id: entry.id,
    label: shared(entry.label) && entry.context ? `${entry.label} (${entry.context})` : entry.label,
  }))
}

const matchName = <T>(items: T[], name: string, nameOf: (item: T) => string): T | undefined =>
  items.find(item => nameOf(item) === name) ??
  items.find(item => nameOf(item).trim().toLowerCase() === name.trim().toLowerCase())

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
    const root = matchName(roots, name, item => item.name)

    if (root && !serviceIds.includes(root.id)) serviceIds.push(root.id)
  }
  for (const [rootName, names] of Object.entries(skills)) {
    const root = matchName(roots, rootName, item => item.name)

    if (!root) continue

    const entries = skillEntriesForRoot(root)
    const ids = (names ?? [])
      .map(name => matchName(entries, name, entry => entry.label)?.id)
      .filter((id): id is string => Boolean(id))

    if (ids.length) skillIds[root.id] = [...new Set(ids)]
  }

  return { serviceIds, skillIds }
}
