import { format } from 'date-fns'

import { z } from 'zod'

type DateFormatterProps = {
  value: string
}

const valueSchema = z.string().optional()

export const DateFormatter = ({ value }: DateFormatterProps) => {
  const parsed = valueSchema.safeParse(value)
  return <>{parsed.success && parsed.data ? format(new Date(parsed.data), 'dd MMM yyyy') : '-'}</>
}
