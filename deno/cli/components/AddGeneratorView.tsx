import { type ViewStateAddGenerator, useSkmtc } from '@/components/SkmtcContext.tsx'
import { Project } from '@/lib/project.ts'
import type { RemoteProject } from '@/lib/remote-project.ts'
import { Box, Text } from 'ink'
import { useMemo, useState, useEffect } from 'react'
import { QuestionManager } from '@/components/QuestionManager.tsx'
import { checkProjectName } from '@skmtc/core'
import SelectInput from 'ink-select-input'

type AddGeneratorViewProps = {
  project: Project | RemoteProject
  view: ViewStateAddGenerator
}

export const AddGeneratorView = ({ project, view }: AddGeneratorViewProps) => {
  const { dispatch, state } = useSkmtc()
  const [generatorName, setGeneratorName] = useState<string | null>(view.generatorName ?? null)
  const [generatorType, setGeneratorType] = useState<'operation' | 'model' | null>(
    view.generatorType ?? null
  )
  const [isExecuting, setIsExecuting] = useState(false)
  const username = state.session?.user.user_metadata.user_name

  const includeTypeQuestion = useMemo(() => {
    return typeof generatorType !== 'string'
  }, [generatorType])

  const includeNameQuestion = useMemo(() => {
    return typeof generatorName !== 'string' && typeof generatorType === 'string'
  }, [generatorName, generatorType])

  // Execute add generator when all inputs are collected
  useEffect(() => {
    if (generatorName && generatorType && project instanceof Project && !isExecuting) {
      setIsExecuting(true)

      dispatch({
        type: 'set-execution',
        payload: { type: 'generate', title: `Adding generator "${generatorName}"...` }
      })

      project
        .addGenerator(
          { moduleName: generatorName, type: generatorType, username },
          { logSuccess: `Generator "${generatorName}" created` }
        )
        .then(() => {
          dispatch({
            type: 'set-message',
            payload: `Generator "${generatorName}" created successfully`
          })
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        })
        .catch(error => {
          console.error(error)
          dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
        })
        .finally(() => {
          dispatch({ type: 'set-execution', payload: null })
        })
    }
  }, [generatorName, generatorType, isExecuting])

  if (includeTypeQuestion && !isExecuting) {
    return (
      <Box flexDirection="column">
        <Text>Select generator type:</Text>
        <SelectInput
          items={[
            { label: 'operation', value: 'operation' },
            { label: 'model', value: 'model' }
          ]}
          onSelect={item => setGeneratorType(item.value as 'operation' | 'model')}
        />
      </Box>
    )
  }

  return (
    <QuestionManager
      questions={[
        {
          type: 'select',
          include: includeTypeQuestion,
          prompt: 'Generator type',
          options: [
            { label: 'operation', value: 'operation' },
            { label: 'model', value: 'model' }
          ],
          setValue: value => setGeneratorType(value as 'operation' | 'model')
        },
        {
          type: 'string',
          include: includeNameQuestion,
          prompt: 'Generator name',
          setValue: value => {
            const error = checkProjectName(value)
            if (error) {
              console.error(error)
              dispatch({
                type: 'set-view',
                payload: { page: 'project', projectName: project.name }
              })
              return
            }
            setGeneratorName(value)
          }
        }
      ]}
    />
  )
}
