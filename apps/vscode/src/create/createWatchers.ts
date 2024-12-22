import { workspace, TreeView, Disposable } from 'vscode';
import { ExtensionStore } from '../types/ExtensionStore';
import { SettingsNode } from '../settings/SettingsNode';
import { toRootPath } from '../utilities/getRootPath';
import { join } from 'node:path';
import { readClientConfig } from '../utilities/readClientConfig';
import { readManifest } from '../utilities/readManifest';
import { toSettingsPath } from '../utilities/toSettingsPath';
import { readExtensions } from '../utilities/readExtensions';

type CreateWatchersArgs = {
  store: ExtensionStore;
  settingsTreeView: TreeView<SettingsNode>;
};

export const createWatchers = ({ store, settingsTreeView }: CreateWatchersArgs): Disposable[] => {
  let currentRootPath = toRootPath();

  const workspaceWatcher = workspace.onDidOpenTextDocument((e) => {
    const newRootPath = toRootPath();

    if (newRootPath && newRootPath !== currentRootPath) {
      currentRootPath = newRootPath;

      filesUpdated({ store, settingsTreeView });
    }
  });

  const extensionsConfigWatcher = workspace.createFileSystemWatcher(
    join(toSettingsPath(), 'extensions.json')
  );

  const extensionsConfigCreateWatcherDisposable = extensionsConfigWatcher.onDidCreate(() => {
    filesUpdated({ store, settingsTreeView });
  });

  const extensionsConfigChangeWatcherDisposable = extensionsConfigWatcher.onDidChange(() =>
    filesUpdated({ store, settingsTreeView })
  );

  const clientConfigWatcher = workspace.createFileSystemWatcher(
    join(toSettingsPath(), 'client.json')
  );

  const clientConfigCreateWatcherDisposable = clientConfigWatcher.onDidCreate(() => {
    clientConfigCreated({ store });

    filesUpdated({ store, settingsTreeView });
  });

  const clientConfigChangeWatcherDisposable = clientConfigWatcher.onDidChange(() =>
    filesUpdated({ store, settingsTreeView })
  );

  const jsonSchemaWatcher = workspace.createFileSystemWatcher(
    join(currentRootPath, '.codesquared', 'schema.json')
  );

  const jsonSchemaCreateDisposable = jsonSchemaWatcher.onDidCreate(() => {
    filesUpdated({ store, settingsTreeView });
  });

  const jsonSchemaDeleteDisposable = jsonSchemaWatcher.onDidDelete(() => {
    filesUpdated({ store, settingsTreeView });
  });

  const yamlSchemaWatcher = workspace.createFileSystemWatcher(
    join(currentRootPath, '.codesquared', 'schema.yaml')
  );

  const yamlSchemaCreateDisposable = yamlSchemaWatcher.onDidCreate(() => {
    filesUpdated({ store, settingsTreeView });
  });

  const yamlSchemaDeleteDisposable = yamlSchemaWatcher.onDidDelete(() => {
    filesUpdated({ store, settingsTreeView });
  });

  const manifestWatcher = workspace.createFileSystemWatcher(
    join(toSettingsPath(), 'manifest.json')
  );

  const manifestWatcherDisposable = manifestWatcher.onDidChange(() => {
    const manifest = readManifest();

    if (manifest) {
      store.resultsDataProvider.refresh({ manifest });
    }

    filesUpdated({ store, settingsTreeView });
  });

  const manifestCreateWatcherDisposable = manifestWatcher.onDidCreate(() => {
    const manifest = readManifest();
    if (manifest) {
      store.resultsDataProvider.refresh({ manifest });
    }

    filesUpdated({ store, settingsTreeView });
  });

  return [
    workspaceWatcher,
    clientConfigWatcher,
    clientConfigChangeWatcherDisposable,
    extensionsConfigWatcher,
    extensionsConfigCreateWatcherDisposable,
    extensionsConfigChangeWatcherDisposable,
    jsonSchemaWatcher,
    jsonSchemaCreateDisposable,
    jsonSchemaDeleteDisposable,
    yamlSchemaWatcher,
    yamlSchemaCreateDisposable,
    yamlSchemaDeleteDisposable,
    manifestWatcher,
    manifestWatcherDisposable,
    manifestCreateWatcherDisposable,
    clientConfigCreateWatcherDisposable,
  ];
};

type FilesUpdatedArgs = {
  store: ExtensionStore;
  settingsTreeView: TreeView<SettingsNode>;
};

export const filesUpdated = async ({ store, settingsTreeView }: FilesUpdatedArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: false });

  const extensions = readExtensions();
  store.settingsDataProvider.refresh({ clientConfig, extensions });

  if (
    store.statusBarItem &&
    clientConfig?.stackName &&
    store.stackName !== clientConfig.stackName
  ) {
    store.statusBarItem.text = `$(github-action) ${clientConfig.stackName}`;
    store.statusBarItem.show();
  }

  store.stackName = clientConfig?.stackName;

  settingsTreeView.description = clientConfig?.stackName;

  if (store.deploymentId !== clientConfig?.deploymentId) {
    store.remoteRuntimeLogs.clear();
    store.deploymentLogDisposable?.dispose();
  }

  store.deploymentId = clientConfig?.deploymentId;

  if (!clientConfig) {
    return;
  }

  store.settingsDataProvider.refresh({ clientConfig, extensions });
  store.milestonesDataProvider.refresh();
};

type ClientConfigCreatedArgs = {
  store: ExtensionStore;
};

const clientConfigCreated = ({ store }: ClientConfigCreatedArgs) => {
  const clientConfig = readClientConfig({ notifyIfMissing: true });
  const extensions = readExtensions();

  if (!clientConfig) {
    return;
  }

  const { deploymentId, serverName } = clientConfig;

  if (!deploymentId || !serverName) {
    return;
  }

  store.settingsDataProvider.refresh({ clientConfig, extensions });
};
