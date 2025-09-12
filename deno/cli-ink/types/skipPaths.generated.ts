import { Method, method } from '@/types/method.generated.ts'
import { z } from 'zod'

export type SkipPaths = Record<string, Array<Method>>

export const skipPaths = z.record(z.string(), z.array(method))
