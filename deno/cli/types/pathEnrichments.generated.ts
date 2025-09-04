import {
  MethodEnrichments,
  methodEnrichments,
} from '@/types/methodEnrichments.generated.ts'
import { z } from 'zod'

export type PathEnrichments = Record<string, MethodEnrichments>

export const pathEnrichments = z.record(z.string(), methodEnrichments)
