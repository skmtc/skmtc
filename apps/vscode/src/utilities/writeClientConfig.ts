import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { SkmtcClientConfig } from '@skmtc/core/Settings';
import { toSettingsPath } from './toSettingsPath';

export const writeClientConfig = (settingsData: SkmtcClientConfig) => {
  const clientConfigFilePath = resolve(toSettingsPath(), 'client.json');

  writeFileSync(clientConfigFilePath, JSON.stringify(settingsData, null, 2));
};
