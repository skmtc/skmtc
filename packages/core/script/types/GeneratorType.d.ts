import type { OperationGateway } from '../dsl/operation/OperationInsertable.js';
import type { OperationInsertable } from '../dsl/operation/OperationInsertable.js';
import type { ModelInsertable } from '../dsl/model/ModelInsertable.js';
import type { GeneratedValue } from './GeneratedValue.js';
export type GeneratorType<EnrichmentType> = OperationGateway<EnrichmentType> | OperationInsertable<GeneratedValue, EnrichmentType> | ModelInsertable<GeneratedValue, EnrichmentType>;
export type GeneratorsMap<G extends GeneratorType<EnrichmentType>, EnrichmentType> = {
    [K in keyof G]: G[K];
};
//# sourceMappingURL=GeneratorType.d.ts.map