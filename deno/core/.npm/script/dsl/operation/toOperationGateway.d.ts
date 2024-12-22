import type { OasOperation } from '../../oas/operation/Operation.js';
import { type OperationGatewayArgs } from '../GatewayBase.js';
import type { Identifier } from '../Identifier.js';
export type ToOperationGatewayArgs = {
    id: string;
    toIdentifier: () => Identifier;
    toExportPath: () => string;
    isSupported?: (operation: OasOperation) => boolean;
};
export declare const toOperationGateway: (config: ToOperationGatewayArgs) => {
    new ({ context, settings }: OperationGatewayArgs): {
        settings: import("../ContentSettings.js").ContentSettings;
        register(args: Omit<import("../../mod.js").RegisterArgs, "destinationPath">): void;
        context: import("../../mod.js").GenerateContext;
        skipped: boolean;
        generatorKey: import("../../mod.js").GeneratorKey | undefined;
    };
    id: string;
    type: "operation";
    _class: "OperationGateway";
    toIdentifier: () => Identifier;
    toExportPath: () => string;
    isSupported: (operation: OasOperation) => boolean;
    pinnable: boolean;
};
//# sourceMappingURL=toOperationGateway.d.ts.map