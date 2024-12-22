import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';
import { ManifestContent, manifestContent } from '@skmtc/core/Manifest';
import { toSettingsPath } from './toSettingsPath';

type ReadClientConfigArgs = {
  notifyIfMissing?: boolean;
};

export const readManifest = ({ notifyIfMissing }: ReadClientConfigArgs = {}):
  | ManifestContent
  | undefined => {
  const manifestFilePath = path.resolve(toSettingsPath(), 'manifest.json');

  if (!fs.existsSync(manifestFilePath)) {
    if (notifyIfMissing) {
      window.showErrorMessage(`Manifest file not found at '${manifestFilePath}'`);
    }

    return;
  }

  const manifestFile = fs.readFileSync(manifestFilePath, 'utf-8');

  const parsed = JSON.parse(manifestFile);

  return manifestContent.parse(parsed);
};
