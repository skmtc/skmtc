import { getSession } from '../auth/getSession'
import { SKMTC_API } from './constants'

type SetCannonicalDeploymentDomainNameArgs = {
  deploymentId: string
}

export const setCannonicalDeploymentDomainName = async ({
  deploymentId
}: SetCannonicalDeploymentDomainNameArgs) => {
  const session = await getSession({ createIfNone: true })

  if (!session) {
    return
  }

  const deploymentRes = await fetch(
    `${SKMTC_API}/deployments/${deploymentId}/canonical-domain-name`,
    {
      method: 'PUT',
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Authorization: `Bearer ${session.accessToken}`
      }
    }
  )

  const data = await deploymentRes.json()

  return data
}
