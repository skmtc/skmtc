import React from 'react'
import { Box } from 'ink'
import { useEffect } from 'react'
import { useSkmtc } from './SkmtcContext.tsx'

export const ExitView = () => {
  const { exit } = useSkmtc()

  useEffect(() => {
    exit()
  }, [])

  return <Box></Box>
}
