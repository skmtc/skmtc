import React from 'react'
import { type ViewStateRuntimeLogs, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text, useInput } from 'ink'
import { useEffect, useState } from 'react'
import { getApiDeploymentsDeploymentIdRuntimeLogs } from '@/services/getApiDeploymentsDeploymentIdRuntimeLogs.generated.ts'

type RuntimeLogsViewProps = {
  project: Project | RemoteProject
  view: ViewStateRuntimeLogs
}

export const RuntimeLogsView = ({ project }: RuntimeLogsViewProps) => {
  const { state, dispatch } = useSkmtc()
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useInput((_input, key) => {
    if (key.escape) {
      dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
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

        return getApiDeploymentsDeploymentIdRuntimeLogs({
          deploymentId: manifest.deploymentId,
          q: manifest.spanId,
          since: new Date(manifest.startAt).toISOString(),
          until: new Date(manifest.endAt).toISOString(),
          supabase: state.skmtcRoot.manager.auth.supabase
        })
      })
      .then(runtimeLogs => {
        const formattedLogs = runtimeLogs.map(log => {
          try {
            const message = JSON.parse(log.message)
            return JSON.stringify(message, null, 2)
          } catch {
            return log.message
          }
        })

        setLogs(formattedLogs)
        dispatch({ type: 'set-execution', payload: null })
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch runtime logs')
        dispatch({ type: 'set-execution', payload: null })
      })
  }, [])

  return (
    <Box flexDirection="column">
      <Text dimColor>Hit 'escape' key to go back</Text>
      <Text></Text>

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
