import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { toSettingsPath } from './toSettingsPath';
import { Extensions } from '@skmtc/core/Extensions';

export const writeExtensions = (extensions: Extensions) => {
  const extensionsFilePath = resolve(toSettingsPath(), 'extensions.json');

  writeFileSync(extensionsFilePath, JSON.stringify(extensions, null, 2));
};
