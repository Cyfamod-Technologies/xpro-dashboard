import type { ServiceCardState } from "@/features/discovery/request-bundle"
import {
  MAX_CONFIGURABLE_SERVICES,
  MAX_SERVICES_PER_SUBMISSION,
  canAddService,
  canRemoveService,
  newServiceCard,
} from "@/features/discovery/request-bundle"

/** The Service cards on the live request form: add, remove, and one file slot per possible card for the draft. */
export function useServiceCards() {
  const cards = ref<ServiceCardState[]>([newServiceCard()])

  // `max` is the cap for this customer: the per-submission maximum, or less when their open-request allowance is lower.
  function addCard(max = MAX_SERVICES_PER_SUBMISSION) {
    if (!canAddService(cards.value.length, max)) return undefined

    const card = newServiceCard()

    cards.value.push(card)

    return card.key
  }

  function removeCard(key: string) {
    if (canRemoveService(cards.value.length)) cards.value = cards.value.filter(card => card.key !== key)
  }

  // The draft stores queued files by a fixed group name, so each possible card position gets a slot that reads and
  // writes the files of the card at that position.
  const fileSlots = Array.from({ length: MAX_CONFIGURABLE_SERVICES }, (_, position) =>
    computed<File[]>({
      get: () => cards.value[position]?.files ?? [],
      set: value => {
        const card = cards.value[position]

        if (card) card.files = value
      },
    }),
  )
  const draftFileGroups = Object.fromEntries(fileSlots.map((slot, position) => [`service${position}`, slot]))

  return { cards, addCard, removeCard, draftFileGroups }
}
