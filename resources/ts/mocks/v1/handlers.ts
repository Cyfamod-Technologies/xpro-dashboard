import { HttpResponse, delay, http } from "msw"

import { v1Actor } from "@/features/v1/access"
import type { V1CreateRequestBody, V1MessageBody, V1RequestFilters, V1Status } from "@/features/v1/types"
import { users } from "@/mocks/fixtures"
import { mockApiBase } from "@/mocks/api-base"
import type { MockActor } from "@/mocks/v1/store"
import { V1MockError, createV1Store } from "@/mocks/v1/store"
import type { User } from "@/types/domain"

// MSW routes for the V1 contract in `services/v1-api.ts`. They translate HTTP to `mocks/v1/store.ts`, which holds the
// rules and the data (kept in `localStorage` under `xpro:v1-mock`, so a reload keeps the demo state).

const api = mockApiBase
export const store = createV1Store()
const demoUploads = new Map<string, { userId: string; name: string; size: number; type: string }>()

const envelope = <T>(data: T) => HttpResponse.json({ data })

const failure = (error: unknown) => {
  if (error instanceof V1MockError)
    return HttpResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    )

  return HttpResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "The mock server could not handle that request." } },
    { status: 500 },
  )
}

const unauthenticated = () =>
  HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Your session has expired." } }, { status: 401 })

const actorFrom = (request: Request): MockActor | undefined => {
  const token = request.headers.get("authorization")?.replace("Bearer ", "")
  const user: User | undefined = users.find(item => token === `mock-token-${item.id}`)
  const role = v1Actor(user)

  return user && role
    ? {
        id: user.id,
        role,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        phone: user.phone ?? undefined,
      }
    : undefined
}

/** Runs one store call as the signed-in demo user and turns a thrown rule into an error response. */
const handle = async (
  request: Request,
  run: (actor: MockActor) => unknown,
): Promise<ReturnType<typeof envelope> | ReturnType<typeof failure>> => {
  await delay(150)

  const actor = actorFrom(request)

  if (!actor) return unauthenticated()

  try {
    return envelope(run(actor))
  } catch (error) {
    return failure(error)
  }
}

/** `W/"3"` -> 3. A missing header skips the version check. */
const ifMatch = (request: Request): number | undefined => {
  const match = /(\d+)/.exec(request.headers.get("if-match") ?? "")

  return match ? Number(match[1]) : undefined
}

const filtersFrom = (url: URL): V1RequestFilters => {
  const params = url.searchParams
  const status = params.get("status")
  const page = Number(params.get("page"))
  const itemsPerPage = Number(params.get("itemsPerPage"))

  return {
    status:
      status === "submitted" || status === "approved" || status === "denied" || status === "cancelled"
        ? (status as V1Status)
        : "",
    assignee: params.get("assignee") ?? undefined,
    service: params.get("service") ?? undefined,
    q: params.get("q") ?? undefined,
    page: page > 0 ? page : undefined,
    itemsPerPage: itemsPerPage > 0 ? itemsPerPage : undefined,
  }
}

