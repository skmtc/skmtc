import * as fs from 'fs';
import * as path from 'path';
import { skmtcClientConfig, SkmtcClientConfig } from '@skmtc/core/Settings';
import { window } from 'vscode';
import { toSettingsPath } from './toSettingsPath';

type ReadClientConfigArgs = {
  notifyIfMissing?: boolean;
};

export const readClientConfig = ({ notifyIfMissing }: ReadClientConfigArgs = {}):
  | SkmtcClientConfig
  | undefined => {
  const clientConfigPath = path.resolve(toSettingsPath(), 'client.json');

  if (!fs.existsSync(clientConfigPath)) {
    if (notifyIfMissing) {
      window.showErrorMessage(`Client settings file not found at '${clientConfigPath}'`);
    }

    return;
  }

  const clientConfigFile = fs.readFileSync(clientConfigPath, 'utf-8');

  const parsed = JSON.parse(clientConfigFile);

  const clientConfig = skmtcClientConfig.parse(parsed);

  return clientConfig;
};
