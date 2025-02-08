import { TreeItemCollapsibleState } from 'vscode'
import { ModelsGeneratorSettings } from '@skmtc/core/Settings'
import { toModelItemId } from './toItemId'
import { SettingsNode } from './SettingsNode'

export const toModels = (generatorSettings: ModelsGeneratorSettings): SettingsNode[] => {
  const models = Object.fromEntries(
    Object.entries(generatorSettings?.models ?? {}).map(([refName, selected]) => {
      return [
        refName,
        new SettingsNode({
          nodeId: toModelItemId({ generatorId: generatorSettings.id, refName }),
          nodeLabel: refName,
          collapsibleState: TreeItemCollapsibleState.None,
          meta: {
            type: 'model',
            refName: refName,
            generatorId: generatorSettings.id
          },
          selected: Boolean(selected),
          selectCount: 0,
          editCount: 0
        })
      ]
    })
  )

  return Object.values(models)
}
