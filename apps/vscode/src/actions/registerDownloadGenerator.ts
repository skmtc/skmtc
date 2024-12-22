import { commands, window } from 'vscode';
import { readStackConfig } from '../utilities/readStackConfig';
import { writeStackConfig } from '../utilities/writeStackConfig';
import { readDenoJson } from '../utilities/readDenoJson';
import { writeFileSync } from 'node:fs';
import { toRootPath } from '../utilities/getRootPath';
import { join } from 'node:path';
import { z } from 'zod';
import { ExtensionStore } from '../types/ExtensionStore';
import { ensureFileSync } from 'fs-extra';
import { match } from 'ts-pattern';
import { getSession } from '../auth/getSession';
import { getLatestJsrPackageVersion } from '../utilities/getLatestJsrPackageVersion';
import { getDeployedGenerators } from '../utilities/deployedGenerators';

const jsrManifestItem = z.object({
  checksum: z.string(),
  size: z.number(),
});

const jsrManifest = z.record(jsrManifestItem);

const jsrVersionMeta = z.object({
  manifest: jsrManifest,
});

export const registerDownloadGenerator = (store: ExtensionStore) => {
  return commands.registerCommand(
    'skmtc-vscode.downloadGenerator',
    async ({ skipDeployment } = {}) => {
      const session = await getSession({ createIfNone: true });

      if (!session) {
        return;
      }

      const deployedGenerators = getDeployedGenerators();

      const selectedItems = await window.showQuickPick(deployedGenerators, {
        placeHolder: 'Select generators to add',
        canPickMany: true,
      });

      if (!selectedItems?.length) {
        return;
      }

      const userScope = `@${session.account.label}`;

      selectedItems.forEach(async ({ label }) => {
        const [scope, name] = label.split('/');

        const packageVersion = await getLatestJsrPackageVersion({ scope, name });

        const manifest = await getManifest({ scope, name, packageVersion });

        await getFiles({ userScope, scope, name, version: packageVersion, manifest });
      });

      const packageNames = selectedItems.map(({ label }) => label);

      await updateRootDenoJson({
        packageNames,
        denoJsonPath: join(toRootPath(), '.codesquared', 'deno.json'),
      });

      updateStackConfig(packageNames);

      if (skipDeployment) {
        return;
      }

      await commands.executeCommand('skmtc-vscode.deployStack');

      await commands.executeCommand('skmtc-vscode.createSettings');
    }
  );
};

type GetFilesArgs = {
  userScope: string;
  scope: string;
  name: string;
  version: string;
  manifest: z.infer<typeof jsrManifest>;
};

const getFiles = async ({ userScope, scope, name, version, manifest }: GetFilesArgs) => {
  await Object.keys(manifest).forEach(async (file) => {
    const content = await fetchJsrFile({ scope, name, version, file });

    const filePath = join(toRootPath(), '.codesquared', name, file);

    const updatedContent = match(file)
      .with('/src/config.ts', () => {
        return content.replace(`id: '${scope}/${name}'`, `id: '${userScope}/${name}'`);
      })
      .with('/deno.json', () => {
        return content.replace(`"name": "${scope}/${name}"`, `"name": "${userScope}/${name}"`);
      })
      .otherwise(() => content);

    ensureFileSync(filePath);

    writeFileSync(filePath, updatedContent);
  });
};

type GetManifestArgs = {
  scope: string;
  name: string;
  packageVersion: string;
};

const getManifest = async ({ scope, name, packageVersion }: GetManifestArgs) => {
  const contentRes = await fetch(`https://jsr.io/${scope}/${name}/${packageVersion}_meta.json`);

  const possibleContent = await contentRes.json();

  const { manifest } = jsrVersionMeta.parse(possibleContent);

  return manifest;
};

type FetchJsrFileArgs = {
  scope: string;
  name: string;
  version: string;
  file: string;
};

const fetchJsrFile = async ({ scope, name, version, file }: FetchJsrFileArgs) => {
  const res = await fetch(`https://jsr.io/${scope}/${name}/${version}${file}`);

  const text = await res.text();

  return text;
};

type UpdateRootDenoJsonArgs = {
  packageNames: string[];
  denoJsonPath: string;
};

const updateRootDenoJson = async ({ packageNames, denoJsonPath }: UpdateRootDenoJsonArgs) => {
  const denoJsonObject = await readDenoJson(denoJsonPath);

  packageNames.forEach((packageName) => {
    const [_, folderName] = packageName.split('/');

    denoJsonObject.imports[packageName] = `./${folderName}/mod.ts`;

    if (!denoJsonObject.workspace.includes(`./${folderName}`)) {
      denoJsonObject.workspace.push(`./${folderName}`);
    }
  });

  writeFileSync(denoJsonPath, JSON.stringify(denoJsonObject, null, 2));
};

const updateStackConfig = (packageNames: string[]) => {
  const stackConfig = readStackConfig({ applyDefault: true });

  packageNames.forEach((packageName) => {
    if (!stackConfig.generators.includes(packageName)) {
      stackConfig.generators.push(packageName);
    }
  });

  writeStackConfig(stackConfig);
};

const stripRegistryPrefix = (name: string) => {
  if (name.startsWith('jsr:')) {
    return name.replace('jsr:', '');
  }

  if (name.startsWith('npm:')) {
    return name.replace('npm:', '');
  }

  return name;
};
