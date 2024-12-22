import { commands } from 'vscode';
import { ExtensionStore } from '../types/ExtensionStore';
import { readStackConfig } from '../utilities/readStackConfig';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { toRootPath } from '../utilities/getRootPath';
import { camelCase } from '@skmtc/core/strings';

export const registerCreateBlinkServer = (store: ExtensionStore) => {
  return commands.registerCommand('skmtc-vscode.createBlinkServer', () => {
    const stackConfig = readStackConfig({ notifyIfMissing: true });

    if (!stackConfig) {
      return;
    }

    const importsGenerators = toImportsGenerators(stackConfig.generators);

    const mod = toMod({ ...importsGenerators });

    writeFileSync(join(toRootPath(), '.codesquared', 'mod.ts'), mod);

    store.localRuntimeLogs.info('Blink server created');
  });
};

type ImportsGenerators = {
  imports: string[];
  generators: string[];
};

const toImportsGenerators = (generatorIds: string[]) => {
  return generatorIds.reduce<ImportsGenerators>(
    (acc, generatorId) => {
      const name = camelCase(generatorId);

      acc.imports.push(`import ${name} from '${generatorId}'`);
      acc.generators.push(`${name}`);

      return acc;
    },
    {
      imports: [],
      generators: [],
    }
  );
};

const toMod = ({ imports, generators }: ImportsGenerators) => {
  return `import { createServer } from '@skmtc/server'
${imports.join('\n')}

Deno.serve({
    onListen: ({hostname, port}) => console.log(\`Server started on http://\${hostname}:\${port}\`)
  },
  createServer({ generators: [${generators.join(', ')}], logsPath: Deno.env.get('SKMTC_LOGS_PATH') }).fetch
);
`;
};
