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
      <Box flexDirection="row" justifyContent="space-between">
        {state.shortcuts.map(({ id, label }, index, array) => (
          <Box marginRight={1} key={id}>
            <Text dimColor>{label}</Text>
            {index !== array.length - 1 && <Text dimColor>,</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
