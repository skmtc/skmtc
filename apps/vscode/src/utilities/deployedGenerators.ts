import { QuickPickItem } from 'vscode';
import { readStackConfig } from './readStackConfig';

const deployedGenerators: QuickPickItem[] = [
  {
    label: '@skmtc/typescript',
    description: 'TypeScript model generator',
  },
  {
    label: '@skmtc/zod',
    description: 'Zod model generator',
  },
  {
    label: '@skmtc/tanstack-query-zod',
    description: 'Tanstack query generator',
  },
  {
    label: '@skmtc/shadcn-react-hook-form',
    description: 'React hook form generator',
  },
];

export const getDeployedGenerators = () => {
  const { generators } = readStackConfig({ applyDefault: true });

  const names = generators.map((generator) => {
    const [_scope, name] = generator.split('/');

    return name;
  });

  return deployedGenerators.filter(({ label }) => {
    const [_scope, name] = label.split('/');

    return !names.includes(name);
  });
};
