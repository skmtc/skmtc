import { getSession } from '../auth/getSession'
import { ExtensionStore } from '../types/ExtensionStore'
import { SKMTC_API_PATH } from './constants'
import ndjsonStream from 'can-ndjson-stream'
import { writeLogs } from '../utilities/writeLogs'
import { ExtensionContext } from 'vscode'
import { toApiOrigin } from '../utilities/toApiOrigin'
type GetDeploymentLogsArgs = {
  store: ExtensionStore
  deploymentId: string
  context: ExtensionContext
}

export const getDeploymentLogs = async ({
  store,
  deploymentId,
  context
}: GetDeploymentLogsArgs) => {
  const session = await getSession({ createIfNone: true })

  const controller = new AbortController()

  if (!session) {
    return {
      dispose: () => {}
    }
  }

  const apiOrigin = toApiOrigin(context)

  const url = new URL(`${apiOrigin}${SKMTC_API_PATH}/deployments/${deploymentId}/deployment-logs`)

  const response = await fetch(url, {
    method: 'GET',
    signal: controller.signal,
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Accept: 'application/x-ndjson',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  const reader = ndjsonStream(response.body).getReader()

  store.remoteDeploymentLogs.clear()

  store.remoteDeploymentLogs.show()

  pump()

  function pump() {
    return (
      reader
        ?.read()
        // @ts-expect-error
        .then(({ done, value }) => {
          // When no more data needs to be consumed, close the stream

          if (done) {
            return
          }

          writeLogs(store.remoteDeploymentLogs, value)

          pump()
        })
        .catch((e: unknown) => {
          console.error(e)
        })
    )
  }

  return {
    dispose: () => {
      reader.cancel()
      controller.abort()
    }
  }
}
