import * as fs from 'fs';
import * as path from 'path';
import { toRootPath } from './getRootPath';

export const createPluginFolder = (pluginSource: string) => {
  const rootPath = toRootPath();

  const resolvedPluginSource = path.resolve(rootPath, pluginSource);

  if (!fs.existsSync(resolvedPluginSource)) {
    fs.mkdirSync(resolvedPluginSource, { recursive: true });
  }
};
