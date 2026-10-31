import type { V1Attachment } from "@/features/v1/types"
import { requestsApi } from "@/services/requests-api"

/** Uploads V1 request or conversation files through the same private upload API used by the existing request flows. */
export async function uploadV1Files(
  files: File[],
  purpose: "request_attachment" | "message_attachment",
): Promise<V1Attachment[]> {
  const attachments: V1Attachment[] = []

  for (const file of files) {
    const upload = await requestsApi.createUpload({
      name: file.name,
      size: file.size,
      type: file.type,
      purpose,
    })
    const response = await fetch(upload.uploadUrl, { method: upload.method, headers: upload.headers, body: file })

    if (!response.ok) throw new Error(`Could not upload ${file.name}.`)

    const completed = await requestsApi.completeUpload(upload.id)

    attachments.push({
      id: completed.id,
      name: completed.name,
      size: completed.size,
      type: completed.type,
    })
  }

  return attachments
}
