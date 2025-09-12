import { z } from 'zod'

export type SkipModels = Record<string, Array<string>>

export const skipModels = z.record(z.string(), z.array(z.string()))
