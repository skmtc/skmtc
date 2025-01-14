import { z } from 'zod'

type NumberFormatterProps = {
  value?: string
}

const valueSchema = z.number().optional()

export const NumberFormatter = ({ value }: NumberFormatterProps) => {
  const parsed = valueSchema.safeParse(value)
  return <>{parsed.success ? parsed.data : '-'}</>
}
