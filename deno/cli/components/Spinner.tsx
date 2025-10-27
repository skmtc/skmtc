import { Spinner as InkSpinner } from '@inkjs/ui'
import { Text } from 'ink'

// Extend the globalThis type to include our test flag
declare global {
  var __DENO_TEST__: boolean | undefined
}

type SpinnerProps = {
  label: string
}

export const Spinner = ({ label }: SpinnerProps) => {
  if (globalThis.__DENO_TEST__ === true) {
    return <Text>{`⠋ ${label}`}</Text>
  }

  return <InkSpinner label={label} />
}
