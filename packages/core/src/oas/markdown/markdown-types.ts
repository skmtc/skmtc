import { z } from '@hono/zod-openapi'

export const markdown: z.ZodType<string> = z.string()
