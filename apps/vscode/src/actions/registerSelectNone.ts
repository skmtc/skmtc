import { commands } from 'vscode';
import { readClientConfig } from '../utilities/readClientConfig';
import { match, P } from 'ts-pattern';
import { writeClientConfig } from '../utilities/writeClientConfig';
import { Method } from '@skmtc/core/Method';

export const registerSelectNone = () => {
  return commands.registerCommand('skmtc-vscode.selectNone', () => {
    const clientConfig = readClientConfig({ notifyIfMissing: true });

    if (!clientConfig) {
      return;
    }

    clientConfig.settings.generators.forEach((generatorSettings) => {
      match(generatorSettings)
        .with({ operations: P.any }, (matched) => {
          Object.values(matched.operations).forEach((methodObject) => {
            Object.keys(methodObject).forEach((method) => {
              methodObject[method as Method] = false;
            });
          });
        })
        .with({ models: P.any }, (matched) => {
          Object.keys(matched.models).forEach((model) => {
            matched.models[model] = false;
          });
        })
        .exhaustive();
    });

    writeClientConfig(clientConfig);
  });
};
