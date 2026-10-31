import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  v1Actor,
  v1Capabilities,
  v1HomePath,
  v1Nav,
  v1RouteAllowed,
  v1SectionTitle,
  v1Sections,
  v1ViewFor,
} from "@/features/v1/access.ts"
import type { V1Actor } from "@/features/v1/types.ts"
import { sectionAllowed, sectionEnabled, v1Workspace, workspaceSections } from "@/features/workspace/config.ts"
import { getHorizontalNavItems } from "@/navigation/horizontal/index.ts"
import { getVerticalNavItems } from "@/navigation/vertical/index.ts"

// --- Actor derivation: staff.manage makes the admin-role account the V1 admin; any other admin-role user is staff.
assert.equal(v1Actor({ role: "customer", scopes: [] }), "customer")
assert.equal(v1Actor({ role: "provider", scopes: ["Own profile"] }), "provider")
assert.equal(v1Actor({ role: "admin", scopes: ["staff.manage"] }), "admin")
assert.equal(v1Actor({ role: "admin", scopes: ["Requests", "staff.manage"] }), "admin")
assert.equal(v1Actor({ role: "admin", scopes: [] }), "staff")
assert.equal(v1Actor({ role: "admin", scopes: ["request.review"] }), "staff")
assert.equal(v1Actor({ role: "robot", scopes: ["staff.manage"] }), null)
assert.equal(v1Actor(null), null)
assert.equal(v1Actor(undefined), null)

// --- Navigation per actor, in the plan's order.
const everything = () => true
const navIds = (actor: V1Actor) => {
  const role = actor === "admin" || actor === "staff" ? "admin" : actor

  return v1Nav(actor, workspaceSections[role])
    .filter(item => sectionAllowed(role, item, everything))
    .map(item => item.id)
}

assert.deepEqual(navIds("customer"), ["overview", "requests", "messages", "account"])
assert.deepEqual(navIds("admin"), [
  "overview",
  "requests",
  "messages",
  "providers",
  "finance",
  "services",
  "staff",
  "settings",
])
assert.deepEqual(navIds("staff"), ["requests", "settings"])
assert.deepEqual(navIds("provider"), ["overview", "verification", "availability", "jobs", "account"])

// Every section in the V1 map exists and is enabled in the workspace config.
for (const [actor, ids] of Object.entries(v1Sections)) {
  const role = actor === "admin" || actor === "staff" ? "admin" : (actor as "customer" | "provider")

  for (const id of ids) {
    assert.ok(
      workspaceSections[role].some(item => item.id === id),
      `${actor}: ${id} is defined for ${role}`,
    )
    assert.ok(sectionEnabled(role, id), `${actor}: ${id} is enabled for ${role}`)
  }
}

// --- Hidden sections are blocked as direct routes for the actor that never had them.
const blocked: Record<V1Actor, string[]> = {
  customer: ["quotes", "payments", "schedule", "notifications", "settings", "services", "staff", "providers"],
  admin: ["approvals", "dispatch", "quotes", "schedule", "audit", "notifications"],
  staff: ["overview", "messages", "providers", "finance", "services", "staff", "approvals", "dispatch", "audit"],
  provider: ["quotes", "payouts", "schedule", "messages", "notifications", "settings", "requests"],
}

for (const [actor, ids] of Object.entries(blocked))
  for (const id of ids) assert.equal(v1RouteAllowed(actor as V1Actor, id), false, `${actor} cannot open ${id}`)

assert.equal(v1RouteAllowed(null, "overview"), false)
assert.equal(v1RouteAllowed("staff", "requests"), true)
assert.equal(v1RouteAllowed("staff", "settings"), true)

// The disabled lists in config agree with the V1 map: nothing disabled is ever allowed.
for (const role of ["customer", "provider", "admin"] as const)
  for (const id of v1Workspace.disabledSections[role]) {
    const actors: V1Actor[] = role === "admin" ? ["admin", "staff"] : [role]

    for (const actor of actors) assert.equal(v1RouteAllowed(actor, id), false, `${actor} cannot open disabled ${id}`)
  }

