import { Box, Text } from 'ink'
import { toRelativeRootPath } from '@/lib/to-root-path.ts'
import denoJson from '../deno.json' with { type: 'json' }
import { useSkmtc, useProjectName } from '@/components/SkmtcContext.tsx'
import { focusColor } from '@/lib/colors.ts'

export const AppInfo = () => {
  const { state } = useSkmtc()

  const projectName = useProjectName()
  const appRootPath = toRelativeRootPath()

  if (!state.interactive) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderDimColor
      width="auto"
      paddingLeft={1}
      paddingRight={1}
      marginBottom={state.message ? 0 : 1}
    >
      <TopRow />
      <BottomRow projectName={projectName} appRootPath={appRootPath} />
    </Box>
  )
}

export const TopRow = () => {
  return (
    <Box flexDirection="row" marginBottom={1} justifyContent="space-between">
      <Box flexDirection="row">
        <Text color={focusColor}>＊ </Text>
        <Text color="white">Skmtc CLI </Text>
        <Text dimColor>{`(v${denoJson.version})`}</Text>
      </Box>
    </Box>
  )
}

type BottomRowProps = {
  projectName: string | undefined
  appRootPath: string
}

export const BottomRow = ({ projectName, appRootPath }: BottomRowProps) => {
  return (
    <Box flexDirection="row" justifyContent="space-between">
      {projectName ? (
        <Box flexDirection="row">
          <Text dimColor>project: </Text>
          <Text>{projectName}</Text>
        </Box>
      ) : (
        <Box></Box>
      )}

      <Box flexDirection="row">
        <Text dimColor>directory: </Text>
        <Text>{appRootPath}</Text>
      </Box>
    </Box>
  )
}
