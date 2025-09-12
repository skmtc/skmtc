import { mappingModule } from '@/types/mappingModule.generated.ts'
import { operationPreview } from '@/types/operationPreview.generated.ts'
import { modelPreview } from '@/types/modelPreview.generated.ts'
import { z } from 'zod'

export const mapping = z.object({
  module: mappingModule,
  source: z.union([operationPreview, modelPreview]),
})
