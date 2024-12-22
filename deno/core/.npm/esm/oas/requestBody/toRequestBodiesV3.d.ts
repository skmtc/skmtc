import type { OpenAPIV3 } from 'openapi-types';
import type { ParseContext } from '../../context/ParseContext.js';
import { OasRequestBody } from './RequestBody.js';
import type { OasRef } from '../ref/Ref.js';
type ToRequestBodyV3Args = {
    requestBody: OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject | undefined;
    forceRef?: boolean;
    context: ParseContext;
};
export declare const toRequestBodyV3: ({ requestBody, context }: ToRequestBodyV3Args) => OasRequestBody | OasRef<"requestBody"> | undefined;
type ToRequestBodiesV3Args = {
    requestBodies: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject> | undefined;
    context: ParseContext;
};
export declare const toRequestBodiesV3: ({ requestBodies, context }: ToRequestBodiesV3Args) => Record<string, OasRequestBody | OasRef<"requestBody">> | undefined;
export {};
//# sourceMappingURL=toRequestBodiesV3.d.ts.map