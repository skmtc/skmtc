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
  const { state, dispatch } = useSkmtc()

  useEffect(() => {
    project.deploy({ logSuccess: 'Generators deployed', interactive: state.interactive, dispatch })
  }, [])

  return <Box></Box>
}
