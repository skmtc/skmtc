import { commands, QuickPickItemKind, window } from 'vscode';
import { ExtensionStore } from '../types/ExtensionStore';

type RegisterShowProjectNameArgs = {
  store: ExtensionStore;
};

export const registerShowProjectName = ({ store }: RegisterShowProjectNameArgs) => {
  return commands.registerCommand('skmtc-vscode.showProjectName', () => {
    return window.showQuickPick([
      { label: 'status', kind: QuickPickItemKind.Separator },
      { label: `Current version: ${store.deploymentId}` },
    ]);
  });
};
