import { Box, Text } from 'ink'
import Link from 'ink-link'
import { useState, useEffect } from 'react'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { AppAction } from './types.ts'
import type { ActionDispatch } from 'react'

type LoginViewProps = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

export const LoginView = ({ skmtcRoot, dispatch }: LoginViewProps) => {
  const [loginLink, setLoginLink] = useState<string>()
  console.clear()

  useEffect(() => {
    skmtcRoot.login({
      emitLoginLink: loginLink => setLoginLink(loginLink),
      onLogin: session => {
        console.clear()

        dispatch({ type: 'set-user', user: session.user })
        dispatch({ type: 'set-view', view: { type: 'home' } })
      }
    })
  }, [])

  return (
    <Box flexDirection="column">
      <Text>Click the link to login</Text>
      {loginLink && (
        <Link url={`${loginLink} `}>
          <Text color="cyan">Skmtc login</Text>
        </Link>
      )}
    </Box>
  )
}
