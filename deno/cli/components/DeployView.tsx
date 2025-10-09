import React from 'react'
import { Box } from 'ink'
import type { Project } from '@/lib/project.ts'
import type { ViewStateDeploy } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'

type DeployViewProps = {
  project: Project
  view: ViewStateDeploy
}

export const DeployView = ({ project, view }: DeployViewProps) => {
  const { state, dispatch, dispatchMessage } = useSkmtc()

  useEffect(() => {
    const run = async () => {
      await project.deploy({ state, dispatch, dispatchMessage })

      if (state.interactive) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      }
    }

    run()
  }, [])

  return <Box></Box>
}
