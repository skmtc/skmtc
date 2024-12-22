import { z } from 'zod';
export const oasBooleanData = z.object({
    oasType: z.literal('schema'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.boolean().optional(),
    type: z.literal('boolean')
});
