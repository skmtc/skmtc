import { Box, Text } from 'ink'
import { useId } from 'react'
import { useShortcut } from './useShortcut.tsx'
import { useTask } from './TaskContext.tsx'
import { useProjectName } from './SkmtcContext.tsx'

type TaskContainerProps = {
  prompt: string
  children: React.ReactNode
}

export const TaskContainer = ({ prompt, children }: TaskContainerProps) => {
  const id = useId()
  const { leave } = useTask()
  const projectName = useProjectName()

  useShortcut({
    label: `'esc' to ${projectName}`,
    action: (input, key) => {
      if (key.escape) {
        leave()
      }
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      paddingLeft={2}
      key={`${id}-container`}
    >
      <Text>{prompt}</Text>
      {children}
    </Box>
  )
}
