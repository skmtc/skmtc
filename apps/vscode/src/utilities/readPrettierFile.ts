import * as fs from 'fs';
import * as path from 'path';
import { toRootPath } from './getRootPath';

export const readPrettierFile = () => {
  const rootPath = toRootPath();

  const prettierFilePath = path.resolve(rootPath, '.codesquared', '.prettierrc.json');

  if (!fs.existsSync(prettierFilePath)) {
    return;
  }

  const prettierString = fs.readFileSync(prettierFilePath, 'utf-8');

  return JSON.parse(prettierString);
};
