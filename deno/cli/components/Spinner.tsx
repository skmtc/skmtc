import { Spinner as InkSpinner } from '@inkjs/ui'
import { Text } from 'ink'

type SpinnerProps = {
  label: string
}

export const Spinner = ({ label }: SpinnerProps) => {
  // @ts-ignore - Check global test flag
  if (globalThis.__DENO_TEST__ === true) {
    return <Text>{`⠋ ${label}`}</Text>
  }

  return <InkSpinner label={label} />
}
