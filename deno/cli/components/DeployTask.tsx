import { Box, Text } from 'ink'
import { Project } from '@/lib/project.ts'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect, useState } from 'react'
import { Spinner } from '@inkjs/ui'
import { useTask } from './TaskContext.tsx'

type ToDeployTaskProps = {
  project: Project
}

export const toDeployTask = ({ project }: ToDeployTaskProps) => ({
  include: true,
  render: () => <DeployTaskView project={project} />
})

type DeployTaskViewProps = {
  project: Project
}

export const DeployTaskView = ({ project }: DeployTaskViewProps) => {
  const { state, dispatch } = useSkmtc()
  const { state: taskState, dispatch: taskDispatch } = useTask()
  const [deployed, setDeployed] = useState(false)

  useEffect(() => {
    const run = async () => {
      await project.deploy({ state, dispatch })

      setDeployed(true)

      taskDispatch({
        type: 'set-current-task',
        payload: taskState.currentTask + 1
      })
    }

    run()
  }, [])

  return <Box>{deployed ? <Text>Deployed</Text> : <Spinner label="Deploying..." />}</Box>
}
