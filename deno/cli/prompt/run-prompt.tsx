import React from 'react'
import type { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'

export const runPrompt = async (skmtcRoot: SkmtcRoot) => {
  const session = await skmtcRoot.manager.auth.toSession()

  render(<App skmtcRoot={skmtcRoot} session={session} view={{ page: 'home' }} interactive />)
}
