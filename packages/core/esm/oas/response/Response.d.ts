import type { OasHeader } from '../header/Header.js';
import type { OasMediaType } from '../mediaType/MediaType.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasSchema } from '../schema/Schema.js';
import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type ResponseFields = {
    description?: string | undefined;
    headers?: Record<string, OasHeader | OasRef<'header'>> | undefined;
    content?: Record<string, OasMediaType> | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasResponse {
    oasType: 'response';
    description: string | undefined;
    headers: Record<string, OasHeader | OasRef<'header'>> | undefined;
    content: Record<string, OasMediaType> | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: ResponseFields);
    isRef(): this is OasRef<'response'>;
    resolve(): OasResponse;
    resolveOnce(): OasResponse;
    toSchema(mediaType?: string): OasSchema | OasRef<'schema'> | undefined;
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ResponseObject;
}
//# sourceMappingURL=Response.d.ts.map