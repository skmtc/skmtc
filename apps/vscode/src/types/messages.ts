import { z } from 'zod'

export const updateSettingMessage = z.object({
  command: z.literal('updateSetting'),
  payload: z.object({
    stackTrail: z.string(),
    value: z.boolean(),
    fromForm: z.boolean()
  })
})

export type UpdateSettingMessage = z.infer<typeof updateSettingMessage>
