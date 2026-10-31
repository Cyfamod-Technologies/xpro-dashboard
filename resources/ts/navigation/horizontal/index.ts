import type { StaffPermission } from "@/features/operations/types"
import type { UserRole } from "@/types/domain"
import { v1Actor, v1Nav, v1SectionTitle } from "@/features/v1/access"
import type { V1Actor } from "@/features/v1/types"
import { isWorkspaceRole, sectionAllowed, sectionPath, workspaceSections } from "@/features/workspace/config"
import type { HorizontalNavItems } from "@layouts/types"

/**
 * The menu for one signed-in account. `actor` tells the V1 admin from V1 staff (both have the `admin` role); without
 * it an admin-role account gets the smaller staff menu.
 */
export const getHorizontalNavItems = (
  role?: UserRole,
  can: (permission: StaffPermission) => boolean = () => true,
  actor?: V1Actor | null,
): HorizontalNavItems => {
  if (!isWorkspaceRole(role)) return []

  const who = actor ?? v1Actor({ role, scopes: [] })

  return [
    ...(role === "customer"
      ? [{ title: "Browse services", to: "/", icon: { icon: "tabler-world" } }]
      : [{ title: "Public site", to: "/", icon: { icon: "tabler-world" } }]),
    ...v1Nav(who, workspaceSections[role])
      .filter(item => sectionAllowed(role, item, can))
      .map(item => ({
        title: v1SectionTitle(who, item.id, item.title),
        // Staff "Account" is the profile tab of the admin settings page.
        to:
          who === "staff" && item.id === "settings"
            ? { path: sectionPath(role, item.id), query: { tab: "profile" } }
            : sectionPath(role, item.id),
        icon: { icon: item.icon },
      })),
  ]
}
