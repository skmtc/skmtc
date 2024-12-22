import { ExtensionStore } from '../types/ExtensionStore';
import { window } from 'vscode';

type CreateResultsViewArgs = {
  store: ExtensionStore;
};

export const createResultsView = ({ store }: CreateResultsViewArgs) => {
  // Create a tree view to contain results items
  const resultsTreeView = window.createTreeView('skmtc-vscode.resultsTree', {
    treeDataProvider: store.resultsDataProvider,
    showCollapseAll: false,
    manageCheckboxStateManually: true,
  });

  // resultsTreeView.description = 'ADD MORE INFO HERE';

  return resultsTreeView;
};
