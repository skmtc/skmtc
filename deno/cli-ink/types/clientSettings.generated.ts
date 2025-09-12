import {
  ModulePackage,
  modulePackage,
} from '@/types/modulePackage.generated.ts'
import {
  PathEnrichments,
  pathEnrichments,
} from '@/types/pathEnrichments.generated.ts'
import {
  SkipOperations,
  skipOperations,
} from '@/types/skipOperations.generated.ts'
import { SkipModels, skipModels } from '@/types/skipModels.generated.ts'
import { z } from 'zod'

export type ClientSettings = {
  basePath?: string | undefined
  packages?: Array<ModulePackage> | undefined
  enrichments?: Record<string, PathEnrichments> | undefined
  skip?: Array<SkipOperations | SkipModels | string> | undefined
}

export const clientSettings = z.object({
  basePath: z.string().optional(),
  packages: z.array(modulePackage).optional(),
  enrichments: z.record(z.string(), pathEnrichments).optional(),
  skip: z.array(z.union([skipOperations, skipModels, z.string()])).optional(),
})
