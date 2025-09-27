import { Box, Text } from 'ink'
import { toRelativeRootPath } from '../lib/to-root-path.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const AppInfo = () => {
  const appRootPath = toRelativeRootPath()

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderDimColor
      width="auto"
      paddingLeft={1}
      paddingRight={1}
      marginLeft={1}
      marginRight={1}
      marginBottom={1}
    >
      <Box flexDirection="row" marginBottom={1}>
        <Text dimColor>{'>_ '}</Text>
        <Text color="white">Skmtc CLI </Text>
        <Text dimColor>{`(v${denoJson.version})`}</Text>
      </Box>

      <Box flexDirection="row">
        <Text dimColor>directory: </Text>
        <Text>{appRootPath}</Text>
      </Box>
    </Box>
  )
}
