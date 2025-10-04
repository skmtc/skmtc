import React from 'react'
import { Box, Text } from 'ink'
import { toRelativeRootPath } from '@/lib/to-root-path.ts'
import denoJson from '../deno.json' with { type: 'json' }
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { StatusMessage } from '@inkjs/ui'

export const AppInfo = () => {
  const { state } = useSkmtc()

  const appRootPath = toRelativeRootPath()

  if (state.view.page === 'login') {
    return null
  }

  if (!state.interactive) {
    return null
  }

  return (
    <>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderDimColor
        width="auto"
        paddingLeft={1}
        paddingRight={1}
        marginBottom={state.message ? 0 : 1}
      >
        <Box flexDirection="row" marginBottom={1} justifyContent="space-between">
          <Box flexDirection="row">
            <Text color="#4f46e5">＊ </Text>
            <Text color="white">Skmtc CLI </Text>
            <Text dimColor>{`(v${denoJson.version})`}</Text>
          </Box>
          <Box flexDirection="row">
            {state.session ? (
              <Text>
                <Text dimColor>Logged in as </Text>
                <Text>{state.session.user.user_metadata.user_name}</Text>
              </Text>
            ) : (
              <Text>You are not logged in</Text>
            )}
          </Box>
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          {'projectName' in state.view ? (
            <Box flexDirection="row">
              <Text dimColor>project: </Text>
              <Text>{state.view.projectName}</Text>
            </Box>
          ) : (
            <Box></Box>
          )}
          <Box flexDirection="row">
            <Text dimColor>directory: </Text>
            <Text>{appRootPath}</Text>
          </Box>
        </Box>
      </Box>
      {state.message ? (
        <Box flexDirection="column" paddingLeft={2} paddingBottom={1}>
          <StatusMessage variant="success">{state.message.main}</StatusMessage>
          {state.message.sub ? <Text dimColor>{`  ${state.message.sub}`}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}
