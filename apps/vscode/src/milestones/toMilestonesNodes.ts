import { commands, ThemeColor, ThemeIcon } from 'vscode'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { toRootPath } from '../utilities/getRootPath'
import { readStackConfig } from '../utilities/readStackConfig'
import { readClientConfig } from '../utilities/readClientConfig'
import { toSettingsPath } from '../utilities/toSettingsPath'
import { MilestonesNode } from './MileStonesNode'

const successIcon = new ThemeIcon('pass-filled', new ThemeColor('charts.green'))
const todoIcon = new ThemeIcon('circle-large-outline', new ThemeColor('charts.gray'))

export const toMilestonesNodes = (): MilestonesNode[] => {
  const withProject = hasProject()

  const withGenerator = hasGenerator()

  const withSchema =
    existsSync(join(toRootPath(), '.codesquared', 'schema.json')) ||
    existsSync(join(toRootPath(), '.codesquared', 'schema.yaml'))

  const withDeployment = hasDeployment()

  const withSettings = hasSettings()

  const withArtifacts = existsSync(join(toSettingsPath(), 'manifest.json'))

  commands.executeCommand('setContext', 'skmtc-vscode.withProject', withProject)
  commands.executeCommand('setContext', 'skmtc-vscode.withGenerator', withGenerator)
  commands.executeCommand('setContext', 'skmtc-vscode.withSchema', withSchema)
  commands.executeCommand('setContext', 'skmtc-vscode.withDeployment', withDeployment)
  commands.executeCommand('setContext', 'skmtc-vscode.withSettings', withSettings)
  commands.executeCommand('setContext', 'skmtc-vscode.withArtifacts', withArtifacts)

  return [
    new MilestonesNode({
      nodeId: 'hasProject',
      nodeLabel: 'Create generator stack',
      command: !withProject
        ? {
            title: 'Click here to create new generator stack',
            command: 'skmtc-vscode.createStack'
          }
        : undefined,
      icon: withProject ? successIcon : todoIcon
    }),
    new MilestonesNode({
      nodeId: 'hasGenerator',
      nodeLabel: 'Add generator',
      command: {
        title: 'Click here to add generator',
        command: 'skmtc-vscode.addGenerator'
      },
      icon: withGenerator ? successIcon : todoIcon
    }),
    new MilestonesNode({
      nodeId: 'hasSchema',
      nodeLabel: 'Add OpenAPI schema',
      command: {
        title: 'Click here to deploy generator stack',
        command: 'skmtc-vscode.addOpenApiSchema'
      },
      description:
        withGenerator && !withSchema
          ? 'Place schema.json or schema.yaml OpenAPI file in `./.codesquared`'
          : undefined,
      icon: withSchema ? successIcon : todoIcon
    }),
    new MilestonesNode({
      nodeId: 'hasDeployment',
      nodeLabel: 'Deploy generator stack',
      command: {
        title: 'Click here to deploy generator stack',
        command: 'skmtc-vscode.deployStack'
      },
      icon: withDeployment ? successIcon : todoIcon
    }),
    new MilestonesNode({
      nodeId: 'hasSettings',
      nodeLabel: 'Create settings',
      command: {
        title: 'Click here to deploy generator stack',
        command: 'skmtc-vscode.createSettings',
        arguments: [{ selectAll: true }]
      },
      icon: withSettings ? successIcon : todoIcon
    }),
    new MilestonesNode({
      nodeId: 'hasRun',
      nodeLabel: 'Generate code',
      command: {
        title: 'Click here to deploy generator stack',
        command: 'skmtc-vscode.createArtifacts'
      },
      icon: withArtifacts ? successIcon : todoIcon
    })
  ]
}

const hasProject = () => {
  const parentFolder = existsSync(join(toRootPath(), '.codesquared'))
  const stackConfig = readStackConfig()
  const hasDenoJson = existsSync(join(toRootPath(), '.codesquared', 'deno.json'))

  return Boolean(parentFolder && stackConfig?.name && hasDenoJson)
}

const hasGenerator = () => {
  const stackConfig = readStackConfig()

  return Boolean(stackConfig?.generators?.length)
}

const hasDeployment = () => {
  const clientConfig = readClientConfig()

  return Boolean(clientConfig?.accountName && clientConfig?.deploymentId)
}

const hasSettings = () => {
  const clientConfig = readClientConfig()

  return Boolean(clientConfig?.settings?.generators?.length)
}
