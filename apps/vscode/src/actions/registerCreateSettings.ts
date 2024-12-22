import { commands, ProgressLocation, window } from 'vscode';
import { readSchemaFile } from '../utilities/readSchemaFile';
import { readClientConfig } from '../utilities/readClientConfig';
import { toServerUrl } from '../utilities/toServerUrl';
import { z } from 'zod';
import { clientGeneratorSettings } from '@skmtc/core/Settings';
import { createSettings } from '../api/createSettings';
import { writeClientConfig } from '../utilities/writeClientConfig';
import { ExtensionStore } from '../types/ExtensionStore';
import { writeExtensions } from '../utilities/writeExtensions';
import { Extensions } from '@skmtc/core/Extensions';
import { readExtensions } from '../utilities/readExtensions';

export const registerCreateSettings = (store: ExtensionStore) => {
  return commands.registerCommand('skmtc-vscode.createSettings', ({ selectAll } = {}) => {
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Generate settings',
        cancellable: false,
      },
      async (progress, token) => {
        // token.onCancellationRequested(() => {
        //   console.log('User canceled the long running operation');
        // });

        progress.report({ message: 'running' });

        return new Promise<void>((resolve) => {
          callCreateSettings(store)
            .then(() => {
              if (selectAll) {
                commands.executeCommand('skmtc-vscode.selectAll');
              }

              window.showInformationMessage('Settings refreshed successfully');
              resolve();
            })
            .catch((error) => {
              window.showErrorMessage(`Failed to refresh settings: ${error}`);
              resolve();
            });
        });
      }
    );
  });
};

const createSettingsRespose = z.object({
  generators: z.array(clientGeneratorSettings),
  extensions: z.record(z.unknown()),
});

const callCreateSettings = async (store: ExtensionStore) => {
  const clientConfig = readClientConfig({ notifyIfMissing: true });

  if (!clientConfig) {
    return;
  }

  const { serverName } = clientConfig;

  if (!serverName) {
    window.showErrorMessage(`client.json is missing a 'serverName' field`);
    return;
  }

  const schema = readSchemaFile({ notifyIfMissing: true });

  if (!schema) {
    return;
  }

  const serverUrl = store.blinkMode?.url ?? toServerUrl({ serverName });

  const res = await createSettings({
    store,
    serverUrl,
    schema,
    extensions: readExtensions() ?? {},
    clientSettings: clientConfig.settings,
    defaultSelected: Boolean(store.blinkMode?.url),
  });

  const { generators, extensions } = createSettingsRespose.parse(res);

  clientConfig.settings.generators = generators;

  writeClientConfig(clientConfig);
  writeExtensions(extensions as Extensions);
};
