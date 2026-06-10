import { mappingModule } from '@/types/mappingModule.generated.ts'
import { oasOperationPreview } from '@/types/oasOperationPreview.generated.ts'
import { gqlOperationPreview } from '@/types/gqlOperationPreview.generated.ts'
import { modelPreview } from '@/types/modelPreview.generated.ts'
import { z } from 'zod'

export const mapping = z.object({
  module: mappingModule,
  source: z.union([oasOperationPreview, gqlOperationPreview, modelPreview]),
})
