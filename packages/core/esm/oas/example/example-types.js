import { markdown } from '../markdown/markdown-types.js';
import { z } from '@hono/zod-openapi';
export const oasExampleData = z.object({
    oasType: z.literal('example'),
    summary: z.string().optional(),
    description: markdown.optional(),
    value: z.unknown().optional()
    // externalValue: url.optional()
});
