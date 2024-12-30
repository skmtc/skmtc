import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { GeneratorKey } from '../../types/GeneratorKeys.js';
import type { RefName } from '../../types/RefName.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { ModelInsertable } from './ModelInsertable.js';
import { ValueBase } from '../ValueBase.js';
import type { Inserted } from '../Inserted.js';
export type ModelBaseArgs<EnrichmentType> = {
    context: GenerateContext;
    settings: ContentSettings<EnrichmentType>;
    generatorKey: GeneratorKey;
    refName: RefName;
};
export declare class ModelBase<EnrichmentType> extends ValueBase {
    settings: ContentSettings<EnrichmentType>;
    refName: RefName;
    generatorKey: GeneratorKey;
    constructor({ context, settings, generatorKey, refName }: ModelBaseArgs<EnrichmentType>);
    insertModel<V extends GeneratedValue, ET>(insertable: ModelInsertable<V, ET>, refName: RefName): Inserted<V, 'force', ET>;
    register(args: Omit<RegisterArgs, 'destinationPath'>): void;
}
//# sourceMappingURL=ModelBase.d.ts.map