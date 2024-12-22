import { oasExampleData } from '../example/example-types.js';
import { oasExampleRefData, oasSchemaRefData } from '../ref/ref-types.js';
import { oasSchemaData } from '../schema/schema-types.js';
import { z } from 'zod';
export const oasMediaTypeData = z.object({
    oasType: z.literal('mediaType'),
    mediaType: z.string(),
    schema: z.union([oasSchemaData, oasSchemaRefData]).optional(),
    // example: z.any().optional(),
    examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional()
    // encoding: z.lazy(() => z.record(encoding).optional())
});
