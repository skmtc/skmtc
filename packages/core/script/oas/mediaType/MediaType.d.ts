import type { OasRef } from '../ref/Ref.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasExample } from '../example/Example.js';
import type { ToJsonSchemaOptions } from '../schema/Schema.js';
import type { OpenAPIV3 } from 'openapi-types';
export type MediaTypeFields = {
    mediaType: string;
    schema?: OasSchema | OasRef<'schema'> | undefined;
    examples?: Record<string, OasExample | OasRef<'example'>> | undefined;
    extensionFields?: Record<string, unknown>;
};
export declare class OasMediaType {
    oasType: 'mediaType';
    mediaType: string;
    schema: OasSchema | OasRef<'schema'> | undefined;
    examples: Record<string, OasExample | OasRef<'example'>> | undefined;
    extensionFields: Record<string, unknown> | undefined;
    constructor(fields: MediaTypeFields);
    toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.MediaTypeObject;
}
//# sourceMappingURL=MediaType.d.ts.map