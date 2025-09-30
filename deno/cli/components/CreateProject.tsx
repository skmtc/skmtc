import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useState, useEffect, useMemo } from 'react'
import { QuestionManager } from '@/components/QuestionManager.tsx'
import { MultiSelect } from '@inkjs/ui'
import { availableGenerators } from '@/available-generators.ts'

export const CreateProject = () => {
  const { state, dispatch } = useSkmtc()
  const { skmtcRoot } = state

  const [projectName, setProjectName] = useState<string | null>(null)
  const [selectedGenerators, setSelectedGenerators] = useState<string[] | null>(null)
  const [basePath, setBasePath] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  useInput((input, key) => {
    if (isExecuting) return

    if (key.escape) {
      dispatch({ type: 'set-view', payload: { page: 'home' } })
    }
  })

  const includeNameQuestion = useMemo(() => {
    return typeof projectName !== 'string'
  }, [projectName])

  const includeBasePathQuestion = useMemo(() => {
    return typeof basePath !== 'string' && selectedGenerators !== null
  }, [basePath, selectedGenerators])

  // Execute project creation when all inputs are collected
  useEffect(() => {
    if (projectName && selectedGenerators && basePath && !isExecuting) {
      setIsExecuting(true)

      dispatch({
        type: 'set-execution',
        payload: {
          type: 'generate',
          title: `Creating project "${projectName}"...`
        }
      })

      // First create the Deno project
      skmtcRoot
        .createDenoProject(projectName)
        .then(() => {
          // Then create the local project
          return skmtcRoot.createProject({
            name: projectName,
            basePath,
            generators: selectedGenerators
          })
        })
        .then(() => {
          dispatch({
            type: 'set-message',
            payload: `Project "${projectName}" created successfully`
          })
          dispatch({ type: 'set-view', payload: { page: 'project', projectName } })
        })
        .catch(error => {
          console.error(error)
          dispatch({
            type: 'set-message',
            payload: `Failed to create project: ${error.message}`
          })
          dispatch({ type: 'set-view', payload: { page: 'home' } })
        })
        .finally(() => {
          dispatch({ type: 'set-execution', payload: null })
        })
    }
  }, [projectName, selectedGenerators, basePath, isExecuting])

  // Show generator selection after name is collected
  if (projectName && !selectedGenerators && !isExecuting) {
    const generatorOptions = availableGenerators
      .filter(gen => gen.launchInclude)
      .map(gen => ({
        label: gen.id,
        value: gen.id
      }))

    return (
      <Box flexDirection="column">
        <Text>Select generators:</Text>
        <Text dimColor>Space to toggle, Enter to submit, Escape to cancel</Text>
        <Text></Text>

        <MultiSelect
          options={generatorOptions}
          onSubmit={values => {
            if (values.length === 0) {
              dispatch({ type: 'set-view', payload: { page: 'home' } })
            } else {
              setSelectedGenerators(values)
            }
          }}
        />
      </Box>
    )
  }

  return (
    <QuestionManager
      questions={[
        {
          type: 'string',
          include: includeNameQuestion,
          prompt: 'Project name',
          setValue: value => {
            // Validate name length
            if (value.length < 3) {
              console.error('Project name must be at least 3 characters long')
              dispatch({ type: 'set-view', payload: { page: 'home' } })
              return
            }

            // Check if project already exists
            const existingProject = skmtcRoot.projects.find(p => p.name === value)
            if (existingProject) {
              console.error(`Project "${value}" already exists`)
              dispatch({ type: 'set-view', payload: { page: 'home' } })
              return
            }

            setProjectName(value)
          }
        },
        {
          type: 'string',
          include: includeBasePathQuestion,
          prompt: 'Base path for generated files',
          defaultValue: 'src',
          setValue: value => {
            setBasePath(value)
          }
        }
      ]}
    />
  )
}
