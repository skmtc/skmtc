import { z } from 'zod';
import { oasSchemaData } from '../schema/schema-types.js';
import { oasSchemaRefData } from '../ref/ref-types.js';
export const oasObjectData = z.object({
    oasType: z.literal('schema'),
    type: z.literal('object'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.object({}).optional(),
    // Add soon
    // maxProperties: z.number().optional(),
    // Add soon
    // minProperties: z.number().optional(),
    properties: z.lazy(() => {
        return z.record(z.union([oasSchemaData, oasSchemaRefData])).optional();
    }),
    // Add soon
    // patternProperties: z.lazy(() => z.record(jsonSchema4).optional()),
    required: z.array(z.string()).optional(),
    // allOf: z.lazy(() => z.array(oasObject).optional()),
    // Use oneOf instead of anyOf
    // anyOf: z.lazy(() => z.array(jsonSchema4).optional()),
    // oneOf: z.lazy(() => z.array(oasObject).optional()),
    additionalProperties: z.lazy(() => {
        return z.union([z.boolean(), oasSchemaData, oasSchemaRefData]).optional();
    })
});
