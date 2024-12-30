import type { OperationInsertable } from './OperationInsertable.js';
import type { OasOperation } from '../../oas/operation/Operation.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { GeneratorKey } from '../../types/GeneratorKeys.js';
import { ValueBase } from '../ValueBase.js';
import type { Definition } from '../Definition.js';
import type { Identifier } from '../Identifier.js';
import type { SchemaToValueFn, SchemaType, TypeSystemOutput } from '../../types/TypeSystem.js';
import type { Inserted } from '../Inserted.js';
import type { ModelInsertable } from '../model/ModelInsertable.js';
import type { RefName } from '../../types/RefName.js';
export type OperationBaseArgs<EnrichmentType> = {
    context: GenerateContext;
    settings: ContentSettings<EnrichmentType>;
    generatorKey: GeneratorKey;
    operation: OasOperation;
};
type CreateAndRegisterDefinition<Schema extends SchemaType> = {
    schema: Schema;
    identifier: Identifier;
    schemaToValueFn: SchemaToValueFn;
};
export declare class OperationBase<EnrichmentType> extends ValueBase {
    settings: ContentSettings<EnrichmentType>;
    operation: OasOperation;
    generatorKey: GeneratorKey;
    constructor({ context, generatorKey, settings, operation }: OperationBaseArgs<EnrichmentType>);
    insertOperation<V extends GeneratedValue, ET>(insertable: OperationInsertable<V, ET>, operation: OasOperation): Inserted<V, 'force', ET>;
    insertModel<V extends GeneratedValue, ET>(insertable: ModelInsertable<V, ET>, refName: RefName): Inserted<V, 'force', ET>;
    createAndRegisterDefinition<Schema extends SchemaType>({ schema, identifier, schemaToValueFn }: CreateAndRegisterDefinition<Schema>): Definition<TypeSystemOutput<Schema['type']>>;
    register(args: Omit<RegisterArgs, 'destinationPath'>): void;
}
export {};
//# sourceMappingURL=OperationBase.d.ts.map