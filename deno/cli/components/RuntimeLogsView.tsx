import { ViewStateRuntimeLogs } from './SkmtcContext.tsx'
import type { Project } from '../lib/project.ts'
import type { RemoteProject } from '../lib/remote-project.ts'
import { Box, Text } from 'ink'

type RuntimeLogsViewProps = {
  project: Project | RemoteProject
  view: ViewStateRuntimeLogs
}

export const RuntimeLogsView = ({ project, view }: RuntimeLogsViewProps) => {
  return (
    <Box flexDirection="column">
      <Text>Runtime Logs</Text>
    </Box>
  )
}
