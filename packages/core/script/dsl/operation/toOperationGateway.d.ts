import type { OasOperation } from '../../oas/operation/Operation.js';
import { type OperationGatewayArgs } from '../GatewayBase.js';
import type { Identifier } from '../Identifier.js';
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js';
import type { IsSupportedOperationArgs } from './OperationInsertable.js';
import type { GenerateContext } from '../../context/GenerateContext.js';
import type { z } from 'zod';
export type ToOperationGatewayArgs<EnrichmentType> = {
    id: string;
    toIdentifier: () => Identifier;
    toExportPath: () => string;
    isSupported?: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
};
type ToEnrichmentsArgs = {
    operation: OasOperation;
    context: GenerateContext;
};
export declare const toOperationGateway: <EnrichmentType>(config: ToOperationGatewayArgs<EnrichmentType>) => {
    new ({ context, settings }: OperationGatewayArgs): {
        settings: import("../ContentSettings.js").ContentSettings<undefined>;
        register(args: Omit<import("../../context/GenerateContext.js").RegisterArgs, "destinationPath">): void;
        context: GenerateContext;
        skipped: boolean;
        generatorKey: import("../../mod.js").GeneratorKey | undefined;
    };
    id: string;
    type: "operation";
    _class: "OperationGateway";
    toIdentifier: () => Identifier;
    toExportPath: () => string;
    toEnrichmentRequest: ((operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined) | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType;
    isSupported: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    pinnable: boolean;
};
export {};
//# sourceMappingURL=toOperationGateway.d.ts.map