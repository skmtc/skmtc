import type { OperationConfig } from '../dsl/operation/types.ts'
import type { ModelConfig } from '../dsl/model/types.ts'

export type GeneratorConfig<EnrichmentType = undefined> =
  | OperationConfig<EnrichmentType>
  | ModelConfig<EnrichmentType>

export type GeneratorsMap<G extends GeneratorConfig<EnrichmentType>, EnrichmentType> = {
  [K in keyof G]: G[K]
}

export type GeneratorsMapContainer<EnrichmentType = undefined> = GeneratorsMap<
  GeneratorConfig<EnrichmentType>,
  EnrichmentType
>
