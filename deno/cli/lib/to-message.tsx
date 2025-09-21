import { render, Text, Box } from 'ink'
import React from 'react'
type Message = {
  message: string
  color?: string
}

type ToMessageProps = {
  messages: Message[]
}

export const toMessage = ({ messages }: ToMessageProps) => {
  render(
    <Box flexDirection="column">
      {messages.map(({ message, color }) => (
        <Text key={message} color={color}>
          {message}
        </Text>
      ))}
    </Box>
  )
}
