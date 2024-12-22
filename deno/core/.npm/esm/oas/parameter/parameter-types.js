import { oasExampleData } from '../example/example-types.js';
import { markdown } from '../markdown/markdown-types.js';
import { oasMediaTypeData } from '../mediaType/mediaType-types.js';
import { oasExampleRefData, oasSchemaRefData } from '../ref/ref-types.js';
import { oasSchemaData } from '../schema/schema-types.js';
import { z } from 'zod';
export const oasParameterLocation = z.enum([
    'query',
    'header',
    'path',
    'cookie'
]);
export const oasParameterStyle = z.enum([
    'matrix',
    'label',
    'form',
    'simple',
    'spaceDelimited',
    'pipeDelimited',
    'deepObject'
]);
export const oasParameterData = z.object({
    oasType: z.literal('parameter'),
    // Default values (based on value of in): for query - form; for path - simple; for header - simple; for cookie - form.
    // example: z.any().optional(),
    allowReserved: z.boolean().optional(),
    allowEmptyValue: z.boolean().optional(),
    content: z.record(oasMediaTypeData).optional(),
    deprecated: z.boolean().optional(),
    description: markdown.optional(),
    examples: z.record(z.union([oasExampleData, oasExampleRefData])).optional(),
    explode: z.boolean(),
    location: oasParameterLocation,
    name: z.string(),
    required: z.boolean().optional(),
    schema: z.union([oasSchemaData, oasSchemaRefData]).optional(),
    style: oasParameterStyle
});
