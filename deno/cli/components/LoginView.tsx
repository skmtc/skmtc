import { Newline, Text } from 'ink'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import { useEffect } from 'react'
import { useState } from 'react'
import Link from 'ink-link'
export const LoginView = () => {
  const { state, dispatch } = useSkmtc()
  const [loginUrl, setLoginUrl] = useState<string | null>(null)

  const { auth } = state.skmtcRoot.manager

  useEffect(() => {
    auth.toLoginUrl().then(res => {
      setLoginUrl(res)
    })
  }, [])

  useEffect(() => {
    auth.expectSession().then(session => {
      dispatch({ type: 'set-session', payload: { session } })
      dispatch({ type: 'set-view', payload: { page: 'home' } })
    })
  }, [loginUrl, auth])

  if (!loginUrl) {
    return null
  }

  return (
    <>
      <Text>
        Click link below to log in:
        <Newline />
      </Text>

      <Link url={loginUrl}>
        <Text dimColor>{loginUrl}</Text>
      </Link>
    </>
  )
}
