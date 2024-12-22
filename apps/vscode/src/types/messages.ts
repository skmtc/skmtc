import { z } from 'zod';
import { settingMeta } from './SettingMeta';

export const updateSettingMessage = z.object({
  command: z.literal('updateSetting'),
  payload: z.object({
    stackTrail: z.string(),
    value: z.boolean(),
    fromForm: z.boolean(),
  }),
});

export type UpdateSettingMessage = z.infer<typeof updateSettingMessage>;

export const toggleSettingPayload = z.object({
  selected: z.boolean(),
  meta: settingMeta,
});

export type ToggleSettingPayload = z.infer<typeof toggleSettingPayload>;

export const toggleSettingMessage = z.object({
  command: z.literal('toggleSetting'),
  payload: toggleSettingPayload,
});

export type ToggleSettingMessage = z.infer<typeof toggleSettingMessage>;
