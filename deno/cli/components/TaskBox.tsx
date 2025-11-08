import React from 'react'
import { Box, Text } from 'ink'

type TaskBoxProps = {
  prompt?: string
  active: boolean
  children: React.ReactNode
}

export const TaskBox = ({ prompt, active, children }: TaskBoxProps) => (
  <Box
    flexDirection="column"
    borderStyle="single"
    paddingBottom={active ? 0 : 1}
    borderTop={false}
    borderBottom={false}
    borderRight={false}
    paddingLeft={2}
    borderLeftDimColor={!active}
  >
    {prompt ? <Text>{prompt}</Text> : null}
    {children}
  </Box>
)
