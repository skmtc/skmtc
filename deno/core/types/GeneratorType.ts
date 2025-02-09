import type { OperationInsertable } from '../dsl/operation/OperationInsertable.ts'
import type { ModelInsertable } from '../dsl/model/ModelInsertable.ts'
import type { GeneratedValue } from './GeneratedValue.ts'

export type GeneratorType<EnrichmentType> =
  | OperationInsertable<GeneratedValue, EnrichmentType>
  | ModelInsertable<GeneratedValue, EnrichmentType>

export type GeneratorsMap<G extends GeneratorType<EnrichmentType>, EnrichmentType> = {
  [K in keyof G]: G[K]
}
