import { WebviewPanel, LogOutputChannel, StatusBarItem, Terminal } from 'vscode';
import { SettingsDataProvider } from '../providers/SettingsDataProvider';
import { BrowserClient } from '@sentry/browser';
import { ResultsDataProvider } from '../providers/ResultsDataProvider';
import { MilestonesDataProvider } from '../providers/MilestonesDataProvider';

export type BlinkModeConfig = {
  url: string;
};

export type ExtensionStore = {
  sentryClient: BrowserClient;
  settingPanel: WebviewPanel | undefined;
  pluginPanel: WebviewPanel | undefined;
  remoteRuntimeLogs: LogOutputChannel;
  remoteDeploymentLogs: LogOutputChannel;
  localRuntimeLogs: LogOutputChannel;
  deploymentId: string | undefined;
  serverName: string | undefined;
  stackName: string | undefined;
  statusBarItem: StatusBarItem | undefined;
  settingsDataProvider: SettingsDataProvider;
  resultsDataProvider: ResultsDataProvider;
  milestonesDataProvider: MilestonesDataProvider;
  blinkMode: BlinkModeConfig | undefined;
  blinkLogsPath: string;
  deploymentLogDisposable:
    | {
        dispose: () => void;
      }
    | undefined;
};
