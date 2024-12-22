import { z } from 'npm:zod@3.23.4'

export type Extensions = { [k: string]: string | Extensions }

export const extensions: z.ZodType<Extensions> = z.record(
  z.union([z.string(), z.lazy(() => extensions)])
)
