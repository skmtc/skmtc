import { commands, TreeView } from 'vscode';
import { resultsTreeItemClicked } from './resultsTreeItemClicked';
import { ResultsNode } from '../results/toResultsNodes';
import { ExtensionStore } from '../types/ExtensionStore';

type RegisterResultsTreeItemClickedArgs = {
  resultsTreeView: TreeView<ResultsNode>;
  store: ExtensionStore;
};

export const registerResultsTreeItemClicked = ({
  resultsTreeView,
  store,
}: RegisterResultsTreeItemClickedArgs) => {
  return commands.registerCommand(
    'results.treeItemClicked',
    resultsTreeItemClicked({
      resultsTreeView,
      store,
    })
  );
};
