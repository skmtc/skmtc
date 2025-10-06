import React from 'react'
import { useInput } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useState, useEffect, useMemo } from 'react'
import { QuestionManager } from '@/components/QuestionManager.tsx'
import { availableGenerators } from '@/available-generators.ts'
import { Project } from '../lib/project.ts'

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

  // Execute project creation when all inputs are collected
  useEffect(() => {
    if (projectName && selectedGenerators?.length && basePath && !isExecuting) {
      Project.create({
        skmtcRoot,
        name: projectName,
        basePath,
        generators: selectedGenerators
      }).then(project => {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      })
    }
  }, [projectName, selectedGenerators, basePath, isExecuting])

  return (
    <QuestionManager
      questions={[
        {
          type: 'string',
          include: true,
          prompt: 'Project name',
          setValue: value => {
            // Validate name length
            if (value.length < 3) {
              console.error('Project name must be at least 3 characters long')
              return
            }

            // Check if project already exists
            const existingProject = skmtcRoot.projects.find(p => p.name === value)
            if (existingProject) {
              console.error(`Project "${value}" already exists`)
              return
            }

            setProjectName(value)
          }
        },
        {
          type: 'multiselect',
          include: true,
          options: availableGenerators.map(gen => ({
            label: gen.id,
            value: gen.id
          })),
          prompt: 'Select generators to install',
          setValues: values => {
            setSelectedGenerators(values)
          }
        },
        {
          type: 'string',
          include: true,
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
