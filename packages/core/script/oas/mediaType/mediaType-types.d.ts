import { type OasExampleData } from '../example/example-types.js';
import { type OasExampleRefData, type OasSchemaRefData } from '../ref/ref-types.js';
import { type OasSchemaData } from '../schema/schema-types.js';
import { z } from '@hono/zod-openapi';
export type OasMediaTypeData = {
    oasType: 'mediaType';
    mediaType: string;
    schema?: OasSchemaData | OasSchemaRefData;
    examples?: Record<string, OasExampleData | OasExampleRefData>;
};
export declare const oasMediaTypeData: z.ZodType<OasMediaTypeData>;
//# sourceMappingURL=mediaType-types.d.ts.map