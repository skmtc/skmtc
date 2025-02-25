import type { z } from 'npm:zod@3.24.1'

export type EnrichmentRequest<EnrichmentType = undefined> = {
  prompt: string
  enrichmentSchema: z.ZodType<EnrichmentType>
  content: string
}
