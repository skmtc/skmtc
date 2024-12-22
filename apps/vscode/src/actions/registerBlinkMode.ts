import { workspace, commands, ExtensionContext, window, Disposable } from 'vscode';
import { ExtensionStore } from '../types/ExtensionStore';
import { toRootPath } from '../utilities/getRootPath';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { toSettingsPath } from '../utilities/toSettingsPath';
import { ensureDirSync } from 'fs-extra';
import { readClientConfig } from '../utilities/readClientConfig';

type RegisterStartBlinkModeArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
};

type LocalStore = {
  disposables: Disposable[];
};

const SERVER_TERMINAL_NAME = 'Blink mode: skmtc';
const BLINK_HOST = '0.0.0.0:8000';

export const registerBlinkMode = ({ store, context }: RegisterStartBlinkModeArgs) => {
  const localStore: LocalStore = {
    disposables: [],
  };

  const start = commands.registerCommand('skmtc-vscode.startBlinkMode', async () => {
    if (store.blinkMode) {
      window.showErrorMessage('Blink mode is already running');
      return;
    }

    store.blinkMode = {
      url: `http://${BLINK_HOST}`,
    };

    if (!existsSync(join(toRootPath(), '.codesquared', 'mod.ts'))) {
      await commands.executeCommand('skmtc-vscode.createBlinkServer');
    }

    if (!existsSync(join(toSettingsPath(), 'client.json'))) {
      await commands.executeCommand('skmtc-vscode.createSettings');
    }

    const clientConfig = readClientConfig({ notifyIfMissing: false });

    const basePath = clientConfig?.settings?.basePath ?? './dist';

    ensureDirSync(store.blinkLogsPath);

    const blinkSkmtcServerTerminal = window.createTerminal({
      name: SERVER_TERMINAL_NAME,
      isTransient: true,
      env: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SKMTC_LOGS_PATH: store.blinkLogsPath,
      },
    });

    const termSub = window.onDidStartTerminalShellExecution(async (event) => {
      if (event.terminal.name !== SERVER_TERMINAL_NAME) {
        return;
      }

      let restart = false;

      for await (const data of event.execution.read()) {
        store.localRuntimeLogs.info(data);

        if (data.toString().includes('File change detected! Restarting!')) {
          restart = true;
        }

        if (restart && data.toString().includes('Server started')) {
          store.localRuntimeLogs.info('SERVER RESTARTED');
          console.log('SERVER RESTARTED');

          store.localRuntimeLogs.info(data.toString());
          console.log(data.toString());

          await commands.executeCommand('skmtc-vscode.createArtifacts');
        }
      }
    });

    blinkSkmtcServerTerminal.show();

    blinkSkmtcServerTerminal.sendText(
      `deno run --allow-read=./.codesquared --allow-write=${basePath},./.codesquared --allow-env=NODE_ENV,SKMTC_LOGS_PATH,DENO_DEPLOYMENT_ID,DENO_REGION --allow-net=${BLINK_HOST} --watch .codesquared/mod.ts`
    );

    const createSettingsAndArtifactsDisposables = watchSchemaAndCreateSettingsAndArtifacts(store);

    const createBlinkServerDisposables = watchStackConfigAndUpdateServer(store);

    const clientConfigDisposables = watchClientConfigAndCreateArtifacts(store);

    localStore.disposables.push(
      termSub,
      blinkSkmtcServerTerminal,
      ...createSettingsAndArtifactsDisposables,
      ...clientConfigDisposables,
      ...createBlinkServerDisposables
    );

    context.subscriptions.push(...localStore.disposables);
  });

  const stop = commands.registerCommand('skmtc-vscode.stopBlinkMode', () => {
    localStore.disposables.forEach((disposable) => {
      disposable.dispose();
    });

    store.blinkMode = undefined;
  });

  return [start, stop, ...localStore.disposables];
};

const watchGeneratorsAndCreateArtifacts = (store: ExtensionStore) => {
  const skmtcPath = join(toRootPath(), '.codesquared');
  const skmtcWatcher = workspace.createFileSystemWatcher(`${skmtcPath}/**/*`);

  const skmtcWatcherDisposable = skmtcWatcher.onDidChange(async (url) => {
    store.localRuntimeLogs.info(`./.codesquared changed: ${url}`);

    setTimeout(async () => {
      await commands.executeCommand('skmtc-vscode.createArtifacts');
    }, 50);
  });

  return [skmtcWatcher, skmtcWatcherDisposable];
};

const watchSchemaAndCreateSettingsAndArtifacts = (store: ExtensionStore) => {
  const schemaWatcher = workspace.createFileSystemWatcher(
    join(toRootPath(), '.codesquared', 'schema.json')
  );

  const schemaWatcherDisposable = schemaWatcher.onDidChange(async () => {
    console.log('Create blink artifacts');

    store.localRuntimeLogs.info('Create blink settings');

    await commands.executeCommand('skmtc-vscode.createSettings');

    store.localRuntimeLogs.info('Create blink artifacts');

    await commands.executeCommand('skmtc-vscode.createArtifacts');

    store.localRuntimeLogs.info('Blink artifacts created');
  });

  return [schemaWatcher, schemaWatcherDisposable];
};

const watchClientConfigAndCreateArtifacts = (store: ExtensionStore) => {
  const schemaWatcher = workspace.createFileSystemWatcher(join(toSettingsPath(), 'client.json'));

  const schemaWatcherDisposable = schemaWatcher.onDidChange(async () => {
    console.log('Create blink artifacts');

    store.localRuntimeLogs.info('Create blink artifacts');

    await commands.executeCommand('skmtc-vscode.createArtifacts');

    store.localRuntimeLogs.info('Blink artifacts created');
  });

  return [schemaWatcher, schemaWatcherDisposable];
};

const watchStackConfigAndUpdateServer = (store: ExtensionStore) => {
  const stackConfigWatcher = workspace.createFileSystemWatcher(
    join(toSettingsPath(), 'stack.json')
  );

  const createBlinkServerDisposable = stackConfigWatcher.onDidChange(async () => {
    store.localRuntimeLogs.info('stack.json changed');

    await commands.executeCommand('skmtc-vscode.createBlinkServer');
  });

  return [stackConfigWatcher, createBlinkServerDisposable];
};
