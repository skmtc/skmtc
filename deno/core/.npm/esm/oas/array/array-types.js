import { z } from 'zod';
import { oasSchemaData } from '../schema/schema-types.js';
import { oasSchemaRefData } from '../ref/ref-types.js';
export const oasArrayData = z.object({
    oasType: z.literal('schema'),
    // Add soon
    type: z.literal('array'),
    // additionalItems: z.lazy(() => z.union([z.boolean(), jsonSchema4]).optional()),
    items: z.lazy(() => z.union([oasSchemaData, oasSchemaRefData])),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.array(z.unknown()).optional()
    // Add soon
    // maxItems: z.number().optional(),
    // minItems: z.number().optional(),
    // uniqueItems: z.boolean().optional()
});
