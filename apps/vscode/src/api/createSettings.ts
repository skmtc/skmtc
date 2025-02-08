import { getSession } from '../auth/getSession'
import { window } from 'vscode'
import type { ClientSettings } from '@skmtc/core/Settings'
import { ExtensionStore } from '../types/ExtensionStore'

type CreateSettingsArgs = {
  store: ExtensionStore
  serverUrl: string
  schema: string
  clientSettings: ClientSettings | undefined
  defaultSelected?: boolean
}

export const createSettings = async ({
  store,
  serverUrl,
  schema,
  clientSettings,
  defaultSelected
}: CreateSettingsArgs) => {
  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  store.localRuntimeLogs.info(`Creating settings on ${serverUrl}`)

  const url = `${serverUrl}/settings`

  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      schema,
      clientSettings,
      defaultSelected: defaultSelected ?? false
    }),
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  console.log('res', res)

  if (!res.ok) {
    const data = await res.text()

    console.log('data', data)

    window.showErrorMessage(`Failed to generate setttings 1: ${data}`)
  } else {
    const data = await res.json()

    console.log('data', data)

    return data
  }
}
