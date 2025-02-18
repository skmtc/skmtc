import { ExtensionStore } from '../types/ExtensionStore'
import { window } from 'vscode'

type CreateSettingsViewArgs = {
  store: ExtensionStore
  accountName: string | undefined
  stackName: string | undefined
}

export const createSettingsView = ({ store, accountName, stackName }: CreateSettingsViewArgs) => {
  // Create a tree view to contain settings items
  const settingsTreeView = window.createTreeView('skmtc-vscode.settingsTree', {
    treeDataProvider: store.settingsDataProvider,
    showCollapseAll: false,
    manageCheckboxStateManually: true
  })

  settingsTreeView.description = accountName && stackName ? `${accountName}/${stackName}` : ''

  return settingsTreeView
}
