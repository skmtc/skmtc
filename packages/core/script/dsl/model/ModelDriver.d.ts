import type { ModelInsertable } from './ModelInsertable.js';
import type { GenerateContext } from '../../context/GenerateContext.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { RefName } from '../../types/RefName.js';
type CreateModelArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
    context: GenerateContext;
    insertable: ModelInsertable<V, EnrichmentType>;
    refName: RefName;
    generation?: T;
    destinationPath?: string;
};
export declare class ModelDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
    context: GenerateContext;
    insertable: ModelInsertable<V, EnrichmentType>;
    refName: RefName;
    settings: ContentSettings<EnrichmentType>;
    destinationPath?: string;
    definition: GeneratedDefinition<V, T>;
    constructor({ context, insertable, refName, generation, destinationPath }: CreateModelArgs<V, T, EnrichmentType>);
    private apply;
    private getDefinition;
    private affirmDefinition;
}
export {};
//# sourceMappingURL=ModelDriver.d.ts.map