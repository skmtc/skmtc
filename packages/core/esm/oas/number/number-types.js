import { z } from '@hono/zod-openapi';
export const oasNumberData = z.object({
    oasType: z.literal('schema'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.number().optional(),
    type: z.literal('number')
    // Add soon
    // multipleOf: z.number().optional(),
    // maximum: z.number().optional(),
    // exclusiveMaximum: z.boolean().optional(),
    // minimum: z.number().optional(),
    // exclusiveMinimum: z.boolean().optional()
});
