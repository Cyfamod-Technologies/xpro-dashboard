import type { PublicServiceNode } from "@/features/catalog/types"
import { staticServiceName } from "@/features/discovery/service-aliases"
import { serviceLines } from "@/features/workspace/config"
import { catalogApi } from "@/services/catalog-api"
import { isDemoMode } from "@/utils/demo-mode"

export interface PublicService {
  name: string
  description: string
}

// A catalog service without its own description borrows the static one of the same name.
const fromNode = (node: PublicServiceNode): PublicService => {
  const line = serviceLines.find(item => item.name === staticServiceName(node.name))

  return {
    name: node.name,
    description: node.description || line?.description || "",
  }
}

const services = shallowRef<PublicService[]>(isDemoMode ? serviceLines : [])
const ready = ref(isDemoMode)
let request: Promise<void> | undefined

const load = () =>
  (request ??= catalogApi
    .publicTree()
    .then(tree => {
      services.value = tree.map(fromNode)
    })
    .catch(() => {
      services.value = serviceLines
    })
    .finally(() => {
      ready.value = true
    }))

/** Top-level public services from the live catalog, fetched once per page load. Demo mode and a failed request use the static list. */
export const usePublicServices = () => {
  if (!isDemoMode) void load()

  return { services: readonly(services), ready: readonly(ready) }
}
