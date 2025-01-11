import { z } from '@hono/zod-openapi';
export const oasUnknownData = z.object({
    oasType: z.literal('schema'),
    title: z.string().optional(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    type: z.literal('unknown')
});
