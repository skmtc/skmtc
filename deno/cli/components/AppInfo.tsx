import React from 'react'
import { Box, Text } from 'ink'
import { toRelativeRootPath } from '@/lib/to-root-path.ts'
import denoJson from '../deno.json' with { type: 'json' }
import { useSkmtc, useProjectName } from '@/components/SkmtcContext.tsx'
import { StatusMessage } from '@inkjs/ui'
import { match, P } from 'ts-pattern'
import { focusColor } from '@/lib/colors.ts'

export const AppInfo = () => {
  const { state } = useSkmtc()
  const projectName = useProjectName()

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
            <Text color={focusColor}>＊ </Text>
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
          {projectName ? (
            <Box flexDirection="row">
              <Text dimColor>project: </Text>
              <Text>{projectName}</Text>
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
          {match(state.message)
            .with({ success: P.string }, ({ success }) => (
              <StatusMessage variant="success">{success}</StatusMessage>
            ))
            .with({ error: P.string }, ({ error }) => (
              <StatusMessage variant="error">{error}</StatusMessage>
            ))
            .exhaustive()}
          {state.message.sub ? <Text dimColor>{`  ${state.message.sub}`}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}
