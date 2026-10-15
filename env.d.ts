import "vue-router"
import type { UserRole } from "@/types/domain"

declare module "vue-router" {
  interface RouteMeta {
    action?: string
    subject?: string
    layoutWrapperClasses?: string
    navActiveLink?: RouteLocationRaw
    layout?: "blank" | "default"
    unauthenticatedOnly?: boolean
    public?: boolean
    roles?: UserRole[]
    section?: string
    adminSection?: string | boolean
  }
}
