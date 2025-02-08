import { OperationsGeneratorSettings } from '@skmtc/core/Settings'
import { Method } from '@skmtc/core/Method'
import { SettingsNode } from './SettingsNode'
import { toOperationItemId } from './toItemId'
import { TreeItemCollapsibleState } from 'vscode'

export const toOperations = (generatorSettings: OperationsGeneratorSettings): SettingsNode[] => {
  if (!('operations' in generatorSettings)) {
    return []
  }

  return Object.entries(generatorSettings.operations).flatMap(([path, methodSettings]) => {
    return Object.entries(methodSettings).map(([method, selected]) => {
      return new SettingsNode({
        nodeId: toOperationItemId({
          generatorId: generatorSettings.id,
          path,
          method: method as Method
        }),
        nodeLabel: `${method.toUpperCase()} ${path}`,
        collapsibleState: TreeItemCollapsibleState.None,
        meta: {
          type: 'operation',
          path: path,
          method: method as Method,
          generatorId: generatorSettings.id
        },
        selectCount: 0,
        editCount: 0
      })
    })
  })
}
