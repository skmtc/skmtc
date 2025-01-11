import type { GenerateContext } from '../../context/GenerateContext.js';
import type { OasOperation } from '../../oas/operation/Operation.js';
import type { Identifier } from '../Identifier.js';
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js';
import type { IsSupportedOperationArgs, OperationInsertableArgs } from './OperationInsertable.js';
import type { z } from 'zod';
export type ToOperationInsertableArgs<EnrichmentType> = {
    id: string;
    toIdentifier: (operation: OasOperation) => Identifier;
    toExportPath: (operation: OasOperation) => string;
    isSupported?: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    pinnable?: boolean;
};
type ToEnrichmentsArgs = {
    operation: OasOperation;
    context: GenerateContext;
};
export declare const toOperationInsertable: <EnrichmentType>(config: ToOperationInsertableArgs<EnrichmentType>) => {
    new (args: OperationInsertableArgs<EnrichmentType>): {
        settings: import("../ContentSettings.js").ContentSettings<EnrichmentType>;
        operation: OasOperation;
        generatorKey: import("../../types/GeneratorKeys.js").GeneratorKey;
        insertOperation<V extends import("../../mod.js").GeneratedValue, ET>(insertable: import("./OperationInsertable.js").OperationInsertable<V, ET>, operation: OasOperation): import("../Inserted.js").Inserted<V, "force", ET>;
        insertModel<V extends import("../../mod.js").GeneratedValue, ET_1>(insertable: import("../model/ModelInsertable.js").ModelInsertable<V, ET_1>, refName: import("../../mod.js").RefName): import("../Inserted.js").Inserted<V, "force", ET_1>;
        createAndRegisterDefinition<Schema extends import("../../mod.js").SchemaType>({ schema, identifier, schemaToValueFn }: {
            schema: Schema;
            identifier: Identifier;
            schemaToValueFn: import("../../mod.js").SchemaToValueFn;
        }): import("../Definition.js").Definition<import("../../mod.js").TypeSystemOutput<Schema["type"]>>;
        register(args: import("../../context/GenerateContext.js").BaseRegisterArgs): void;
        context: GenerateContext;
        skipped: boolean;
    };
    id: string;
    type: "operation";
    _class: "OperationInsertable";
    toIdentifier: (operation: OasOperation) => Identifier;
    toExportPath: (operation: OasOperation) => string;
    toEnrichmentRequest: ((operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined) | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType;
    isSupported: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    pinnable: boolean;
};
export {};
//# sourceMappingURL=toOperationInsertable.d.ts.map