import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import {  toMilestonesNodes } from '../milestones/toMilestonesNodes';
import { MilestonesNode } from '../milestones/MileStonesNode';

// A custom type to keep the code below more tidy
type TreeDataOnChangeEvent = MilestonesNode | undefined | null | void;

/**
 * An implementation of the TreeDataProvider interface.
 *
 * This class is responsible for managing the tree data that the VS Code
 * TreeView API needs to render a custom tree view.
 *
 * Learn more about Tree Data Providers here:
 * https://code.visualstudio.com/api/extension-guides/tree-view#tree-data-provider
 */

export class MilestonesDataProvider implements TreeDataProvider<MilestonesNode> {
  private _onDidChangeTreeData = new EventEmitter<TreeDataOnChangeEvent>();
  readonly onDidChangeTreeData: Event<TreeDataOnChangeEvent> = this._onDidChangeTreeData.event;

  data: MilestonesNode[];
  itemsById: Record<string, MilestonesNode> = {};

  constructor() {
    this.data = toMilestonesNodes();
  }

  refresh(): void {
    this.data = toMilestonesNodes();

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MilestonesNode): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element: MilestonesNode): ProviderResult<MilestonesNode[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }

  getParent() {
    return null;
  }

  lookupTreeItemBy(args: { id: string }): MilestonesNode | undefined {
    return this.data.find((node) => node.id === args.id);
  }
}
