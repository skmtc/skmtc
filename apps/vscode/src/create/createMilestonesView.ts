import { ExtensionStore } from '../types/ExtensionStore';
import { window } from 'vscode';

type CreateMilestonesViewArgs = {
  store: ExtensionStore;
};

export const createMilestonesView = ({ store }: CreateMilestonesViewArgs) => {
  // Create a tree view to contain milestones items
  const milestonesTreeView = window.createTreeView('skmtc-vscode.milestonesTree', {
    treeDataProvider: store.milestonesDataProvider,
    showCollapseAll: false,
  });

  // milestonesTreeView.description = 'ADD MORE INFO HERE';

  return milestonesTreeView;
};
