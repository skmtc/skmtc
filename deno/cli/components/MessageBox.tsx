import { useSkmtc } from './SkmtcContext.tsx'
import { Box } from 'ink'
import { StatusMessage } from '@inkjs/ui'
import { Text } from 'ink'

export const MessageBox = () => {
  const { state } = useSkmtc()

  if (!state.message) {
    return null
  }

  const paddingTop = state.interactive ? 0 : 1
  const message = state.message

  const renderMessage = () => {
    const content = message.content
    if ('error' in content) {
      return <StatusMessage variant="error">{content.error}</StatusMessage>
    } else if ('success' in content) {
      return <StatusMessage variant="success">{content.success}</StatusMessage>
    } else {
      return <StatusMessage variant="info">{content.info}</StatusMessage>
    }
  }

  return (
    <Box flexDirection="column" paddingLeft={2} paddingBottom={1} paddingTop={paddingTop}>
      {renderMessage()}
      {message.content.sub ? <Text dimColor>{`  ${message.content.sub}`}</Text> : null}
    </Box>
  )
}
