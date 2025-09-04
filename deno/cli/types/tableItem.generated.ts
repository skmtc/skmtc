import {
  TableColumnItem,
  tableColumnItem,
} from '@/types/tableColumnItem.generated.ts'
import { z } from 'zod'

export type TableItem = {
  title?: string | undefined
  description?: string | undefined
  columns?: Array<TableColumnItem> | undefined
}

export const tableItem = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  columns: z.array(tableColumnItem).optional(),
})
