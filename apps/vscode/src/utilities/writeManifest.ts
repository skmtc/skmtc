import * as fs from 'fs';
import * as path from 'path';
import { ManifestContent } from '@skmtc/core/Manifest';
import { toSettingsPath } from './toSettingsPath';

export const writeManifest = (manifest: ManifestContent) => {
  const manifestFilePath = path.resolve(toSettingsPath(), 'manifest.json');

  fs.writeFileSync(manifestFilePath, manifest ? JSON.stringify(manifest, null, 2) : '');
};
