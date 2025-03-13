import { ExtensionContext } from 'vscode'
import { SKMTC_API_PATH } from '../api/constants'
import { toApiOrigin } from './toApiOrigin'
type ToServerUrlArgs = {
  accountName: string
  stackName: string
  deploymentId?: string
  context: ExtensionContext
}

export const toServerUrl = ({
  accountName,
  stackName,
  deploymentId,
  context
}: ToServerUrlArgs): URL => {
  const base = `${SKMTC_API_PATH}/${accountName}/servers/${stackName}`
  const path = deploymentId ? `${base}/${deploymentId}` : base

  const apiOrigin = toApiOrigin(context)

  return new URL(path, apiOrigin)
}
