import { z } from 'zod';
export const oasIntegerData = z
    .object({
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.number().int().optional(),
    format: z.union([z.literal('int32'), z.literal('int64')]).optional(),
    enum: z.array(z.number()).optional(),
    type: z.literal('integer'),
    nullable: z.boolean().optional(),
    example: z.number().int().optional().catch(undefined)
    // Add soon
    // multipleOf: z.number().optional(),
    // maximum: z.number().optional(),
    // exclusiveMaximum: z.boolean().optional(),
    // minimum: z.number().optional(),
    // exclusiveMinimum: z.boolean().optional()
})
    .passthrough();
