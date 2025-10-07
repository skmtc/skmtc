import { Box, Text } from 'ink'
import type { ReactNode } from 'react'
import { useId } from 'react'

type TaskResultProps = {
  prompt: string
  children: ReactNode
}

export const TaskResult = ({ prompt, children }: TaskResultProps) => {
  const id = useId()
  return (
    <Box
      flexDirection="column"
      paddingBottom={1}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      paddingLeft={2}
      borderLeftDimColor
      key={`${id}-result`}
    >
      <Text>{prompt}</Text>
      <Text dimColor>{children}</Text>
    </Box>
  )
}
