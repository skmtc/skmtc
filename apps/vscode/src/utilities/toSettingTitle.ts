import { match } from 'ts-pattern';
import { SettingMeta } from '../types/SettingMeta';

export const toSettingTitle = (meta: SettingMeta) => {
  return match(meta)
    .with(
      { type: 'operation' },
      ({ path, method, generatorId }) => `${method.toUpperCase()} ${path}: ${generatorId}`
    )
    .with({ type: 'model' }, ({ refName, generatorId }) => `${refName}: ${generatorId}`)
    .with({ type: 'generator' }, ({ generatorId }) => generatorId)
    .with({ type: 'generators' }, () => 'Generators')
    .with({ type: 'schema' }, ({ stackTrail }) => stackTrail[stackTrail.length - 1])
    .exhaustive();
};
