import React from 'react'
import { type ViewStateRuntimeLogs, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useEffect, useState } from 'react'
import { getRuntimeLogs } from '@/services/getRuntimeLogs.ts'
import invariant from 'tiny-invariant'
import { useShortcut } from './useShortcut.tsx'
import { Spinner } from '@inkjs/ui'

type RuntimeLogsViewProps = {
  project: Project | RemoteProject
  view: ViewStateRuntimeLogs
}

export const RuntimeLogsView = ({ project }: RuntimeLogsViewProps) => {
  const { state, dispatch } = useSkmtc()
  const [logs, setLogs] = useState<string[] | null>(null)

  const [fetching, setFetching] = useState(false)

  useShortcut({
    label: `'esc' to ${project.name}`,
    action: (input, key) => {
      if (key.escape) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }
  })

  useEffect(() => {
    if (!fetching && logs && logs.length === 0) {
      dispatch({
        type: 'set-message',
        payload: {
          error: 'No logs found'
        }
      })

      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
    }
  }, [logs])

  useEffect(() => {
    if (!(project instanceof Project)) {
      dispatch({
        type: 'set-message',
        payload: {
          error: 'Runtime logs are only available for local projects'
        }
      })

      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      return
    }

    setFetching(true)

    project.manifest
      .refresh()
      .then(() => {
        const manifest = project.manifest.contents

        if (!manifest) {
          dispatch({
            type: 'set-message',
            payload: {
              error: 'Project has no manifest. Has generation been run?'
            }
          })

          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
          return
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
        setLogs(runtimeLogs)
      })
      .catch(err => {
        dispatch({
          type: 'set-message',
          payload: {
            error: err.message || 'Failed to fetch runtime logs'
          }
        })

        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
      .finally(() => {
        setFetching(false)
      })
  }, [])

  if (fetching) {
    return <Spinner label="Fetching runtime logs..." />
  }

  return (
    <Box flexDirection="column">{logs?.map((log, index) => <Text key={index}>{log}</Text>)}</Box>
  )
}
