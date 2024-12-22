import type { Method } from '../../types/Method.js';
import type { OasPathItem } from '../pathItem/PathItem.js';
import type { OasParameter } from '../parameter/Parameter.js';
import type { OasRequestBody } from '../requestBody/RequestBody.js';
import type { OasResponse } from '../response/Response.js';
import type { OasParameterLocation } from '../parameter/parameter-types.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasRef } from '../ref/Ref.js';
import { OasObject } from '../object/Object.js';
export type OperationFields = {
    path: string;
    method: Method;
    pathItem: OasPathItem;
    operationId?: string | undefined;
    summary?: string | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    parameters?: (OasParameter | OasRef<'parameter'>)[] | undefined;
    requestBody?: OasRequestBody | OasRef<'requestBody'> | undefined;
    responses: Record<string, OasResponse | OasRef<'response'>>;
    deprecated?: boolean | undefined;
    extensionFields?: Record<string, unknown>;
};
type ToRequestBodyMapArgs = {
    schema: OasSchema | OasRef<'schema'>;
    requestBody: OasRequestBody;
};
/** Operation represents a resource path and a method that can be enacted against it */
export declare class OasOperation {
    oasType: 'operation';
    path: string;
    method: Method;
    pathItem: OasPathItem;
    operationId: string | undefined;
    summary: string | undefined;
    tags: string[] | undefined;
    description: string | undefined;
    parameters: (OasParameter | OasRef<'parameter'>)[] | undefined;
    requestBody: OasRequestBody | OasRef<'requestBody'> | undefined;
    responses: Record<string, OasResponse | OasRef<'response'>>;
    deprecated: boolean | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: OperationFields);
    toSuccessResponse(): OasResponse | OasRef<'response'>;
    toRequestBody<V>(map: ({ schema, requestBody }: ToRequestBodyMapArgs) => V, mediaType?: string): V | undefined;
    /**
     * Resolve all parameters and optionally filter by location
     *
     * @param filter - only include parameters from specified locations
     * @returns
     */
    toParams(filter?: OasParameterLocation[]): OasParameter[];
    toParametersObject(filter?: OasParameterLocation[]): OasObject;
}
export {};
//# sourceMappingURL=Operation.d.ts.map