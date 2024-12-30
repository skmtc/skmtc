import type { OasDocument } from '../oas/document/Document.ts'
import type { GeneratorType } from '../types/GeneratorType.ts'
import type { RefName } from '../types/RefName.ts'
import { handleEnrichment } from './handleEnrichment.ts'

type ToEnrichmentsArgs<EnrichmentType> = {
  generators: GeneratorType<EnrichmentType>[]
  oasDocument: OasDocument
}

export type EnrichmentItem = {
  key: string[]
  value: unknown
}

export const toEnrichments = async <EnrichmentType>({
  generators,
  oasDocument
}: ToEnrichmentsArgs<EnrichmentType>) => {
  const output: Record<string, EnrichmentItem[]> = {}

  for (const generator of generators) {
    if (generator.type === 'operation') {
      for (const operation of oasDocument.operations) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(operation)

        if (enrichmentRequest) {
          const enrichmentResponse = await handleEnrichment(enrichmentRequest)

          if (!output[generator.id]) {
            output[generator.id] = []
          }

          output[generator.id].push({
            key: ['operations', operation.path, operation.method, 'enrichments'],
            value: JSON.parse(enrichmentResponse)
          })
        }
      }
    } else if (generator.type === 'model') {
      for (const [refName, schema] of Object.entries(oasDocument.components?.schemas ?? {})) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(refName as RefName)

        if (enrichmentRequest) {
          const enrichmentResponse = await handleEnrichment(enrichmentRequest)

          if (!output[generator.id]) {
            output[generator.id] = []
          }

          output[generator.id].push({
            key: ['models', refName, 'enrichments'],
            value: JSON.parse(enrichmentResponse)
          })
        }
      }
    }
  }

  console.log('OUTPUT', output)

  return output
}
