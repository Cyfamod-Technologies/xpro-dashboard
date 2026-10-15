import type { useOperationsStore } from '@/stores/operations'
import type { ServiceLine } from '@/features/operations/types'

export type PublicProvider = ReturnType<typeof useOperationsStore>['publicProviders'][number]

export const initials = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()

/** Request link that keeps the provider as a preference, using a service the provider actually offers. */
export function requestLocation(provider: PublicProvider, preferred: string[] = []) {
  const service: ServiceLine = preferred.find(item => provider.services.includes(item as ServiceLine)) as ServiceLine | undefined ?? provider.services[0]

  return { path: '/request', query: { ...(service ? { service } : {}), provider: provider.id } }
}

export const experienceLabel = (years: number) => `${years} ${years === 1 ? 'yr' : 'yrs'}`
