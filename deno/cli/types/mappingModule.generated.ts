import { z } from 'zod'
import { previewGroup } from '@/types/previewGroup.generated.ts'

export const mappingModule = z.object({
  name: z.string(),
  exportPath: z.string(),
  group: previewGroup,
  itemType: z.enum(['input', 'formatter']),
  schema: z.string(),
})
