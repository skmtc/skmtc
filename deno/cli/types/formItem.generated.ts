import {
  FormFieldItem,
  formFieldItem,
} from '@/types/formFieldItem.generated.ts'
import { z } from 'zod'

export type FormItem = {
  title?: string | undefined
  description?: string | undefined
  fields?: Array<FormFieldItem> | undefined
  submitLabel?: string | undefined
}

export const formItem = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(formFieldItem).optional(),
  submitLabel: z.string().optional(),
})
