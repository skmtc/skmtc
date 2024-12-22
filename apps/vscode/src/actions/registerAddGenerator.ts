import { commands, QuickPickItem, window } from 'vscode';
import { match } from 'ts-pattern';
import { ExtensionStore } from '../types/ExtensionStore';

type ItemWithCommandKey = QuickPickItem & { commandKey: 'download' | 'remote' | 'create' };

const items: ItemWithCommandKey[] = [
  {
    label: 'Download generator',
    description: 'Copy published generator to your project (Recommended)',
    commandKey: 'download',
  },
  // {
  //   label: 'Add remote generator',
  //   description: 'Use external generator without downloading',
  //   commandKey: 'remote',
  // },
  {
    label: 'Create new generator',
    description: 'Create a new generator from scratch',
    commandKey: 'create',
  },
];

export const registerAddGenerator = (store: ExtensionStore) => {
  return commands.registerCommand('skmtc-vscode.addGenerator', async () => {
    const selectedItem = await window.showQuickPick(items);

    if (!selectedItem) {
      return;
    }

    await match(selectedItem.commandKey)
      .with('download', async () => {
        return await commands.executeCommand('skmtc-vscode.downloadGenerator', {
          skipDeployment: true,
        });
      })
      .with('remote', async () => {
        return await commands.executeCommand('skmtc-vscode.addExternalGenerator', {
          skipDeployment: true,
        });
      })
      .with('create', async () => {
        return await commands.executeCommand('skmtc-vscode.createGenerator', {
          skipDeployment: true,
        });
      })
      .exhaustive();

    store.milestonesDataProvider.refresh();
  });
};
