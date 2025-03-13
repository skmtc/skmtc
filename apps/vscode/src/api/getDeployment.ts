import { getSession } from '../auth/getSession'
import { toApiOrigin } from '../utilities/toApiOrigin'
import { SKMTC_API_PATH } from './constants'
import { ExtensionContext } from 'vscode'

type GetDeploymentArgs = {
  deploymentId: string
  context: ExtensionContext
}

export const getDeployment = async ({ deploymentId, context }: GetDeploymentArgs) => {
  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const apiOrigin = toApiOrigin(context)

  const url = new URL(`${apiOrigin}${SKMTC_API_PATH}/deployments/${deploymentId}`)

  const deploymentRes = await fetch(url, {
    method: 'GET',
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  return await deploymentRes.json()
}
