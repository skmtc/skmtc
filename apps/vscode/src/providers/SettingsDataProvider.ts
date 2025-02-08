import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode'
import { SettingsNode } from '../settings/SettingsNode'
import { SkmtcClientConfig } from '@skmtc/core/Settings'
import { lookupTreeItem, LookupTreeItemArgs } from '../settings/toItemId'
import { toSettingsNodes } from '../settings/toSettingsNodes'

type TreeDataOnChangeEvent = SettingsNode | undefined | null | void

type SettingsDataProviderArgs = {
  clientConfig: SkmtcClientConfig | undefined
}

export class SettingsDataProvider implements TreeDataProvider<SettingsNode> {
  private _onDidChangeTreeData = new EventEmitter<TreeDataOnChangeEvent>()
  readonly onDidChangeTreeData: Event<TreeDataOnChangeEvent> = this._onDidChangeTreeData.event

  data: SettingsNode[]
  itemsById: Record<string, SettingsNode> = {}

  constructor({ clientConfig }: SettingsDataProviderArgs) {
    this.data = clientConfig ? toSettingsNodes({ clientConfig }) : []
  }

  refresh({ clientConfig }: SettingsDataProviderArgs): void {
    this.data = clientConfig ? toSettingsNodes({ clientConfig }) : []
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: SettingsNode): TreeItem | Thenable<TreeItem> {
    return element
  }

  getChildren(element?: SettingsNode | undefined): ProviderResult<SettingsNode[]> {
    if (element === undefined) {
      return this.data
    }
    return element.children
  }

  getParent() {
    return null
  }

  lookupTreeItemBy(args: LookupTreeItemArgs): SettingsNode | undefined {
    return lookupTreeItem(this.data, args)
  }
}
