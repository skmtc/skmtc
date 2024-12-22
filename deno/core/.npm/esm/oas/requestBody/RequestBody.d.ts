import type { OasMediaType } from '../mediaType/MediaType.js';
import type { OasRef } from '../ref/Ref.js';
import type { OasSchema } from '../schema/Schema.js';
export type RequestBodyFields = {
    description?: string | undefined;
    content: Record<string, OasMediaType>;
    required?: boolean | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasRequestBody {
    oasType: 'requestBody';
    description: string | undefined;
    content: Record<string, OasMediaType>;
    required: boolean | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: RequestBodyFields);
    isRef(): this is OasRef<'requestBody'>;
    resolve(): OasRequestBody;
    resolveOnce(): OasRequestBody;
    toSchema(mediaType?: string): OasSchema | OasRef<'schema'> | undefined;
}
//# sourceMappingURL=RequestBody.d.ts.map