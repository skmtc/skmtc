import * as fs from 'fs';
import * as path from 'path';
import { SkmtcStackConfig } from '@skmtc/core/Settings';
import { toSettingsPath } from './toSettingsPath';
import { ensureFileSync } from 'fs-extra';

export const writeStackConfig = (pluginsData: SkmtcStackConfig) => {
  const stackConfigFilePath = path.resolve(toSettingsPath(), 'stack.json');

  ensureFileSync(stackConfigFilePath);

  fs.writeFileSync(stackConfigFilePath, JSON.stringify(pluginsData, null, 2));
};
