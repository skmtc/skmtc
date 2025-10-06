import { Box, Text, useInput } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'

export const ShortcutsView = () => {
  const { state } = useSkmtc()

  useInput((input, key) => {
    for (const shortcut of state.shortcuts) {
      shortcut.action(input, key)
    }
  })

  if (state.shortcuts.length === 0) {
    return null
  }

  return (
    <Box flexDirection="row" marginLeft={2} marginTop={1}>
      <Text dimColor>Shortcuts:</Text>
      <Box flexDirection="row" justifyContent="space-between" marginLeft={1}>
        {state.shortcuts.map(({ id, label }) => (
          <Text key={id} dimColor>
            {label}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
