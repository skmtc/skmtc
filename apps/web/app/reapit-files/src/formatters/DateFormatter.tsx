import { format } from 'date-fns'

type DateFormatterProps = {
  value: string
}

export const DateFormatter = ({ value }: DateFormatterProps) => {
  return <>{value ? format(new Date(value), 'dd MMM yyyy') : '-'}</>
}
