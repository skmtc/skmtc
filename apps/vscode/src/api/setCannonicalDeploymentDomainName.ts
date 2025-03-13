import { getSession } from '../auth/getSession'
import { SKMTC_API_PATH } from './constants'
import { ExtensionContext } from 'vscode'
import { toApiOrigin } from '../utilities/toApiOrigin'

type SetCannonicalDeploymentDomainNameArgs = {
  deploymentId: string
  context: ExtensionContext
}

export const setCannonicalDeploymentDomainName = async ({
  deploymentId,
  context
}: SetCannonicalDeploymentDomainNameArgs) => {
  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const apiOrigin = toApiOrigin(context)

  const url = new URL(
    `${apiOrigin}${SKMTC_API_PATH}/deployments/${deploymentId}/canonical-domain-name`
  )

  const deploymentRes = await fetch(url, {
    method: 'PUT',
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Authorization: `Bearer ${session.accessToken}`
    }
  })

  const data = await deploymentRes.json()

  return data
}
