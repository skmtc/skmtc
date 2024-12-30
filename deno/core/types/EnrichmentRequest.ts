import type { z } from 'npm:zod@3.24.1'

export type EnrichmentRequest<EnrichmentType> = {
  prompt: string
  responseSchema: z.ZodType<EnrichmentType>
  content: string
}
