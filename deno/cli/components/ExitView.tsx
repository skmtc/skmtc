import React from 'react'
import { Box } from 'ink'
import { useEffect } from 'react'
import { useSkmtc } from './SkmtcContext.tsx'

export const ExitView = () => {
  const { state, exit } = useSkmtc()

  useEffect(() => {
    if (state.message?.timeout) {
      clearTimeout(state.message.timeout)
    }
    exit()
  }, [])

  return <Box></Box>
}
