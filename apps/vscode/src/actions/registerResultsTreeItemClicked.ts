import { commands, TreeView, ExtensionContext } from 'vscode'
import { resultsTreeItemClicked } from './resultsTreeItemClicked'
import { ResultsNode } from '../results/toResultsNodes'
import { ExtensionStore } from '../types/ExtensionStore'

type RegisterResultsTreeItemClickedArgs = {
  resultsTreeView: TreeView<ResultsNode>
  store: ExtensionStore
  context: ExtensionContext
}

export const registerResultsTreeItemClicked = ({
  resultsTreeView,
  store,
  context
}: RegisterResultsTreeItemClickedArgs) => {
  return commands.registerCommand(
    'results.treeItemClicked',
    resultsTreeItemClicked({
      resultsTreeView,
      store,
      context
    })
  )
}