export const v1Handlers = [
  http.post(`${api}/uploads`, async ({ request }) => {
    const body = (await request.clone().json()) as { name?: string; size?: number; type?: string; purpose?: string }

    return handle(request, actor => {
      if (!body.name || !Number.isFinite(body.size) || !body.type)
        throw new V1MockError(422, "VALIDATION_ERROR", "Choose a valid file to upload.")
      if (body.purpose !== "request_attachment" && body.purpose !== "message_attachment")
        throw new V1MockError(422, "VALIDATION_ERROR", "Choose a valid attachment type.")

      const id = globalThis.crypto.randomUUID()

      demoUploads.set(id, { userId: actor.id, name: body.name, size: Number(body.size), type: body.type })

      return {
        id,
        uploadUrl: `${api}/mock-uploads/${id}`,
        method: "PUT" as const,
        headers: {},
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      }
    })
  }),
  http.put(`${api}/mock-uploads/:id`, () => new HttpResponse(null, { status: 200 })),
  http.post(`${api}/uploads/:id/complete`, ({ request, params }) =>
    handle(request, actor => {
      const id = String(params.id)
      const upload = demoUploads.get(id)

      if (!upload || upload.userId !== actor.id)
        throw new V1MockError(404, "NOT_FOUND", "This upload could not be found.")

      return { id, ...upload, status: "completed" }
    }),
  ),
  http.get(`${api}/request-options`, ({ request }) => handle(request, () => store.formOptions())),
  http.get(`${api}/request-summary`, ({ request }) => handle(request, actor => store.counts(actor))),

  http.get(`${api}/requests`, ({ request }) =>
    handle(request, actor => store.listRequests(actor, filtersFrom(new URL(request.url)))),
  ),
  http.post(`${api}/requests`, async ({ request }) => {
    const body = (await request.clone().json()) as V1CreateRequestBody

    return handle(request, actor => store.createRequest(actor, body))
  }),
  http.get(`${api}/requests/:id`, ({ request, params }) =>
    handle(request, actor => store.getRequest(actor, String(params.id))),
  ),

  http.post(`${api}/requests/:id/reassign`, async ({ request, params }) => {
    const body = (await request.clone().json()) as { staffId: string; expectedOwnerId: string | null; note?: string }

    return handle(request, actor => store.assignStaff(actor, String(params.id), body, ifMatch(request)))
  }),
  http.post(`${api}/requests/:id/approve`, async ({ request, params }) => {
    const body = (await request.clone().json()) as { providerId: string; priceKobo: number; date: string }

    return handle(request, actor => store.approve(actor, String(params.id), body, ifMatch(request)))
  }),
  http.post(`${api}/requests/:id/deny`, async ({ request, params }) => {
    const body = (await request.clone().json()) as { reason: string }

    return handle(request, actor => store.deny(actor, String(params.id), body, ifMatch(request)))
  }),
  http.post(`${api}/requests/:id/cancel`, ({ request, params }) =>
    handle(request, actor => store.cancelRequest(actor, String(params.id), ifMatch(request))),
  ),
  http.get(`${api}/requests/:id/provider-candidates`, ({ request, params }) =>
    handle(request, actor => store.providerCandidates(actor, String(params.id))),
  ),
  http.put(`${api}/requests/:id/provider-assignment`, async ({ request, params }) => {
    const body = (await request.clone().json()) as { providerId: string; reason: string }

    return handle(request, actor => store.replaceProvider(actor, String(params.id), body, ifMatch(request)))
  }),

  http.get(`${api}/requests/:id/messages`, ({ request, params }) =>
    handle(request, actor => store.messages(actor, String(params.id))),
  ),
  http.post(`${api}/requests/:id/messages`, async ({ request, params }) => {
    const body = (await request.clone().json()) as V1MessageBody

    return handle(request, actor => store.sendMessage(actor, String(params.id), body))
  }),

  http.get(`${api}/admin/staff/owners`, ({ request }) =>
    handle(request, actor => {
      const excluded = new URL(request.url).searchParams.get("exclude")

      return store
        .listStaff(actor)
        .filter(member => member.id !== excluded)
        .map(member => ({
          ...member,
          roles: [
            member.id === "usr-operations"
              ? "operations"
              : member.id === "usr-pricing"
                ? "pricing"
                : member.id === "usr-relations"
                  ? "client_relations"
                  : "finance",
          ],
          onLeave: false,
          leaveTo: null,
          workload: { openOwned: member.openRequests, overdueOwned: 0 },
        }))
    }),
  ),
  http.get(`${api}/admin/conversations`, ({ request }) =>
    handle(request, actor => store.adminConversations(actor, { q: new URL(request.url).searchParams.get("q") ?? "" })),
  ),
  http.get(`${api}/me/conversations`, ({ request }) => handle(request, actor => store.customerConversations(actor))),

  http.get(`${api}/providers/me/jobs`, ({ request }) => handle(request, actor => store.providerJobs(actor))),
  http.get(`${api}/providers/me/jobs/:id`, ({ request, params }) =>
    handle(request, actor => store.providerJob(actor, String(params.id))),
  ),
]
