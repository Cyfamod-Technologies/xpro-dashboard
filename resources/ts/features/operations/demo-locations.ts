import type { LocationView } from "@/features/requests/api-types"

/** Demo mode only: a tiny stand-in for `GET /locations`. FCT with two LGAs, and a few areas under each. */
const place = (
  id: string,
  kind: LocationView["kind"],
  name: string,
  parentId: string | null,
  extra: Partial<Pick<LocationView, "aliases" | "hasChildren">> = {},
): LocationView => ({
  id,
  kind,
  name,
  parentId,
  aliases: extra.aliases ?? [],
  active: true,
  serviceable: true,
  sort: 0,
  hasChildren: extra.hasChildren ?? false,
})

const area = (id: string, name: string, parentId: string) => place(id, "area", name, parentId)

const places: LocationView[] = [
  place("demo-fct", "state", "FCT", null, { aliases: ["Abuja (FCT)", "Federal Capital Territory"], hasChildren: true }),
  place("demo-amac", "lga", "Abuja Municipal", "demo-fct", { aliases: ["Abuja", "AMAC"], hasChildren: true }),
  place("demo-bwari", "lga", "Bwari", "demo-fct", { hasChildren: true }),
  area("demo-asokoro", "Asokoro", "demo-amac"),
  area("demo-garki", "Garki", "demo-amac"),
  area("demo-gwarimpa", "Gwarimpa", "demo-amac"),
  area("demo-jabi", "Jabi", "demo-amac"),
  area("demo-life-camp", "Life Camp", "demo-amac"),
  area("demo-lugbe", "Lugbe", "demo-amac"),
  area("demo-maitama", "Maitama", "demo-amac"),
  area("demo-utako", "Utako", "demo-amac"),
  area("demo-wuse-ii", "Wuse II", "demo-amac"),
  area("demo-kubwa", "Kubwa", "demo-bwari"),
]

/** The states when `parentId` is omitted, otherwise the children of that place. */
export const demoLocations = (parentId?: string) => places.filter(item => (item.parentId ?? undefined) === parentId)

/** A place by name or alias, ignoring case. */
export const demoPlaceNamed = (name: string) => {
  const wanted = name.trim().toLowerCase()

  return places.find(item => [item.name, ...item.aliases].some(label => label.toLowerCase() === wanted))
}
