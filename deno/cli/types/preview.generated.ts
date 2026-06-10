import { previewModule } from '@/types/previewModule.generated.ts'
import { oasOperationPreview } from '@/types/oasOperationPreview.generated.ts'
import { gqlOperationPreview } from '@/types/gqlOperationPreview.generated.ts'
import { modelPreview } from '@/types/modelPreview.generated.ts'
import { z } from 'zod'

export const preview = z.object({
  module: previewModule,
  source: z.union([oasOperationPreview, gqlOperationPreview, modelPreview]),
})
