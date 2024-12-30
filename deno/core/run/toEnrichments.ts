import type { ModelInsertable } from '../dsl/model/ModelInsertable.ts'
import type { OperationGateway, OperationInsertable } from '../dsl/operation/OperationInsertable.ts'
import type { GeneratedValue } from '../types/GeneratedValue.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { RefName } from '../types/RefName.ts'
import { handleEnrichment } from './handleEnrichment.ts'

type GeneratorsType =
  | OperationGateway
  | OperationInsertable<GeneratedValue>
  | ModelInsertable<GeneratedValue>

type ToEnrichmentsArgs = {
  generators: GeneratorsType[]
  oasDocument: OasDocument
}

export const toEnrichments = async ({ generators, oasDocument }: ToEnrichmentsArgs) => {
  const output: Record<string, Record<string, unknown>> = {}

  for (const generator of generators) {
    if (generator.type === 'operation') {
      for (const operation of oasDocument.operations) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(operation)

        if (enrichmentRequest) {
          const enrichmentResponse = await handleEnrichment(enrichmentRequest)
          const key = `operations.${operation.path}.${operation.method}.enrichments`

          output[generator.id][key] = JSON.parse(enrichmentResponse)
        }
      }
    } else if (generator.type === 'model') {
      for (const [refName, schema] of Object.entries(oasDocument.components?.schemas ?? {})) {
        const enrichmentRequest = generator.toEnrichmentRequest?.(refName as RefName)

        if (enrichmentRequest) {
          const enrichmentResponse = await handleEnrichment(enrichmentRequest)
          const key = `models.${refName}.enrichments`

          output[generator.id][key] = JSON.parse(enrichmentResponse)
        }
      }
    }
  }

  return output
}
