import React from 'react'
import { SkmtcRoot } from '@/lib/skmtc-root.ts'
import { Manager } from '@/lib/manager.ts'
import { render } from 'ink'
import { App } from '@/components/App.tsx'
import type { SkmtcState } from '@/components/SkmtcContext.tsx'

export const runPrompt = async () => {
  // Instantiate Manager and SkmtcRoot
  const manager = new Manager()
  const skmtcRoot = await SkmtcRoot.open(manager)

  const session = await skmtcRoot.manager.auth.toSession()

  const initialState: SkmtcState = {
    view: { page: 'home' },
    skmtcRoot,
    session,
    interactive: true,
    message: null,
    shortcuts: [],
    generators: []
  }

  render(<App initialState={initialState} />)
}
