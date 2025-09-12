import { z } from 'zod'
import { previewGroup } from '@/types/previewGroup.generated.ts'

export const previewModule = z.object({
  name: z.string(),
  exportPath: z.string(),
  group: previewGroup,
})
