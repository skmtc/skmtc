import { commands, QuickPickItemKind, window } from 'vscode'
import { readClientConfig } from '../utilities/readClientConfig'

export const registerShowProjectName = () => {
  return commands.registerCommand('skmtc-vscode.showProjectName', () => {
    const clientConfig = readClientConfig({ notifyIfMissing: false })

    return window.showQuickPick([
      { label: 'status', kind: QuickPickItemKind.Separator },
      { label: `Current deployment: ${clientConfig?.deploymentId}` }
    ])
  })
}
