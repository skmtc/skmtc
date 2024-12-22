import { commands, ExtensionContext } from 'vscode';
import { settingsTreeItemClicked } from './settingsTreeItemClicked';
import { ExtensionStore } from '../types/ExtensionStore';

type RegisterSettingsTreeItemClickedArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
};

export const registerSettingsTreeItemClicked = ({
  store,
  context,
}: RegisterSettingsTreeItemClickedArgs) => {
  return commands.registerCommand(
    'vscode-skmtc.treeItemClicked',
    settingsTreeItemClicked({ store, context })
  );
};
