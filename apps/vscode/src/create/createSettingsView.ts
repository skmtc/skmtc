import { SkmtcClientConfig } from '@skmtc/core/Settings';
import { ExtensionStore } from '../types/ExtensionStore';
import { window } from 'vscode';

type CreateSettingsViewArgs = {
  store: ExtensionStore;
  clientConfig?: SkmtcClientConfig;
};

export const createSettingsView = ({ store, clientConfig }: CreateSettingsViewArgs) => {
  // Create a tree view to contain settings items
  const settingsTreeView = window.createTreeView('skmtc-vscode.settingsTree', {
    treeDataProvider: store.settingsDataProvider,
    showCollapseAll: false,
    manageCheckboxStateManually: true,
  });

  settingsTreeView.description =
    clientConfig?.serverName && clientConfig?.stackName
      ? `${clientConfig.serverName}/${clientConfig.stackName}`
      : '';

  return settingsTreeView;
};
