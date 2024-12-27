import type { ResponseSchema } from 'npm:@google/generative-ai'

export type EnrichmentRequest = {
  prompt: string
  responseSchema: ResponseSchema
  content: string
}
