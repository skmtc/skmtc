import { window, StatusBarAlignment } from 'vscode';
import { ExtensionStore } from '../types/ExtensionStore';

export type CreateStatusBarItemArgs = {
  store: ExtensionStore;
};

export const createStatusBarItem = ({ store }: CreateStatusBarItemArgs) => {
  // create a new status bar item that we can now manage
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'skmtc-vscode.showProjectName';

  if (store.serverName) {
    statusBarItem.text = `$(github-action) ${store.serverName}/${store.stackName}`;
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }

  return statusBarItem;
};
