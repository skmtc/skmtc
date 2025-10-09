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

  const paddingTop = state.interactive ? 0 : 1

  return (
    <Box flexDirection="column" paddingLeft={2} paddingBottom={1} paddingTop={paddingTop}>
      {match(state.message.content)
        .with({ error: P.any }, ({ error }) => (
          <StatusMessage variant="error">{error}</StatusMessage>
        ))
        .with({ success: P.any }, ({ success }) => (
          <StatusMessage variant="success">{success}</StatusMessage>
        ))
        .with({ info: P.any }, ({ info }) => <StatusMessage variant="info">{info}</StatusMessage>)

        .exhaustive()}
      {state.message.content.sub ? <Text dimColor>{`  ${state.message.content.sub}`}</Text> : null}
    </Box>
  )
}
