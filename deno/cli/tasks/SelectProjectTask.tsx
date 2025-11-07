import { useTask } from '@/components/TaskContext.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Text, Box } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useState, useId } from 'react'
import { TextInput } from '@inkjs/ui'
import { TaskContainer } from '@/components/TaskContainer.tsx'
import SelectInput from 'ink-select-input'
import { useGetGenerators } from '@/components/useGetGenerators.ts'
import { Project } from '@/lib/project.ts'
import { Spinner } from '@/components/Spinner.tsx'

type ProjectOption = {
  label: string
  value: string
  path?: string
  isCustom?: boolean
}

type ProjectItemProps = {
  label: string
  isSelected?: boolean
  path?: string
  isCustom?: boolean
  customValue?: string
  hasCustomValue?: boolean
  onCustomValueChange?: (value: string) => void
}

const ProjectItem = ({
  label,
  isSelected = false,
  path,
  isCustom,
  customValue = 'project-name',
  hasCustomValue = false,
  onCustomValueChange
}: ProjectItemProps) => {
  if (isCustom) {
    // When selected and it's still the placeholder, start with empty input
    // When selected and user has typed something, show their value
    const inputValue = isSelected && !hasCustomValue ? '' : customValue

    // When not selected, show placeholder if value is empty
    const displayValue = customValue || 'project-name'

    return (
      <Box flexDirection="column">
        <Text color={isSelected ? 'white' : undefined}>{label}</Text>
        {isSelected ? (
          <TextInput defaultValue={inputValue} onSubmit={() => {}} onChange={onCustomValueChange} />
        ) : (
          <Text dimColor>{displayValue}</Text>
        )}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color={isSelected ? 'white' : undefined}>{label}</Text>
      {path && <Text dimColor>{path}</Text>}
    </Box>
  )
}

export const SelectProjectTask = () => {
  const { dispatch } = useTask()
  const { state, dispatchMessage } = useSkmtc()
  const [customProjectName, setCustomProjectName] = useState('project-name')
  const [hasCustomValue, setHasCustomValue] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const availableGenerators = useGetGenerators()
  const id = useId()

  const handleCustomValueChange = (value: string) => {
    setCustomProjectName(value)
    // Mark as custom if user has typed anything different from empty or placeholder
    if (value && value !== 'project-name') {
      setHasCustomValue(true)
    } else {
      // User cleared the input or it's back to placeholder
      setHasCustomValue(false)
    }
  }

  if (isCreating) {
    return (
      <TaskBox id={`${id}-creating`} active>
        <Spinner label={`Creating project "${customProjectName}"...`} />
      </TaskBox>
    )
  }

  if (response !== null) {
    return (
      <TaskBox prompt="Select project" id={`${id}-response`} active={false}>
        <Text dimColor>{response}</Text>
      </TaskBox>
    )
  }

  if (state.skmtcRoot.projects.length === 0) {
    return (
      <TaskBox id={`select-project-task`} active>
        <Text>No projects found</Text>
      </TaskBox>
    )
  }

  const options: ProjectOption[] = [
    ...state.skmtcRoot.projects.map(project => ({
      label: project.name,
      value: project.name,
      path: project.toPath()
    })),
    {
      label: 'Create new project',
      value: '__custom__',
      isCustom: true
    }
  ]

  const handleCreateProject = async () => {
    // Validate that user has entered a custom project name
    if (!hasCustomValue || !customProjectName || customProjectName === 'project-name') {
      dispatchMessage({ error: 'Please enter a valid project name' })
      return
    }

    if (!availableGenerators) {
      dispatchMessage({ error: 'Generators not loaded yet' })
      return
    }

    setIsCreating(true)

    try {
      const project = await Project.create({
        name: customProjectName,
        basePath: '',
        generators: [],
        skmtcRoot: state.skmtcRoot,
        availableGenerators
      })

      setResponse(customProjectName)
      dispatchMessage({ success: `Project "${customProjectName}" created` })

      dispatch({
        type: 'set-task-state',
        payload: { taskKey: 'select-project-task', state: project }
      })
      dispatch({ type: 'increment-current-task' })
    } catch (error) {
      console.error(error)
      dispatchMessage({ error: `Failed to create project "${customProjectName}"` })
      setIsCreating(false)
    }
  }

  return (
    <TaskContainer prompt="Select project" key={`${id}-container`}>
      <SelectInput
        items={options}
        itemComponent={props => (
          <ProjectItem
            {...props}
            customValue={customProjectName}
            hasCustomValue={hasCustomValue}
            onCustomValueChange={handleCustomValueChange}
          />
        )}
        onSelect={item => {
          if (item.value === '__custom__') {
            handleCreateProject()
          } else {
            const project = state.skmtcRoot.findProject(item.value)
            setResponse(item.value)

            dispatch({
              type: 'set-task-state',
              payload: { taskKey: 'select-project-task', state: project }
            })

            dispatch({ type: 'increment-current-task' })
          }
        }}
      />
    </TaskContainer>
  )
}
