import { workspace, commands, ExtensionContext, window, Disposable } from 'vscode'
import { ExtensionStore } from '../types/ExtensionStore'
import { toRootPath } from '../utilities/getRootPath'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { toSettingsPath } from '../utilities/toSettingsPath'
import { ensureDirSync } from 'fs-extra'
import { readClientConfig } from '../utilities/readClientConfig'
import { SkmtcClientConfig } from '@skmtc/core/Settings'

type RegisterStartDevModeArgs = {
  store: ExtensionStore
  context: ExtensionContext
}

type LocalStore = {
  disposables: Disposable[]
}

const SERVER_TERMINAL_NAME = 'Dev mode: skmtc'
const DEV_HOST = '0.0.0.0:8000'

const ALLOWED_ENV_VARS = [
  'NODE_ENV',
  'SKMTC_LOGS_PATH',
  'NODE_DISABLE_COLORS',
  'DENO_DEPLOYMENT_ID',
  'DENO_REGION',
  'GEMINI_API_KEY',
  'DENO_TRACE_PERMISSIONS'
]

export const registerDevMode = ({ store, context }: RegisterStartDevModeArgs) => {
  const localStore: LocalStore = {
    disposables: []
  }

  const start = commands.registerCommand('skmtc-vscode.startDevMode', async () => {
    if (store.devMode) {
      window.showErrorMessage('Dev mode is already running')
      return
    }

    store.devMode = {
      url: `http://${DEV_HOST}`
    }

    if (!existsSync(join(toRootPath(), '.codesquared', 'mod.ts'))) {
      await commands.executeCommand('skmtc-vscode.createDevServer')
    }

    if (!existsSync(join(toSettingsPath(), 'client.json'))) {
      await commands.executeCommand('skmtc-vscode.createSettings')
    }

    const clientConfig = readClientConfig({ notifyIfMissing: false })

    ensureDirSync(store.devLogsPath)

    const devSkmtcServerTerminal = window.createTerminal({
      name: SERVER_TERMINAL_NAME,
      isTransient: true,
      env: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        SKMTC_LOGS_PATH: store.devLogsPath
      }
    })

    const termSub = window.onDidStartTerminalShellExecution(async event => {
      if (event.terminal.name !== SERVER_TERMINAL_NAME) {
        return
      }

      let restart = false

      for await (const data of event.execution.read()) {
        store.localRuntimeLogs.info(data)

        if (data.toString().includes('File change detected! Restarting!')) {
          restart = true
        }

        if (restart && data.toString().includes('Server started')) {
          store.localRuntimeLogs.info('SERVER RESTARTED')
          console.log('SERVER RESTARTED')

          store.localRuntimeLogs.info(data.toString())
          console.log(data.toString())

          await commands.executeCommand('skmtc-vscode.createArtifacts')
        }
      }
    })

    devSkmtcServerTerminal.show()

    devSkmtcServerTerminal.sendText(`deno run ${toDenoLaunchParams({ clientConfig })}`)

    const createSettingsAndArtifactsDisposables = watchSchemaAndCreateSettingsAndArtifacts(store)

    const createDevServerDisposables = watchStackConfigAndUpdateServer(store)

    const clientConfigDisposables = watchClientConfigAndCreateArtifacts(store)

    localStore.disposables.push(
      termSub,
      devSkmtcServerTerminal,
      ...createSettingsAndArtifactsDisposables,
      ...clientConfigDisposables,
      ...createDevServerDisposables
    )

    context.subscriptions.push(...localStore.disposables)
  })

  const stop = commands.registerCommand('skmtc-vscode.stopDevMode', () => {
    localStore.disposables.forEach(disposable => {
      disposable.dispose()
    })

    store.devMode = undefined
  })

  return [start, stop, ...localStore.disposables]
}

type ToDenoLaunchParamsArgs = {
  clientConfig: SkmtcClientConfig | undefined
}

const toDenoLaunchParams = ({ clientConfig }: ToDenoLaunchParamsArgs) => {
  const basePath = clientConfig?.settings?.basePath ?? './dist'

  const denoCachePaths = [
    join(homedir(), 'Library', 'Caches', 'deno', 'node_modules'),
    join(homedir(), 'Library', 'Caches', 'node_modules'),
    join(homedir(), 'Library', 'node_modules'),
    join(homedir(), 'node_modules'),
    join('/Users', 'node_modules'),
    '/node_modules'
  ]

  const allowRead = ['./.codesquared', ...denoCachePaths].join(',')
  const allowWrite = [basePath, './.codesquared'].join(',')
  const allowEnv = ALLOWED_ENV_VARS.join(',')
  const allowNet = [DEV_HOST, 'generativelanguage.googleapis.com:443'].join(',')

  return `--allow-read=${allowRead} --allow-write=${allowWrite} --allow-env=${allowEnv} --allow-net=${allowNet} --watch .codesquared/mod.ts`
}

const watchGeneratorsAndCreateArtifacts = (store: ExtensionStore) => {
  const skmtcPath = join(toRootPath(), '.codesquared')
  const skmtcWatcher = workspace.createFileSystemWatcher(`${skmtcPath}/**/*`)

  const skmtcWatcherDisposable = skmtcWatcher.onDidChange(async url => {
    store.localRuntimeLogs.info(`./.codesquared changed: ${url}`)

    setTimeout(async () => {
      await commands.executeCommand('skmtc-vscode.createArtifacts')
    }, 50)
  })

  return [skmtcWatcher, skmtcWatcherDisposable]
}

const watchSchemaAndCreateSettingsAndArtifacts = (store: ExtensionStore) => {
  const schemaWatcher = workspace.createFileSystemWatcher(
    join(toRootPath(), '.codesquared', 'schema.json')
  )

  const schemaWatcherDisposable = schemaWatcher.onDidChange(async () => {
    console.log('Create dev artifacts')

    store.localRuntimeLogs.info('Create dev settings')

    await commands.executeCommand('skmtc-vscode.createSettings')

    store.localRuntimeLogs.info('Create dev artifacts')

    await commands.executeCommand('skmtc-vscode.createArtifacts')

    store.localRuntimeLogs.info('Dev artifacts created')
  })

  return [schemaWatcher, schemaWatcherDisposable]
}

const watchClientConfigAndCreateArtifacts = (store: ExtensionStore) => {
  const schemaWatcher = workspace.createFileSystemWatcher(join(toSettingsPath(), 'client.json'))

  const schemaWatcherDisposable = schemaWatcher.onDidChange(async () => {
    console.log('Create dev artifacts')

    store.localRuntimeLogs.info('Create dev artifacts')

    await commands.executeCommand('skmtc-vscode.createArtifacts')

    store.localRuntimeLogs.info('Dev artifacts created')
  })

  return [schemaWatcher, schemaWatcherDisposable]
}

const watchStackConfigAndUpdateServer = (store: ExtensionStore) => {
  const stackConfigWatcher = workspace.createFileSystemWatcher(join(toSettingsPath(), 'stack.json'))

  const createDevServerDisposable = stackConfigWatcher.onDidChange(async () => {
    store.localRuntimeLogs.info('stack.json changed')

    await commands.executeCommand('skmtc-vscode.createDevServer')
  })

  return [stackConfigWatcher, createDevServerDisposable]
}
