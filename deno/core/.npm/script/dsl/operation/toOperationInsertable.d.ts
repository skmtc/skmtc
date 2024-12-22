import type { GenerateContext } from '../../context/GenerateContext.js';
import type { OasOperation } from '../../oas/operation/Operation.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { Identifier } from '../Identifier.js';
export type OperationInsertableArgs = {
    context: GenerateContext;
    settings: ContentSettings;
    operation: OasOperation;
};
export type ToOperationInsertableArgs = {
    id: string;
    toIdentifier: (operation: OasOperation) => Identifier;
    toExportPath: (operation: OasOperation) => string;
    isSupported?: (operation: OasOperation) => boolean;
    pinnable?: boolean;
};
export declare const toOperationInsertable: (config: ToOperationInsertableArgs) => {
    new (args: OperationInsertableArgs): {
        settings: ContentSettings;
        operation: OasOperation;
        generatorKey: import("../../types/GeneratorKeys.js").GeneratorKey;
        insertOperation<V extends import("../../mod.js").GeneratedValue>(insertable: import("./OperationInsertable.js").OperationInsertable<V>, operation: OasOperation): import("../Inserted.js").Inserted<V, "force">;
        insertModel<V extends import("../../mod.js").GeneratedValue>(insertable: import("../model/ModelInsertable.js").ModelInsertable<V>, refName: import("../../mod.js").RefName): import("../Inserted.js").Inserted<V, "force">;
        createAndRegisterDefinition<Schema extends import("../../mod.js").SchemaType>({ schema, identifier, schemaToValueFn }: {
            schema: Schema;
            identifier: Identifier;
            schemaToValueFn: import("../../mod.js").SchemaToValueFn;
        }): import("../Definition.js").Definition<import("../../mod.js").TypeSystemOutput<Schema["type"]>>;
        register(args: Omit<import("../../context/GenerateContext.js").RegisterArgs, "destinationPath">): void;
        context: GenerateContext;
        skipped: boolean;
    };
    id: string;
    type: "operation";
    _class: "OperationInsertable";
    toIdentifier: (operation: OasOperation) => Identifier;
    toExportPath: (operation: OasOperation) => string;
    isSupported: (operation: OasOperation) => boolean;
    pinnable: boolean;
};
//# sourceMappingURL=toOperationInsertable.d.ts.map