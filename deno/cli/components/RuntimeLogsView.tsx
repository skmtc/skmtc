import React from 'react'
import { type ViewStateRuntimeLogs, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'
import { getRuntimeLogs } from '@/services/getRuntimeLogs.ts'
import invariant from 'tiny-invariant'
import { useShortcut } from './useShortcut.tsx'

type RuntimeLogsViewProps = {
  project: Project | RemoteProject
  view: ViewStateRuntimeLogs
}

export const RuntimeLogsView = ({ project }: RuntimeLogsViewProps) => {
  const { state, dispatch } = useSkmtc()
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useShortcut({
    label: `'esc' to ${project.name}`,
    action: (input, key) => {
      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  useEffect(() => {
    if (!(project instanceof Project)) {
      setError('Runtime logs are only available for local projects')
      return
    }

    dispatch({
      type: 'set-execution',
      payload: { type: 'generate', title: 'Fetching runtime logs...' }
    })

    project.manifest
      .refresh()
      .then(() => {
        const manifest = project.manifest.contents

        if (!manifest) {
          throw new Error('Project has no manifest. Has generation been run?')
        }

        invariant(state.session?.access_token, 'No access token')

        return getRuntimeLogs({
          accountName: state.session?.user.user_metadata.user_name,
          serverName: project.name,
          spanId: manifest.spanId,
          token: state.session?.access_token
        })
      })
      .then(runtimeLogs => {
        runtimeLogs.forEach(console.log)

        setLogs(runtimeLogs)
        dispatch({ type: 'set-execution', payload: null })
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch runtime logs')
        dispatch({ type: 'set-execution', payload: null })
      })
  }, [])

  return (
    <Box flexDirection="column">
      {error ? (
        <Text color="red">{error}</Text>
      ) : logs.length > 0 ? (
        logs.map((log, index) => <Text key={index}>{log}</Text>)
      ) : !state.execution ? (
        <Text dimColor>No logs found</Text>
      ) : null}
    </Box>
  )
}
