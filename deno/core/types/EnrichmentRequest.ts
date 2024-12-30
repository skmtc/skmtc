import type { ResponseSchema } from '@google/generative-ai'

export type EnrichmentRequest = {
  prompt: string
  responseSchema: ResponseSchema
  content: string
}
