import type { OasRef } from '../ref/Ref.js';
import type { OasSchema } from '../schema/Schema.js';
import type { OasExample } from '../example/Example.js';
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
}
//# sourceMappingURL=MediaType.d.ts.map