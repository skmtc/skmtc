import * as fs from 'fs';
import * as path from 'path';
import { toRootPath } from './getRootPath';

export const renamePluginFolder = (previousName: string, newName: string) => {
  const rootPath = toRootPath();

  const previousResolved = path.resolve(rootPath, previousName);

  const newResolved = path.resolve(rootPath, newName);

  if (!fs.existsSync(previousResolved)) {
    fs.renameSync(previousResolved, newResolved);
  }
};
