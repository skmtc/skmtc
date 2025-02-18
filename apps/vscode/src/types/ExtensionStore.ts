import { WebviewPanel, LogOutputChannel } from 'vscode'
import { SettingsDataProvider } from '../providers/SettingsDataProvider'
import { BrowserClient } from '@sentry/browser'
import { ResultsDataProvider } from '../providers/ResultsDataProvider'
import { MilestonesDataProvider } from '../providers/MilestonesDataProvider'

export type DevModeConfig = {
  url: string
}

export type ExtensionStore = {
  sentryClient: BrowserClient
  settingPanel: WebviewPanel | undefined
  pluginPanel: WebviewPanel | undefined
  remoteRuntimeLogs: LogOutputChannel
  remoteDeploymentLogs: LogOutputChannel
  localRuntimeLogs: LogOutputChannel
  settingsDataProvider: SettingsDataProvider
  resultsDataProvider: ResultsDataProvider
  milestonesDataProvider: MilestonesDataProvider
  devMode: DevModeConfig | undefined
  devLogsPath: string
  deploymentLogDisposable:
    | {
        dispose: () => void
      }
    | undefined
}
