import { z } from 'zod';
export const oasNullData = z.object({
    oasType: z.literal('schema'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.null().optional(),
    type: z.literal('null')
});
