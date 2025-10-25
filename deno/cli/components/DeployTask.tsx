import React from 'react'
import { Text } from 'ink'
import type { Project } from '@/lib/project.ts'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect, useState } from 'react'
import { Spinner } from '@inkjs/ui'
import { useTask } from './TaskContext.tsx'
import { TaskBox } from './TaskBox.tsx'

type ToDeployTaskProps = {
  project: Project
}
export const toDeployTask = ({ project }: ToDeployTaskProps) => ({
  key: 'deploy-project-task',
  include: true,
  render: () => <DeployTaskView project={project} />
})

type DeployTaskViewProps = {
  project: Project
}

export const DeployTaskView = ({ project }: DeployTaskViewProps) => {
  const { state, dispatch, dispatchMessage } = useSkmtc()
  const { dispatch: taskDispatch } = useTask()
  const [deployed, setDeployed] = useState(false)

  useEffect(() => {
    const run = async () => {
      await project.deploy({ state, dispatch, dispatchMessage })

      setDeployed(true)

      taskDispatch({ type: 'increment-current-task' })
    }

    run()
  }, [])

  if (deployed) {
    return (
      <TaskBox id={`deploy-project-task`} active={false}>
        <Text>Deployed</Text>
      </TaskBox>
    )
  }

  return (
    <TaskBox id={`deploy-project-task`} active>
      <Spinner label="Deploying..." />
    </TaskBox>
  )
}
