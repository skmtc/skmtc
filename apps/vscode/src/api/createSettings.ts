import { getSession } from '../auth/getSession'
import { window, ExtensionContext } from 'vscode'
import type { SkmtcClientConfig } from '@skmtc/core/Settings'
import { ExtensionStore } from '../types/ExtensionStore'
import { toServerUrl } from '../utilities/toServerUrl'

type CreateSettingsArgs = {
  store: ExtensionStore
  schema: string
  clientConfig: SkmtcClientConfig
  stackName: string
  context: ExtensionContext
}

export const createSettings = async ({
  store,
  schema,
  clientConfig,
  stackName,
  context
}: CreateSettingsArgs) => {
  const reqParams = await getSettingsUrl({ store, stackName, context })

  if (!reqParams) {
    return
  }

  store.localRuntimeLogs.info(`Creating settings on ${reqParams.url}`)

  const res = await fetch(reqParams.url, {
    method: 'POST',
    body: JSON.stringify({
      schema,
      clientSettings: clientConfig.settings,
      defaultSelected: reqParams.defaultSelected
    }),
    headers: {
      'Content-Type': 'application/json',
      ...(reqParams.accessToken ? { Authorization: `Bearer ${reqParams.accessToken}` } : null)
    }
  })

  if (!res.ok) {
    const data = await res.text()

    window.showErrorMessage(`Failed to generate setttings 1: ${data}`)
  } else {
    const data = await res.json()

    return data
  }
}

type GetSettingsUrlArgs = {
  store: ExtensionStore
  stackName: string
  context: ExtensionContext
}

const getSettingsUrl = async ({ store, stackName, context }: GetSettingsUrlArgs) => {
  if (store.devMode?.url) {
    return {
      url: `${store.devMode.url}/settings`,
      accessToken: undefined,
      defaultSelected: true
    }
  }

  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const serverUrl = toServerUrl({ accountName: session.account.label, stackName, context })

  return {
    url: `${serverUrl}/settings`,
    accessToken: session.accessToken,
    defaultSelected: false
  }
}
