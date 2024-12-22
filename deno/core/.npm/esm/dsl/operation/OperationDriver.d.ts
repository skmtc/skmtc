import type { OperationInsertable } from './OperationInsertable.js';
import type { OasOperation } from '../../oas/operation/Operation.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { GeneratedDefinition, GenerationType } from '../../types/GeneratedValue.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { GenerateContext } from '../../context/GenerateContext.js';
type CreateOperationArgs<V extends GeneratedValue, T extends GenerationType> = {
    context: GenerateContext;
    insertable: OperationInsertable<V>;
    operation: OasOperation;
    generation?: T;
    destinationPath?: string;
};
export declare class OperationDriver<V extends GeneratedValue, T extends GenerationType> {
    context: GenerateContext;
    insertable: OperationInsertable<V>;
    operation: OasOperation;
    settings: ContentSettings;
    destinationPath?: string;
    definition: GeneratedDefinition<V, T>;
    constructor({ context, insertable, operation, generation, destinationPath }: CreateOperationArgs<V, T>);
    private apply;
    private getDefinition;
    private affirmDefinition;
}
export {};
//# sourceMappingURL=OperationDriver.d.ts.map