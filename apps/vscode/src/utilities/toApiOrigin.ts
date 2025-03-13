import { ExtensionContext } from 'vscode'

export const toApiOrigin = (context: ExtensionContext): string => {
  const apiOrigin = context.globalState.get('apiOrigin')

  if (typeof apiOrigin === 'string') {
    return apiOrigin
  }

  return 'https://api.codesquared.com'
}
