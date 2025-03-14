import { commands, ExtensionContext, window } from 'vscode'
import { ExtensionStore } from '../types/ExtensionStore'
import { toApiOrigin } from '../utilities/toApiOrigin'
type RegisterSetApiOriginArgs = {
  context: ExtensionContext
  store: ExtensionStore
}

export const registerSetApiOrigin = ({ context }: RegisterSetApiOriginArgs) => {
  return commands.registerCommand('skmtc-vscode.setApiOrigin', async () => {
    const value = toApiOrigin(context)

    const apiOrigin = await window.showInputBox({
      value,
      validateInput: value => {
        if (!URL.canParse(value)) {
          return `Invalid URL: ${value}`
        }

        return null
      }
    })

    if (!apiOrigin) {
      return
    }

    await context.globalState.update('apiOrigin', apiOrigin)
  })
}
