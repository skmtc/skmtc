import { z } from 'zod'

type TextFormatterProps = {
  value: string | undefined | null
}

const valueSchema = z.string().optional().nullable()

export const TextFormatter = ({ value }: TextFormatterProps) => {
  const parsed = valueSchema.safeParse(value)
  return <>{parsed.success ? parsed.data : '-'}</>
}
