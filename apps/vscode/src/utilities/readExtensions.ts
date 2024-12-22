import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';
import { Extensions } from '@skmtc/core/Extensions';
import { toSettingsPath } from './toSettingsPath';
import { z } from 'zod';

type ReadClientConfigArgs = {
  notifyIfMissing?: boolean;
};

export const readExtensions = ({ notifyIfMissing }: ReadClientConfigArgs = {}):
  | Extensions
  | undefined => {
  const extensionsFilePath = path.resolve(toSettingsPath(), 'extensions.json');

  if (!fs.existsSync(extensionsFilePath)) {
    if (notifyIfMissing) {
      window.showErrorMessage(`Extensions file not found at '${extensionsFilePath}'`);
    }

    return;
  }

  const extensionsFile = fs.readFileSync(extensionsFilePath, 'utf-8');

  const parsed = JSON.parse(extensionsFile);

  return z.record(z.unknown()).parse(parsed) as Extensions;
};
