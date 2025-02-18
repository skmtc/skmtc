import { SKMTC_API } from '../api/constants'

type ToServerUrlArgs = {
  accountName: string
  stackName: string
  deploymentId?: string
}

export const toServerUrl = ({ accountName, stackName, deploymentId }: ToServerUrlArgs) => {
  const base = `${SKMTC_API}/${accountName}/servers/${stackName}`
  return deploymentId ? `${base}/${deploymentId}` : base
}
