import { match } from 'ts-pattern';
import { Method } from '@skmtc/core/Method';
import { SettingsNode } from './SettingsNode';

export type ToOperationPathItemIdArgs = {
  generatorId: string;
  path: string;
};

export const toOperationPathItemId = ({ generatorId, path }: ToOperationPathItemIdArgs) => {
  return `${generatorId}-operations-${path}`;
};

export type ToOperationItemIdArgs = {
  generatorId: string;
  path: string;
  method: Method;
};

export const toOperationItemId = ({ generatorId, path, method }: ToOperationItemIdArgs) => {
  return `${generatorId}-operations-${path}-${method}`;
};

export type ToModelItemIdArgs = {
  generatorId: string;
  refName: string;
};

export const toModelItemId = ({ generatorId, refName }: ToModelItemIdArgs) => {
  return `${generatorId}-models-${refName}`;
};

export type LookupTreeItemArgs = {
  generatorId: string;
} & (
  | {
      type: 'path';
      path: string;
    }
  | {
      type: 'operation';
      path: string;
      method: Method;
    }
  | {
      type: 'model';
      refName: string;
    }
);

export const lookupTreeItem = (
  settingsTree: SettingsNode[],
  { generatorId, ...rest }: LookupTreeItemArgs
): SettingsNode | undefined => {
  return match(rest)
    .with({ type: 'model' }, ({ refName }) => {
      const modelItemId = toModelItemId({ generatorId, refName });
      return getItemById(settingsTree, modelItemId);
    })
    .with({ type: 'path' }, ({ path }) => {
      const pathItemId = toOperationPathItemId({ generatorId, path });

      return getItemById(settingsTree, pathItemId);
    })
    .with({ type: 'operation' }, ({ path, method }) => {
      const pathItemId = toOperationPathItemId({ generatorId, path });

      const pathItem = getItemById(settingsTree, pathItemId);

      const operationItemId = toOperationItemId({ generatorId, path, method });

      return getItemById(pathItem?.children, operationItemId);
    })
    .exhaustive();
};

const getItemById = (settingsTree: SettingsNode[] | undefined, id: string) => {
  return settingsTree?.find((node) => node.id === id);
};
