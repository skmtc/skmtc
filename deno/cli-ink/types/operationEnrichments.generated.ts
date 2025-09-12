import { TableItem, tableItem } from '@/types/tableItem.generated.ts'
import { FormItem, formItem } from '@/types/formItem.generated.ts'
import { InputItem, inputItem } from '@/types/inputItem.generated.ts'
import { z } from 'zod'

export type OperationEnrichments = {
  table?: TableItem | undefined
  form?: FormItem | undefined
  input?: InputItem | undefined
}

export const operationEnrichments = z.object({
  table: tableItem.optional(),
  form: formItem.optional(),
  input: inputItem.optional(),
})
