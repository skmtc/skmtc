import "../_dnt.polyfills.js";
import { z } from 'zod'

export type Extensions = { [k: string]: string | Extensions }

export const extensions: z.ZodType<Extensions> = z.record(
  z.union([z.string(), z.lazy(() => extensions)])
)
