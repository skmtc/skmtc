import { StatusIndicator } from '@reapit/elements'

type ActiveFormatterProps = {
  value: boolean
}

export const ActiveFormatter = ({ value }: ActiveFormatterProps) => {
  return (
    <>
      <StatusIndicator intent={value ? 'success' : 'danger'} /> {value ? 'Active' : 'Inactive'}{' '}
    </>
  )
}
