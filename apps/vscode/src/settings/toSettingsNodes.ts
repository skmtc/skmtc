import { TreeItemCheckboxState, TreeItemCollapsibleState } from 'vscode';
import { ClientGeneratorSettings, SkmtcClientConfig } from '@skmtc/core/Settings';
import { toOperations } from './toOperations';
import { toModels } from './toModels';
import { SettingsNode } from './SettingsNode';
import { Extensions } from '@skmtc/core/Extensions';
import { SettingMetaSchema } from '../types/SettingMeta';
import { extensionsObject } from './extensionsObject';

type ToSettingsNodesArgs = {
  clientConfig: SkmtcClientConfig;
  extensions: Extensions | undefined;
};

export const toSettingsNodes = ({
  clientConfig,
  extensions,
}: ToSettingsNodesArgs): SettingsNode[] => {
  const generateNodes = toGenerateNodes(clientConfig);

  return generateNodes;

  // const schemaNode = new SettingsNode({
  //   nodeId: 'schema',
  //   nodeLabel: 'Enrich schema',
  //   collapsibleState: TreeItemCollapsibleState.Collapsed,
  //   children: extensions ? toSchemaNodes({ extensions, stackTrail: ['schema'] }) : undefined,
  //   selectCount: 0,
  //   editCount: 0,
  // });

  // const generatorsNode = new SettingsNode({
  //   nodeId: 'generators',
  //   nodeLabel: 'Generators',
  //   collapsibleState: TreeItemCollapsibleState.Collapsed,
  //   children: generateNodes,
  //   meta: {
  //     type: 'generators',
  //   },
  //   selectCount: generateNodes.reduce((acc, node) => {
  //     return node.checkboxState === TreeItemCheckboxState.Checked ? acc + 1 : acc;
  //   }, 0),
  //   editCount: generateNodes.reduce((acc, node) => node.editCount + acc, 0),
  // });

  // return [schemaNode, generatorsNode];
};

type ToSchemaNodesArgs = {
  extensions: Extensions;
  stackTrail: string[];
};

const toSchemaNodes = ({ extensions, stackTrail: st }: ToSchemaNodesArgs): SettingsNode[] => {
  return Object.entries(extensions)
    .filter(([propertyName]) => propertyName !== '__x__')
    .map(([propertyName, extension]) => {
      const stackTrail = st.concat(propertyName);

      const children =
        typeof extension === 'object' && extension !== null
          ? toSchemaNodes({
              extensions: extension as Extensions,
              stackTrail,
            })
          : undefined;

      const extensionsWithX = extensionsObject.safeParse(extension).data;

      const meta: SettingMetaSchema = {
        type: 'schema',
        ...(extensionsWithX ? { schemaNodeType: extensionsWithX.__x__.type } : {}),
        stackTrail,
      };

      const label = extensionsWithX?.__x__?.extensionFields?.['Label'];

      return new SettingsNode({
        nodeId: stackTrail.join(':'),
        nodeLabel: propertyName,
        collapsibleState: children?.length
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None,
        children: children?.length ? children : undefined,
        description: typeof label === 'string' ? label : undefined,
        command: {
          command: 'vscode-skmtc.treeItemClicked',
          title: 'Schema settings',
        },
        meta,
        selectCount: 0,
        editCount: 0,
      });
    });
};

export const toGenerateNodes = (clientConfig: SkmtcClientConfig): SettingsNode[] => {
  return clientConfig.settings.generators.map((generatorSettings) => {
    const children = toGeneratorNodes(generatorSettings);

    return new SettingsNode({
      nodeId: generatorSettings.id,
      nodeLabel: `${generatorSettings.id}`,
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      children,
      meta: {
        type: 'generator',
        generatorId: generatorSettings.id,
      },
      command: {
        command: 'vscode-skmtc.treeItemClicked',
        title: 'Generator settings',
      },
      selectCount: children.reduce((acc, node) => {
        return node.checkboxState === TreeItemCheckboxState.Checked ? acc + 1 : acc;
      }, 0),
      editCount: children.reduce((acc, node) => node.editCount + acc, 0),
    });
  });
};

export const toGeneratorNodes = (generatorSettings: ClientGeneratorSettings): SettingsNode[] => {
  if ('operations' in generatorSettings) {
    return toOperations(generatorSettings);
  }

  if ('models' in generatorSettings) {
    return toModels(generatorSettings);
  }

  throw new Error('Invalid plugin settings');
};
