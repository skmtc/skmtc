/* eslint-disable @typescript-eslint/naming-convention */
import { readFileSync } from 'node:fs';
import { getLatestJsrPackageVersion } from './getLatestJsrPackageVersion';
import { window } from 'vscode';

export const readDenoJson = async (denoJsonPath: string) => {
  try {
    const denoJson = readFileSync(denoJsonPath, 'utf-8');

    const denoJsonObject = JSON.parse(denoJson);

    return denoJsonObject;
  } catch (error) {
    return await createEmptyDenoJSON();
  }
};

export const createEmptyDenoJSON = async () => {
  try {
    const coreVersion = await getLatestJsrPackageVersion({ scope: '@skmtc', name: 'core' });
    const serverVersion = await getLatestJsrPackageVersion({ scope: '@skmtc', name: 'server' });

    return {
      imports: {
        '@skmtc/core': `jsr:@skmtc/core@${coreVersion}`,
        '@skmtc/server': `jsr:@skmtc/server@${serverVersion}`,
      },
      workspace: [],
    };
  } catch (error) {
    window.showErrorMessage('Failed to get latest versions. Using empty as fallback');

    return {
      imports: {
        '@skmtc/core': 'jsr:@skmtc/core',
        '@skmtc/server': 'jsr:@skmtc/server',
      },
      workspace: [],
    };
  }
};
