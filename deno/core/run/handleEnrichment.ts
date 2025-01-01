import { GoogleGenerativeAI, type ResponseSchema } from 'npm:@google/generative-ai@^0.21.0'
import type { EnrichmentRequest } from '../types/EnrichmentRequest.ts'
import { zodToJsonSchema } from 'npm:zod-to-json-schema@3.24.1'

const apiKey = Deno.env.get('GEMINI_API_KEY')

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(apiKey)

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash'
})

export const handleEnrichment = async <EnrichmentType>({
  prompt,
  content,
  responseSchema: zodResponseSchema
}: EnrichmentRequest<EnrichmentType>) => {
  const responseSchema = zodToJsonSchema(zodResponseSchema, {
    target: 'openApi3'
  }) as ResponseSchema

  const chatSession = model.startChat({
    generationConfig: {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: removeProperties(responseSchema, 'additionalProperties')
    }
  })

  const result = await chatSession.sendMessage(`${prompt}\n\n${content}`)

  return result.response.text()
}

// deno-lint-ignore no-explicit-any
export function removeProperties<T extends Record<string, any>>(
  obj: T,
  propertyName: string
): Partial<T> {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  // deno-lint-ignore ban-ts-comment
  // @ts-ignore
  const result: Partial<T> = Array.isArray(obj) ? [] : {}

  for (const key in obj) {
    if (key === propertyName) {
      continue
    }

    const value = obj[key]
    if (typeof value === 'object' && value !== null) {
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      result[key] = removeProperties(value, propertyName)
    } else {
      result[key] = value
    }
  }

  return result
}
