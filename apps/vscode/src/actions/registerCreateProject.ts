import { commands, window } from 'vscode';
import { createEmptyStackConfig } from '../utilities/readStackConfig';
import { writeStackConfig } from '../utilities/writeStackConfig';
import { createEmptyDenoJSON } from '../utilities/readDenoJson';
import { writeFileSync } from 'node:fs';
import { toRootPath } from '../utilities/getRootPath';
import { join } from 'node:path';
import { ensureFile } from 'fs-extra';
import { ExtensionStore } from '../types/ExtensionStore';

export const registerCreateProject = (store: ExtensionStore) => {
  return commands.registerCommand('skmtc-vscode.createProject', async () => {
    const name = await window.showInputBox({
      title: 'Enter project name',
      validateInput: (value) => {
        const trimmed = value.trim();

        if (trimmed.length < 3) {
          return 'Project name must be at least 3 characters long';
        }

        if (trimmed.length > 20) {
          return 'Project name must be less than 20 characters long';
        }

        if (!/^[a-z0-9-]+$/.test(trimmed)) {
          return 'Project name must only contain lowercase letters, numbers and hyphens';
        }

        if (trimmed.startsWith('-')) {
          return 'Project name cannot start with a hyphen';
        }

        if (trimmed.endsWith('-')) {
          return 'Project name cannot end with a hyphen';
        }

        return null;
      },
    });

    if (!name) {
      return;
    }

    const denoJsonPath = join(toRootPath(), '.codesquared', 'deno.json');

    const denoJsonObject = await createEmptyDenoJSON();

    await ensureFile(denoJsonPath);

    writeFileSync(denoJsonPath, JSON.stringify(denoJsonObject, null, 2));

    writeStackConfig(createEmptyStackConfig(name));

    store.milestonesDataProvider.refresh();
  });
};
