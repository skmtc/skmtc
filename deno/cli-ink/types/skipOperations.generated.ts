import { SkipPaths, skipPaths } from '@/types/skipPaths.generated.ts'
import { z } from 'zod'

export type SkipOperations = Record<string, SkipPaths>

export const skipOperations = z.record(z.string(), skipPaths)
