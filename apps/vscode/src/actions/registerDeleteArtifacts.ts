import { commands, TreeView, window } from 'vscode';
import { readManifest } from '../utilities/readManifest';
import { resolve } from 'node:path';
import { toRootPath } from '../utilities/getRootPath';
import { unlinkSync } from 'node:fs';
import { ExtensionStore } from '../types/ExtensionStore';
import { SettingsNode } from '../settings/SettingsNode';
import { filesUpdated } from '../create/createWatchers';

type RegisterDeleteArtifactsArgs = {
  store: ExtensionStore;
  settingsTreeView: TreeView<SettingsNode>;
};

export const registerDeleteArtifacts = ({
  store,
  settingsTreeView,
}: RegisterDeleteArtifactsArgs) => {
  return commands.registerCommand('skmtc-vscode.deleteArtifacts', async () => {
    const manifest = readManifest();

    if (!manifest) {
      return;
    }

    const paths = Object.keys(manifest.files).sort();

    const rootPath = toRootPath();

    const result = await window.showWarningMessage(
      `Delete ${paths.length} artifacts?`,
      {
        modal: true,
        detail: paths.join('\n'),
      },
      'Delete'
    );

    if (result === 'Delete') {
      paths.forEach((path) => unlinkSync(resolve(rootPath, path)));
    }

    filesUpdated({ store, settingsTreeView });
  });
};
