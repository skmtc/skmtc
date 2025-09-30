import React from 'react'
import { Box, Text } from 'ink'
import type { Project } from '@/lib/project.ts'
import type { ViewStateServe } from '@/components/SkmtcContext.tsx'

type ServeViewProps = {
  project: Project
  view: ViewStateServe
}

export const ServeView = ({ project, view }: ServeViewProps) => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="red">
        The serve command requires Deno runtime features and is not available in Node.js environment.
      </Text>
      <Text>
        To serve your project using Deno run: deno run jsr:@skmtc/cli serve {project.name} {view.port || '8001'}
      </Text>
    </Box>
  )
}
