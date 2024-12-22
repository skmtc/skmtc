import type { ParseContext } from '../../context/ParseContext.js';
import type { OpenAPIV3 } from 'openapi-types';
import { OasResponse } from './Response.js';
import type { OasRef } from '../ref/Ref.js';
type ToResponsesV3Args = {
    responses: OpenAPIV3.ResponsesObject;
    context: ParseContext;
};
export declare const toResponsesV3: ({ responses, context }: ToResponsesV3Args) => Record<string, OasResponse | OasRef<"response">>;
type ToOptionalResponsesV3Args = {
    responses: OpenAPIV3.ResponsesObject | undefined;
    context: ParseContext;
};
export declare const toOptionalResponsesV3: ({ responses, context }: ToOptionalResponsesV3Args) => Record<string, OasResponse | OasRef<"response">> | undefined;
type ToResponseV3Args = {
    response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject;
    context: ParseContext;
};
export declare const toResponseV3: ({ response, context }: ToResponseV3Args) => OasResponse | OasRef<"response">;
export {};
//# sourceMappingURL=toResponseV3.d.ts.map