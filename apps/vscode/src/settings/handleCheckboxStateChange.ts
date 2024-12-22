import { ExtensionContext, TreeCheckboxChangeEvent } from 'vscode';
import { SettingsNode } from './SettingsNode';
import { ExtensionStore } from '../types/ExtensionStore';
import { updateSettingValue } from './updateSettingValue';
import { SettingMetaGenerator, SettingMetaModel, SettingMetaOperation } from '../types/SettingMeta';
import { match } from 'ts-pattern';

type HandleCheckboxStateChangeArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
};

export const handleCheckboxStateChange =
  ({ store, context }: HandleCheckboxStateChangeArgs) =>
  (event: TreeCheckboxChangeEvent<SettingsNode>) => {
    event.items.forEach(([node, selected]) => {
      if (node.meta && node.meta.type !== 'generators' && node.meta.type !== 'schema') {
        updateSettingValue({
          store,
          context,
          stackTrail: metaToStackTrail(node.meta).join(':'),
          value: Boolean(selected),
          fromForm: false,
        });
      }
    });
  };

const metaToStackTrail = (meta: SettingMetaOperation | SettingMetaModel | SettingMetaGenerator) => {
  return match(meta)
    .with({ type: 'generator' }, ({ generatorId }) => ['generators', generatorId])
    .with({ type: 'model' }, ({ generatorId, refName }) => ['generators', generatorId, refName])
    .with({ type: 'operation' }, ({ generatorId, path, method }) => [
      'generators',
      generatorId,
      path,
      method,
    ])
    .exhaustive();
};
