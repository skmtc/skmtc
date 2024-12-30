import type { OperationInsertable } from './OperationInsertable.js';
import type { OasOperation } from '../../oas/operation/Operation.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { GenerateContext } from '../../context/GenerateContext.js';
type CreateOperationArgs<V extends GeneratedValue, T extends GenerationType, EnrichmentType> = {
    context: GenerateContext;
    insertable: OperationInsertable<V, EnrichmentType>;
    operation: OasOperation;
    generation?: T;
    destinationPath?: string;
};
export declare class OperationDriver<V extends GeneratedValue, T extends GenerationType, EnrichmentType> {
    context: GenerateContext;
    insertable: OperationInsertable<V, EnrichmentType>;
    operation: OasOperation;
    settings: ContentSettings<EnrichmentType>;
    destinationPath?: string;
    definition: GeneratedDefinition<V, T>;
    constructor({ context, insertable, operation, generation, destinationPath }: CreateOperationArgs<V, T, EnrichmentType>);
    private apply;
    private getDefinition;
    private affirmDefinition;
}
export {};
//# sourceMappingURL=OperationDriver.d.ts.map