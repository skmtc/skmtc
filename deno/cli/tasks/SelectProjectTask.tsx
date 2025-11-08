import { useTask } from '@/components/TaskContext.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import { Text } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useState } from 'react'
import { TextInput } from '@inkjs/ui'
import { TaskContainer } from '@/components/TaskContainer.tsx'
import SelectInput from 'ink-select-input'
import { useGetGenerators } from '@/components/useGetGenerators.ts'
import { Project } from '@/lib/project.ts'
import { Spinner } from '@/components/Spinner.tsx'

type ProjectOption = {
  label: string
  value: string
  isCustom?: boolean
}

type ProjectItemProps = {
  label: string
  isSelected?: boolean
  isCustom?: boolean
  customValue?: string
  hasCustomValue?: boolean
  onCustomValueChange?: (value: string) => void
}

const PLACEHOLDER = 'Create new project'

const ProjectItem = ({
  label,
  isSelected = false,
  isCustom,
  customValue = PLACEHOLDER,
  hasCustomValue = false,
  onCustomValueChange
}: ProjectItemProps) => {
  if (isCustom) {
    // When selected and it's still the placeholder, start with empty input
    // When selected and user has typed something, show their value
    const inputValue = isSelected && !hasCustomValue ? '' : customValue

    // When not selected, show placeholder if value is empty
    const displayValue = customValue || PLACEHOLDER

    return isSelected ? (
      <TextInput defaultValue={inputValue} onSubmit={() => {}} onChange={onCustomValueChange} />
    ) : (
      <Text color={isSelected ? 'white' : undefined} dimColor={hasCustomValue}>
        {displayValue}
      </Text>
    )
  }

  return <Text color={isSelected ? 'white' : undefined}>{label}</Text>
}

export const SelectProjectTask = () => {
  const { dispatch } = useTask()
  const { state, dispatchMessage } = useSkmtc()
  const [customProjectName, setCustomProjectName] = useState(PLACEHOLDER)
  const [hasCustomValue, setHasCustomValue] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const availableGenerators = useGetGenerators()

  const handleCustomValueChange = (value: string) => {
    setCustomProjectName(value)
    // Mark as custom if user has typed anything different from empty or placeholder
    if (value && value !== PLACEHOLDER) {
      setHasCustomValue(true)
    } else {
      // User cleared the input or it's back to placeholder
      setHasCustomValue(false)
    }
  }

  if (isCreating) {
    return (
      <TaskBox active>
        <Spinner label={`Creating project "${customProjectName}"...`} />
      </TaskBox>
    )
  }

  if (response !== null) {
    return (
      <TaskBox prompt="Select project" active={false}>
        <Text dimColor>{response}</Text>
      </TaskBox>
    )
  }

  if (state.skmtcRoot.projects.length === 0) {
    return (
      <TaskBox active>
        <Text>No projects found</Text>
      </TaskBox>
    )
  }

  const options: ProjectOption[] = [
    ...state.skmtcRoot.projects.map(project => ({
      label: project.name,
      value: project.name
    })),
    {
      label: 'Create new project',
      value: '__custom__',
      isCustom: true
    }
  ]

  const handleCreateProject = async () => {
    // Validate that user has entered a custom project name
    if (!hasCustomValue || !customProjectName || customProjectName === PLACEHOLDER) {
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
    <TaskContainer prompt="Select project">
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
