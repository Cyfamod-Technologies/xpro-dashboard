/** Moves the id at `from` to position `to`, for drag-and-drop reordering of the pinned list. */
export const moveId = (ids: string[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids
  const next = [...ids]
  const [item] = next.splice(from, 1)

  next.splice(to, 0, item)

  return next
}

/** How many public page slots are left for automatic fill once the pinned providers are placed. */
export const automaticSlots = (limit: number, pinned: number) => Math.max(limit - pinned, 0)

/** A search matches any word-prefix of the name, business, trade or city, ignoring case. */
export const matchesSearch = (
  row: { name: string; businessName: string | null; trade: string; city: string },
  query: string,
) => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = [row.name, row.businessName ?? "", row.trade, row.city].join(" ").toLowerCase()

  return terms.every(term => text.includes(term))
}

/** How many entries differ between the saved list and the edited one, counting a reorder as one change. */
export const changeCount = (saved: string[], edited: string[]) => {
  const added = edited.filter(id => !saved.includes(id)).length
  const removed = saved.filter(id => !edited.includes(id)).length
  const kept = edited.filter(id => saved.includes(id))
  const keptSaved = saved.filter(id => edited.includes(id))
  const reordered = kept.join("|") !== keptSaved.join("|") ? 1 : 0

  return added + removed + reordered
}
