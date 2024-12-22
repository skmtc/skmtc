import { commands, QuickPickItem, ThemeIcon, window } from 'vscode';
import { readStackConfig } from '../utilities/readStackConfig';
import { writeStackConfig } from '../utilities/writeStackConfig';
import { readDenoJson } from '../utilities/readDenoJson';
import { writeFileSync } from 'node:fs';
import { toRootPath } from '../utilities/getRootPath';
import { join } from 'node:path';
import { ExtensionStore } from '../types/ExtensionStore';
import { getLatestJsrPackageVersion } from '../utilities/getLatestJsrPackageVersion';
import { ensureFile } from 'fs-extra';
import { readClientConfig } from '../utilities/readClientConfig';
import { getDeployedGenerators } from '../utilities/deployedGenerators';

export const registerAddExternalGenerator = (store: ExtensionStore) => {
  return commands.registerCommand(
    'skmtc-vscode.addExternalGenerator',
    async ({ skipDeployment } = {}) => {
      const deployedGenerators = getDeployedGenerators();

      const selectedItems = await window.showQuickPick(deployedGenerators, {
        placeHolder: 'Select generators to add',
        canPickMany: true,
      });

      if (!selectedItems?.length) {
        return;
      }

      const packagePromises = selectedItems.map(async ({ label: packageName }) => {
        const [scope, name] = packageName.split('/');

        const latestVersion = await getLatestJsrPackageVersion({ scope, name });

        return { packageName, latestVersion };
      });

      const packages = await Promise.all(packagePromises);

      await updateRootDenoJson({
        packages,
        denoJsonPath: join(toRootPath(), '.codesquared', 'deno.json'),
      });

      updateStackConfig(packages);

      if (skipDeployment) {
        return;
      }

      await commands.executeCommand('skmtc-vscode.deployStack');

      if (readClientConfig({ notifyIfMissing: false })) {
        await commands.executeCommand('skmtc-vscode.createSettings');
      }
    }
  );
};

type Package = { packageName: string; latestVersion: string };

type UpdateRootDenoJsonArgs = {
  packages: Package[];
  denoJsonPath: string;
};

const updateRootDenoJson = async ({ packages, denoJsonPath }: UpdateRootDenoJsonArgs) => {
  const denoJsonObject = await readDenoJson(denoJsonPath);

  packages.forEach(({ packageName, latestVersion }: Package) => {
    denoJsonObject.imports[packageName] = `jsr:${packageName}@${latestVersion}`;
  });

  await ensureFile(denoJsonPath);

  writeFileSync(denoJsonPath, JSON.stringify(denoJsonObject, null, 2));
};

const updateStackConfig = (packages: Package[]) => {
  const stackConfig = readStackConfig({ applyDefault: true });

  packages.forEach(({ packageName }) => {
    stackConfig.generators.push(packageName);
  });

  writeStackConfig(stackConfig);
};
