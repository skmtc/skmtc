import dayjs from 'dayjs'
import { z } from 'zod'

type DateFormatterProps = {
  value: string
}

const valueSchema = z.string().optional()

export const DateFormatter = ({ value }: DateFormatterProps) => {
  const parsed = valueSchema.safeParse(value)
  if (!parsed.success || !parsed.data) {
    return <>{'-'}</>
  }

  return <>{dayjs(new Date(parsed.data)).format('dd MMM yyyy')}</>
}
