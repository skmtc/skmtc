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

type EnrichmentOutput = {
  generatorId: string
  key: string[]
  value: Promise<string>
}

export const toEnrichments = async <EnrichmentType>({
  generators,
  oasDocument
}: ToEnrichmentsArgs<EnrichmentType>) => {
  const responses: EnrichmentOutput[] = []

  for (const generator of generators) {
    if (generator.type === 'operation') {
      for (const operation of oasDocument.operations) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(operation)

        if (enrichmentRequest) {
          const enrichmentResponse = handleEnrichment(enrichmentRequest)

          responses.push({
            generatorId: generator.id,
            key: ['operations', operation.path, operation.method, 'enrichments'],
            value: enrichmentResponse
          })
        }
      }
    } else if (generator.type === 'model') {
      for (const [refName, schema] of Object.entries(oasDocument.components?.schemas ?? {})) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(refName as RefName)

        if (enrichmentRequest) {
          const enrichmentResponse = handleEnrichment(enrichmentRequest)

          responses.push({
            generatorId: generator.id,
            key: ['models', refName, 'enrichments'],
            value: enrichmentResponse
          })
        }
      }
    }
  }

  const items = await Promise.all(
    responses.map(async response => {
      return {
        generatorId: response.generatorId,
        key: response.key,
        value: await response.value
      }
    })
  )

  return items.reduce<Record<string, EnrichmentItem[]>>(
    (acc, { generatorId, key, value }) => {
      acc[generatorId] = acc[generatorId] || []

      acc[generatorId].push({
        key,
        value: JSON.parse(value)
      })

      return acc
    },
    {} as Record<string, EnrichmentItem[]>
  )
}
