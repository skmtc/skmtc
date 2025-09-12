import {
  OperationEnrichments,
  operationEnrichments,
} from '@/types/operationEnrichments.generated.ts'
import { z } from 'zod'

export type MethodEnrichments = Record<string, OperationEnrichments>

export const methodEnrichments = z.record(z.string(), operationEnrichments)
