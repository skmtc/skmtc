import { getSession } from '../auth/getSession'
import { window, ExtensionContext } from 'vscode'
import { SkmtcClientConfig } from '@skmtc/core/Settings'
import { createArtifactsResponse } from '../types/generationResponse'
import { ExtensionStore } from '../types/ExtensionStore'
import { toServerUrl } from '../utilities/toServerUrl'
import * as v from 'valibot'

type GenerateArgs = {
  store: ExtensionStore
  schema: string
  prettier: string | undefined
  clientConfig: SkmtcClientConfig
  stackName: string
  context: ExtensionContext
}

export const createArtifacts = async ({
  store,
  schema,
  prettier,
  clientConfig,
  stackName,
  context
}: GenerateArgs) => {
  try {
    const reqParams = await getStackUrl({ store, clientConfig, stackName, context })

    if (!reqParams) {
      return null
    }

    const res = await fetch(reqParams.url, {
      method: 'POST',
      body: JSON.stringify({
        schema,
        clientSettings: clientConfig.settings,
        prettier
      }),
      headers: {
        'Content-Type': 'application/json',
        ...(reqParams.accessToken ? { Authorization: `Bearer ${reqParams.accessToken}` } : null)
      }
    })

    const json = await res.json()

    return v.parse(createArtifactsResponse, json)
  } catch (error) {
    store.sentryClient.captureException(error)

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    window.showErrorMessage(`Failed to run stack: ${errorMessage}`)

    return null
  }
}

type GetStackUrlArgs = {
  store: ExtensionStore
  clientConfig: SkmtcClientConfig
  stackName: string
  context: ExtensionContext
}

const getStackUrl = async ({ store, clientConfig, stackName, context }: GetStackUrlArgs) => {
  if (store.devMode?.url) {
    return {
      url: `${store.devMode.url}/artifacts`,
      accessToken: undefined
    }
  }

  const { deploymentId } = clientConfig

  if (!deploymentId) {
    window.showErrorMessage(`client.json is missing a 'deploymentId' field`)
    return
  }

  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const url = toServerUrl({ accountName: session.account.label, stackName, deploymentId, context })

  return {
    url,
    accessToken: session.accessToken
  }
}
