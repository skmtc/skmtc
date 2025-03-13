import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
  browserTracingIntegration
} from '@sentry/browser'

// filter integrations that use the global variable
const integrations = getDefaultIntegrations({}).filter(defaultIntegration => {
  return !['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'].includes(defaultIntegration.name)
})

const sentryClient = new BrowserClient({
  dsn: 'https://7a355019ba7b35638851a843ea1b548b@o4508018789646336.ingest.de.sentry.io/4508018833555536',
  transport: makeFetchTransport,
  stackParser: defaultStackParser,
  integrations: [...integrations, browserTracingIntegration()],
  tracesSampleRate: 1.0,
  _experiments: {
    maxSpans: 2000
  },
  normalizeMaxBreadth: 2000
})

const scope = new Scope()
scope.setClient(sentryClient)

sentryClient.init() // initializing has to be done after setting the sentryClient on the scope
import { ExtensionContext, window } from 'vscode'
import { SettingsDataProvider } from './providers/SettingsDataProvider'
import { ExtensionStore } from './types/ExtensionStore'
import { handleCheckboxStateChange } from './settings/handleCheckboxStateChange'
import { readClientConfig } from './utilities/readClientConfig'
import { registerCreateDeployment } from './actions/registerCreateDeployment'
import { SupabaseAuthenticationProvider } from './auth/supabaseAuthenticationProviderRemote'
import { registerCreateArtifacts } from './actions/registerCreateArtifacts'
import { registerCreateSettings } from './actions/registerCreateSettings'
import { registerDeleteArtifacts } from './actions/registerDeleteArtifacts'
import { readManifest } from './utilities/readManifest'
import { createWatchers } from './create/createWatchers'
import { registerAuth } from './actions/registerAuth'
import { registerSelectAll } from './actions/registerSelectAll'
import { registerSelectNone } from './actions/registerSelectNone'
import { ResultsDataProvider } from './providers/ResultsDataProvider'
import { createSettingsView } from './create/createSettingsView'
import { registerResultsTreeItemClicked } from './actions/registerResultsTreeItemClicked'
import { registerShowProjectName } from './actions/registerShowProjectName'
import { createResultsView } from './create/createResultsView'
import { registerCreateGenerator } from './actions/registerCreateGenerator'
import { registerAddExternalGenerator } from './actions/registerAddExternalGenerator'
import { registerDevMode } from './actions/registerDevMode'
import { registerCreateDevServer } from './actions/registerCreateDevServer'
import { toRootPath } from './utilities/getRootPath'
import { join } from 'node:path'
import { registerDownloadGenerator } from './actions/registerDownloadGenerator'
import { registerCreateStack } from './actions/registerCreateStack'
import { MilestonesDataProvider } from './providers/MilestonesDataProvider'
import { createMilestonesView } from './create/createMilestonesView'
import { registerAddGenerator } from './actions/registerAddGenerator'
import { registerAddOpenApiSchema } from './actions/registerAddOpenApiSchema'
import { readStackConfig } from './utilities/readStackConfig'
import { registerSetApiOrigin } from './actions/registerSetApiOrigin'
export async function activate(context: ExtensionContext) {
  try {
    const clientConfig = readClientConfig({ notifyIfMissing: false })
    const stackConfig = readStackConfig({ notifyIfMissing: false })

    const manifest = readManifest()

    const store: ExtensionStore = {
      sentryClient: sentryClient,
      settingPanel: undefined,
      pluginPanel: undefined,
      deploymentLogDisposable: undefined,
      devMode: undefined,
      devLogsPath: join(toRootPath(), '.codesquared', '.logs'),
      remoteRuntimeLogs: window.createOutputChannel('Skmtc runtime logs', { log: true }),
      remoteDeploymentLogs: window.createOutputChannel('Skmtc deployment logs', { log: true }),
      localRuntimeLogs: window.createOutputChannel('Skmtc local logs', { log: true }),
      settingsDataProvider: new SettingsDataProvider({ clientConfig }),
      resultsDataProvider: new ResultsDataProvider({ manifest }),
      milestonesDataProvider: new MilestonesDataProvider()
    }

    store.localRuntimeLogs.info('Skmtc extension activated')

    const authProvider = new SupabaseAuthenticationProvider(context)
    const authDisposables = registerAuth(authProvider)

    // Create a tree view to contain settings items
    const settingsTreeView = createSettingsView({
      store,
      accountName: clientConfig?.accountName,
      stackName: stackConfig?.name
    })

    const resultsTreeView = createResultsView({ store })

    const milestonesTreeView = createMilestonesView({ store })

    const watcherDisposables = createWatchers({ store, settingsTreeView })

    const checkBoxDisposable = settingsTreeView.onDidChangeCheckboxState(handleCheckboxStateChange)

    // Add commands to the extension context
    context.subscriptions.push(
      ...watcherDisposables,
      ...authDisposables,
      settingsTreeView,
      resultsTreeView,
      milestonesTreeView,
      registerAddOpenApiSchema(),
      registerSetApiOrigin({ context, store }),
      registerAddGenerator(store),
      registerCreateStack(store),
      registerCreateDevServer(store),
      registerCreateArtifacts({ context, store }),
      ...registerDevMode({ store, context }),
      registerCreateGenerator(),
      registerAddExternalGenerator(store),
      registerShowProjectName(),
      registerDownloadGenerator(store),
      registerDeleteArtifacts({ store, settingsTreeView }),
      registerResultsTreeItemClicked({ resultsTreeView, store, context }),
      registerCreateDeployment({ context, store }),
      registerCreateSettings({ store, context }),
      registerSelectAll(),
      registerSelectNone(),
      authProvider,
      checkBoxDisposable
    )
  } catch (error) {
    console.error('ERROR', error)
    scope.captureException(error)
  }
}
