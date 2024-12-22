import { join } from 'node:path';
import { toRootPath } from './getRootPath';

export const toSettingsPath = () => {
  const rootPath = toRootPath();

  return join(rootPath, '.codesquared', '.settings');
};
