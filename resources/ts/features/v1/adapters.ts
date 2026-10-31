import type { RequestSummary, RequestView } from "@/features/requests/api-types"
import type { ConversationItem } from "@/features/messages/types"
import type { V1Conversation, V1Request } from "@/features/v1/types"

const statusLabel = (status: V1Request["status"]) => status[0].toUpperCase() + status.slice(1)
const stage = (status: V1Request["status"]) =>
  status === "submitted"
    ? "intake_review"
    : status === "approved"
      ? "scheduling"
      : status === "cancelled"
        ? "closed"
        : "rejected"

export const toV1RequestSummary = (request: V1Request): RequestSummary => ({
  id: request.id,
  version: request.version,
  status: request.status,
  stage: stage(request.status),
  statusLabel: statusLabel(request.status),
  nextActor: request.status === "submitted" ? "xpro" : request.status === "approved" ? "provider" : "none",
  allowedActions: [],
  title: request.title,
  service: request.service,
  locationId: request.location,
  locationPath: [],
  locationLabel: request.location,
  createdAt: request.createdAt,
  dispatch: { mode: "manual" },
})

export const toV1RequestView = (request: V1Request): RequestView => ({
  ...toV1RequestSummary(request),
  description: request.description,
  address: request.address,
  phone: request.phone,
  contactMethod: request.contactMethod,
  budget: request.budgetKobo,
  startDate: request.preferredDate,
  customerName: request.customer.name,
  ownerId: request.customer.id,
  staffOwnerId: request.assignee?.id ?? null,
  attachments: request.attachments.map(file => ({ ...file, uploadedAt: request.createdAt, sharedWithProvider: false })),
})

export const toV1ConversationItem = (conversation: V1Conversation): ConversationItem => ({
  requestId: conversation.requestId,
  title: conversation.title,
  status: conversation.status,
  statusLabel: statusLabel(conversation.status),
  closed: false,
  owner: conversation.assignee,
  customer: { name: conversation.customer.name },
  provider: null,
  lastMessage: {
    audience: "customer",
    authorRole: conversation.lastMessage?.authorRole ?? "customer",
    authorLabel: conversation.lastMessage?.authorLabel ?? conversation.customer.name,
    text: conversation.lastMessage?.text ?? "",
    at: conversation.lastMessage?.at ?? "",
  },
  waitingForXpro: conversation.waitingForXpro,
})
