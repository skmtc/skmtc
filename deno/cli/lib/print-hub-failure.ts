import type { ApiErrorDetail } from '@/lib/api-publish-headless.ts'

type HubFailure = {
  code: string
  status?: number
  message: string
  requestId?: string
  details?: ApiErrorDetail[]
}

/** A hub failure as text: the lead line, each detail, then the request id. */
export const printHubFailure = (lead: string, failure: HubFailure): void => {
  console.error(
    `${lead} (${failure.code}${failure.status ? `, ${failure.status}` : ''}): ${failure.message}`
  )
  for (const detail of failure.details ?? []) {
    console.error(`  ${detail.field ? `${detail.field}: ` : ''}${detail.message}`)
  }
  if (failure.requestId) console.error(`  request id: ${failure.requestId}`)
}
