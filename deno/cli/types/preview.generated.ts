import { previewModule } from '@/types/previewModule.generated.ts'
import { operationPreview } from '@/types/operationPreview.generated.ts'
import { modelPreview } from '@/types/modelPreview.generated.ts'
import { z } from 'zod'

export const preview = z.object({
  module: previewModule,
  source: z.union([operationPreview, modelPreview]),
})