// --- Menu items: only allowed sections, with the staff wording and profile tab.
const toPath = (to: unknown) => (typeof to === "string" ? to : (to as { path: string }).path)
const menuPaths = (actor: V1Actor) => {
  const role = actor === "admin" || actor === "staff" ? "admin" : actor
  const vertical = getVerticalNavItems(role, everything, actor)
  const horizontal = getHorizontalNavItems(role, everything, actor)

  assert.deepEqual(
    vertical.map(item => ("title" in item ? item.title : "")),
    horizontal.map(item => ("title" in item ? item.title : "")),
    `${actor}: both menus match`,
  )

  return vertical.map(item => ("to" in item ? toPath(item.to) : ""))
}

assert.deepEqual(menuPaths("customer"), ["/", "/overview", "/requests", "/messages", "/account"])
assert.deepEqual(menuPaths("staff"), ["/", "/admin/requests", "/admin/settings"])
assert.deepEqual(menuPaths("provider"), ["/", "/overview", "/verification", "/availability", "/jobs", "/account"])
assert.deepEqual(menuPaths("admin"), [
  "/",
  "/admin",
  "/admin/requests",
  "/admin/messages",
  "/admin/providers",
  "/admin/finance",
  "/admin/services",
  "/admin/staff",
  "/admin/settings",
])

const staffMenu = getVerticalNavItems("admin", everything, "staff")

assert.deepEqual(
  staffMenu.map(item => ("title" in item ? item.title : "")),
  ["Public site", "My assigned requests", "Account"],
)
assert.deepEqual(
  staffMenu.map(item => ("to" in item && typeof item.to === "object" ? (item.to as { query?: unknown }).query : null)),
  [null, null, { tab: "profile" }],
)
// Without an actor an admin-role menu is the smaller staff menu, never the admin one.
assert.deepEqual(
  getVerticalNavItems("admin", everything).map(item => ("to" in item ? toPath(item.to) : "")),
  ["/", "/admin/requests", "/admin/settings"],
)
assert.deepEqual(getVerticalNavItems(undefined, everything), [])

// --- Titles, homes, views, capabilities.
assert.equal(v1SectionTitle("staff", "requests", "Requests"), "My assigned requests")
assert.equal(v1SectionTitle("staff", "settings", "Settings"), "Account")
assert.equal(v1SectionTitle("admin", "requests", "Requests"), "Requests")
assert.equal(v1HomePath("staff"), "/admin/requests")
assert.equal(v1HomePath("admin"), "/admin")
assert.equal(v1HomePath("customer"), "/overview")

assert.equal(v1ViewFor("customer", "overview"), "overview")
assert.equal(v1ViewFor("admin", "messages"), "messages")
assert.equal(v1ViewFor("staff", "messages"), null)
assert.equal(v1ViewFor("staff", "requests"), "requests")
assert.equal(v1ViewFor("provider", "jobs"), "jobs")
assert.equal(v1ViewFor("customer", "jobs"), null)
assert.equal(v1ViewFor("provider", "quotes"), null)

assert.deepEqual(v1Capabilities("admin"), {
  canDecide: true,
  canAssignStaff: true,
  canSendQuote: true,
  canReplaceProvider: true,
  canChat: true,
})
assert.deepEqual(v1Capabilities("staff"), {
  canDecide: false,
  canAssignStaff: false,
  canSendQuote: true,
  canReplaceProvider: true,
  canChat: true,
})
assert.deepEqual(v1Capabilities("customer"), {
  canDecide: false,
  canAssignStaff: false,
  canSendQuote: false,
  canReplaceProvider: false,
  canChat: true,
})
assert.deepEqual(v1Capabilities("provider"), {
  canDecide: false,
  canAssignStaff: false,
  canSendQuote: false,
  canReplaceProvider: false,
  canChat: false,
})

// --- The V1 Overview screen links to nothing hidden.
const overview = readFileSync(new URL("../resources/ts/features/v1/V1Overview.vue", import.meta.url), "utf8")
const hiddenPaths = ["approvals", "dispatch", "quotes", "schedule", "audit", "notifications", "payouts", "payments"]

for (const id of hiddenPaths) assert.ok(!overview.includes(`/${id}`), `V1Overview has no shortcut to /${id}`)

// --- Staff and admin cannot approve/deny by capability only for the admin.
assert.equal(v1Capabilities("staff").canDecide, false)

console.log("v1-access: ok")
