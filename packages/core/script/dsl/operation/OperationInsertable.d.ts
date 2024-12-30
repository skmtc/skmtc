import type { OasOperation } from '../../oas/operation/Operation.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { GenerateContext } from '../../context/GenerateContext.js';
import type { Identifier } from '../Identifier.js';
import type { EnrichmentRequest } from '../../types/EnrichmentRequest.js';
import type { z } from 'zod';
export type OperationInsertableArgs<EnrichmentType> = {
    context: GenerateContext;
    settings: ContentSettings<EnrichmentType>;
    operation: OasOperation;
};
export type WithTransformOperation = {
    transformOperation: (operation: OasOperation) => void;
};
export type OperationOperationGatewayArgs<EnrichmentType> = {
    context: GenerateContext;
    settings: ContentSettings<EnrichmentType>;
};
export type IsSupportedOperationArgs<EnrichmentType> = {
    operation: OasOperation;
    enrichments: EnrichmentType;
    context: GenerateContext;
};
type ToEnrichmentsArgs = {
    operation: OasOperation;
    context: GenerateContext;
};
export type OperationGateway<EnrichmentType> = {
    new ({ context, settings }: OperationOperationGatewayArgs<EnrichmentType>): WithTransformOperation;
    id: string;
    type: 'operation';
    _class: 'OperationGateway';
    toIdentifier: () => Identifier;
    toExportPath: () => string;
    toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType;
    isSupported: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    pinnable: boolean;
};
export type OperationInsertable<V, EnrichmentType> = {
    prototype: V;
} & {
    new ({ context, settings, operation }: OperationInsertableArgs<EnrichmentType>): V;
    id: string;
    type: 'operation';
    _class: 'OperationInsertable';
    toIdentifier: (operation: OasOperation) => Identifier;
    toExportPath: (operation: OasOperation) => string;
    toEnrichmentRequest?: (operation: OasOperation) => EnrichmentRequest<EnrichmentType> | undefined;
    toEnrichmentSchema: () => z.ZodType<EnrichmentType>;
    toEnrichments: ({ operation, context }: ToEnrichmentsArgs) => EnrichmentType;
    isSupported: ({ operation, enrichments, context }: IsSupportedOperationArgs<EnrichmentType>) => boolean;
    pinnable: boolean;
} & Function;
export {};
//# sourceMappingURL=OperationInsertable.d.ts.map