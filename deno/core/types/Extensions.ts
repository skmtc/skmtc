import { z } from 'npm:zod@3.24.1'

export type Extensions = { [k: string]: string | Extensions }

export const extensions: z.ZodType<Extensions> = z.record(
  z.union([z.string(), z.lazy(() => extensions)])
)
