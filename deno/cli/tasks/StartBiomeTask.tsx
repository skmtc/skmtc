import React, { useEffect } from 'react'
import type { PrettierConfigType } from '@skmtc/core/PrettierConfig'
import { useTask } from '@/components/TaskContext.tsx'
import { Box } from 'ink'
import { createBiomeInstance } from '@/lib/formatting.ts'
import { toRootPath } from '../lib/to-root-path.ts'
import { join } from '@std/path/join'

type StartBiomeTaskProps = {
  prettierConfig: PrettierConfigType | undefined
}

export const StartBiomeTask = ({ prettierConfig }: StartBiomeTaskProps) => {
  const { state, dispatch } = useTask()

  useEffect(() => {
    const basePath = state.tasks.find(task => task.taskKey === 'base-path')?.state as
      | string
      | undefined

    if (!prettierConfig || !basePath) {
      dispatch({ type: 'increment-current-task' })
      return
    }

    const projectPath = join(toRootPath(), basePath)

    const biomePromise = createBiomeInstance({ prettierConfig, projectPath }).catch(error => {
      console.error(error)
      throw error
    })
    // Apply configuration from Prettier config

    dispatch({
      type: 'set-task-state',
      payload: { taskKey: 'start-biome-task', state: biomePromise }
    })
    dispatch({ type: 'increment-current-task' })
  }, [])

  return <Box></Box>
}
