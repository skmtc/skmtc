import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { ResultsNode, toResultsNodes } from '../results/toResultsNodes';
import { lookupTreeItem, LookupTreeItemArgs } from '../results/toItemId';
import { ManifestContent } from '@skmtc/core/Manifest';

// A custom type to keep the code below more tidy
type TreeDataOnChangeEvent = ResultsNode | undefined | null | void;

/**
 * An implementation of the TreeDataProvider interface.
 *
 * This class is responsible for managing the tree data that the VS Code
 * TreeView API needs to render a custom tree view.
 *
 * Learn more about Tree Data Providers here:
 * https://code.visualstudio.com/api/extension-guides/tree-view#tree-data-provider
 */
type ConstructorArgs = {
  manifest: ManifestContent | undefined;
};

type RefreshArgs = {
  manifest: ManifestContent | undefined;
};

export class ResultsDataProvider implements TreeDataProvider<ResultsNode> {
  private _onDidChangeTreeData = new EventEmitter<TreeDataOnChangeEvent>();
  readonly onDidChangeTreeData: Event<TreeDataOnChangeEvent> = this._onDidChangeTreeData.event;

  data: ResultsNode[];
  itemsById: Record<string, ResultsNode> = {};

  constructor({ manifest }: ConstructorArgs) {
    this.data = manifest ? toResultsNodes(manifest) : [];
  }

  refresh({ manifest }: RefreshArgs): void {
    this.data = manifest ? toResultsNodes(manifest) : [];

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResultsNode): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element?: ResultsNode | undefined): ProviderResult<ResultsNode[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }

  getParent() {
    return null;
  }

  lookupTreeItemBy(args: LookupTreeItemArgs): ResultsNode | undefined {
    return lookupTreeItem(this.data, args);
  }
}
