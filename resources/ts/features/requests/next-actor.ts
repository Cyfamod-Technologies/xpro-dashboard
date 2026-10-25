import type { NextActor } from "@/features/requests/api-types"

/**
 * Customers and providers get `customer`, `provider`, `xpro` or `none`; staff get the raw value
 * (`staff:<permission>`, `system`, or one of the above).
 */
export function nextActorLabel(value: NextActor | undefined): string {
  if (!value || value === "none") return "No one"
  if (value === "customer") return "Customer"
  if (value === "provider") return "Provider"
  if (value === "xpro") return "XPro"
  if (value === "system") return "System"
  if (value.startsWith("staff:")) return `XPro staff (${value.slice("staff:".length).replaceAll(".", " ")})`

  return value
}
