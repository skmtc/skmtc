import { Badge } from '@/components/ui/badge'

type BadgeFormatterProps = {
  value: string
}

export const BadgeFormatter = ({ value }: BadgeFormatterProps) => {
  return <Badge>{value}</Badge>
}
