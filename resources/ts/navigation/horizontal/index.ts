import type { UserRole } from "@/types/domain";
import {
  isWorkspaceRole,
  workspaceSections,
} from "@/features/workspace/config";
import type { HorizontalNavItems } from "@layouts/types";

export const getHorizontalNavItems = (role?: UserRole): HorizontalNavItems => {
  if (!isWorkspaceRole(role)) return [];

  return [
    ...(role === "customer"
      ? [{ title: "Browse services", to: "/", icon: { icon: "tabler-world" } }]
      : [
          {
            title: "Overview",
            to: "/",
            icon: { icon: "tabler-layout-dashboard" },
          },
        ]),
    ...workspaceSections[role].map((item) => ({
      title: item.title,
      to: `/workspace/${item.id}`,
      icon: { icon: item.icon },
    })),
  ];
};
