import { useSkmtc } from './SkmtcContext.tsx'
import { Box } from 'ink'
import { match, P } from 'ts-pattern'
import { StatusMessage } from '@inkjs/ui'
import { Text } from 'ink'

export const MessageBox = () => {
  const { state } = useSkmtc()

  if (!state.message) {
    return null
  }

  return (
    <Box flexDirection="column" paddingLeft={2} paddingBottom={1}>
      {match(state.message)
        .with({ error: P.any }, ({ error }) => (
          <StatusMessage variant="error">{error}</StatusMessage>
        ))
        .with({ success: P.any }, ({ success }) => (
          <StatusMessage variant="success">{success}</StatusMessage>
        ))
        .with({ info: P.any }, ({ info }) => <StatusMessage variant="info">{info}</StatusMessage>)

        .exhaustive()}
      {state.message.sub ? <Text dimColor>{`  ${state.message.sub}`}</Text> : null}
    </Box>
  )
}
