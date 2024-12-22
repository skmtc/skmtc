import { Command, ThemeColor, ThemeIcon, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ResultMeta } from '../types/ResultMeta';
import { ManifestContent } from '@skmtc/core/Manifest';
import { ResultsItem, ResultType } from '@skmtc/core/Results';
import { match } from 'ts-pattern';

type ResultsNodeArgs = {
  nodeId: string;
  nodeLabel: string;
  collapsibleState: TreeItemCollapsibleState;
  children?: ResultsNode[];
  command?: Command;
  meta: ResultMeta;
  contextValue?: string;
};

export class ResultsNode extends TreeItem {
  children?: ResultsNode[];
  id: string;
  meta: ResultMeta;
  command?: Command;

  constructor(settingNode: ResultsNodeArgs) {
    const { nodeId, nodeLabel, collapsibleState, command, children, meta, contextValue } =
      settingNode;

    super(nodeLabel, collapsibleState);

    this.id = nodeId;
    this.command = command;
    this.meta = meta;
    this.collapsibleState = collapsibleState;
    this.children = children;
    this.description = toDescription(meta);
    this.iconPath = meta ? toIcon(meta) : undefined;
    this.contextValue = contextValue;
  }
}

const toDescription = (meta: ResultMeta) => {
  return match(meta.result)
    .with('notSelected', () => 'Not selected')
    .with('notSupported', () => 'Not supported')
    .otherwise(() => '');
};

const toIcon = (meta: ResultMeta) => {
  return match(meta.result)
    .with('success', () => new ThemeIcon('pass-filled', new ThemeColor('charts.green')))
    .with('warning', () => new ThemeIcon('circle-filled', new ThemeColor('charts.yellow')))
    .with('error', () => new ThemeIcon('circle-slash', new ThemeColor('charts.red')))
    .otherwise(() => new ThemeIcon('primitive-dot', new ThemeColor('charts.gray')));
};

type DoOneArgs = {
  label: string;
  stackTrailArray: string[];
  deploymentId: string;
  resultsItem: ResultType;
  children?: ResultsNode[];
  startAt: number;
  endAt: number;
};

const doOne = ({
  stackTrailArray,
  resultsItem,
  deploymentId,
  children,
  label,
  startAt,
  endAt,
}: DoOneArgs): ResultsNode => {
  return new ResultsNode({
    nodeId: stackTrailArray.join(':'),
    nodeLabel: label,
    collapsibleState: children ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
    meta: {
      deploymentId,
      result: resultsItem,
      location: isNaN(parseInt(deploymentId)) ? 'remote' : 'local',
      startAt,
      endAt,
    },
    command: {
      title: 'View logs',
      command: 'results.treeItemClicked',
    },
    children,
  });
};

type DoManyArgs = {
  stackTrailArray: string[];
  deploymentId: string;
  startAt: number;
  endAt: number;
  resultsItem: ResultsItem | Array<ResultsItem | null>;
};

const doMany = ({
  stackTrailArray,
  resultsItem,
  deploymentId,
  startAt,
  endAt,
}: DoManyArgs): ResultsNode[] => {
  if (Array.isArray(resultsItem)) {
    return resultsItem.map((result, index) => {
      const stackTrail = stackTrailArray.concat(index.toString());
      return result === null
        ? doOne({
            label: index.toString(),
            stackTrailArray: stackTrail,
            resultsItem: 'success',
            deploymentId,
            startAt,
            endAt,
          })
        : doSome({
            stackTrailArray: stackTrail,
            resultsItem: result,
            deploymentId,
            endAt,
            startAt,
          });
    });
  }

  return Object.entries(resultsItem).map(([stackToken, result]) => {
    return doSome({
      stackTrailArray: stackTrailArray.concat(stackToken),
      resultsItem: result,
      deploymentId,
      startAt,
      endAt,
    });
  });
};

type DoSomeArgs = {
  stackTrailArray: string[];
  deploymentId: string;
  startAt: number;
  endAt: number;
  resultsItem: ResultsItem | ResultType | Array<ResultsItem | null>;
};

const doSome = ({
  stackTrailArray,
  startAt,
  endAt,
  resultsItem,
  deploymentId,
}: DoSomeArgs): ResultsNode => {
  const children =
    typeof resultsItem !== 'string'
      ? doMany({ stackTrailArray, resultsItem, deploymentId, startAt, endAt })
      : undefined;

  return doOne({
    label: stackTrailArray[stackTrailArray.length - 1],
    stackTrailArray,
    resultsItem: typeof resultsItem === 'string' ? resultsItem : combineResults(children),
    deploymentId,
    children,
    startAt,
    endAt,
  });
};

export const toResultsNodes = (manifest: ManifestContent): ResultsNode[] => {
  const { deploymentId, results, spanId, startAt, endAt } = manifest;

  const resultNode = doSome({
    stackTrailArray: [spanId],
    resultsItem: results[spanId],
    startAt,
    endAt,
    deploymentId,
  });

  return resultNode.children || [resultNode];
};

const combineResults = (children: ResultsNode[] = []): ResultType => {
  let result: ResultType = 'success';

  for (const child of children) {
    if (child.meta.result === 'error') {
      return 'error';
    }
    if (child.meta.result === 'warning') {
      result = 'warning';
    }
  }

  return result;
};
