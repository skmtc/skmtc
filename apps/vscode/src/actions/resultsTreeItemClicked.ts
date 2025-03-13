import { TreeView, ExtensionContext } from 'vscode'
import type { ResultsNode } from '../results/toResultsNodes'
import { ExtensionStore } from '../types/ExtensionStore'
import { getRemoteRuntimeLogs, getLocalRuntimeLogs } from '../api/getRuntimeLogs'
import { match } from 'ts-pattern'

type ResultsTreeItemClickedArgs = {
  resultsTreeView: TreeView<ResultsNode>
  store: ExtensionStore
  context: ExtensionContext
}

export const resultsTreeItemClicked =
  ({ resultsTreeView, store, context }: ResultsTreeItemClickedArgs) =>
  async () => {
    const selectedTreeViewItem = resultsTreeView.selection[0]

    if (!selectedTreeViewItem.meta?.deploymentId) {
      return
    }

    const { deploymentId, startAt, endAt, location } = selectedTreeViewItem.meta

    await match(location)
      .with('local', () => {
        return getLocalRuntimeLogs({ stackTrail: selectedTreeViewItem.id, store })
      })
      .with('remote', () => {
        return getRemoteRuntimeLogs({
          stackTrail: selectedTreeViewItem.id,
          deploymentId,
          startAt,
          endAt,
          store,
          context
        })
      })
      .exhaustive()
  }
