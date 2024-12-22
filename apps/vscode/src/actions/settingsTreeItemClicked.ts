import { match, P } from 'ts-pattern';
import { ExtensionContext } from 'vscode';
import { SettingsNode } from '../settings/SettingsNode';
import { window, ViewColumn, Uri } from 'vscode';
import { updateSettingMessage } from '../types/messages';
import { ExtensionStore } from '../types/ExtensionStore';
import { readClientConfig } from '../utilities/readClientConfig';
import { updateSettingValue } from '../settings/updateSettingValue';
import { BaseSettingsInputs } from '../ui/settings/BaseSettingsInputs';
import { getCombinedSettingsHtml } from '../ui/getCombinedSettingsHtml';
import { SettingMeta } from '../types/SettingMeta';
import { StringInput } from '../ui/settings/StringInput';
import { Stringable } from '@skmtc/core';
import { readExtensions } from '../utilities/readExtensions';
import { Extensions } from '@skmtc/core/Extensions';
import { extensionsObject } from '../settings/extensionsObject';
import { SchemaSettingsInputs } from '../ui/settings/SchemaSettingsInputs';
import { List } from '../ui/settings/List';

type SettingsTreeItemClickedArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
};

export const settingsTreeItemClicked =
  ({ store, context }: SettingsTreeItemClickedArgs) =>
  (settingsNode: SettingsNode) => {
    const { meta } = settingsNode;

    const clientConfig = readClientConfig({ notifyIfMissing: true });

    if (!clientConfig) {
      return;
    }

    const extensions = readExtensions() ?? {};

    const metaStackTrail = settingMetaToStackTrail(meta);

    match(metaStackTrail)
      .with(['schema', ...P.array()], (matched) => {
        const inputs = toSchemaSettingsInputs({
          extensions,
          metaStackTrail: metaStackTrail.join(':'),
        });

        toSchemaSettingsPanel({ store, context, inputs });
      })
      .otherwise(() => {
        throw new Error('No match');
      });
  };

type ToSchemaSettingsInputsArgs = {
  extensions: Extensions;
  metaStackTrail: string;
};

export const toSchemaSettingsInputs = ({
  extensions,
  metaStackTrail,
}: ToSchemaSettingsInputsArgs) => {
  const inputs: Stringable[] = [];

  const stackTrail = ['schema'];

  loopThroughExtensions({ extensions, stackTrail, metaStackTrail, inputs });

  return inputs;
};

type MatchStackTrailArgs = {
  itemStackTrail: string[];
  metaStackTrail: string;
};

const matchStackTrail = ({ itemStackTrail, metaStackTrail }: MatchStackTrailArgs) => {
  const metaChunks = metaStackTrail.split(':');

  const topMatch = metaChunks.every((chunk, index) => itemStackTrail[index] === chunk);

  const bottomMatch = itemStackTrail.every((chunk, index) => metaChunks[index] === chunk);

  return topMatch || bottomMatch;
};

type LoopThroughExtensionsArgs = {
  extensions: Extensions;
  stackTrail: string[];
  metaStackTrail: string;
  inputs: Stringable[];
};

const loopThroughExtensions = ({
  extensions,
  stackTrail: st,
  inputs,
  metaStackTrail,
}: LoopThroughExtensionsArgs) => {
  Object.entries(extensions).forEach(([extensionId, extension]) => {
    const stackTrail = st.concat(extensionId);

    if (!matchStackTrail({ itemStackTrail: stackTrail, metaStackTrail })) {
      return;
    }

    const extensionsWithX = extensionsObject.safeParse(extension).data;

    if (extensionsWithX) {
      const items = Object.entries(extensionsWithX.__x__.extensionFields).map(
        ([fieldId, field]) => {
          return new StringInput({
            label: fieldId,
            name: stackTrail.concat(fieldId).join(':'),
            value: String(field),
          });
        }
      );

      if (items.length > 0) {
        inputs.push(
          new SchemaSettingsInputs({
            generatorId: extensionId,
            stackTrail,
            list: new List(items),
          })
        );
      }
    }

    if (typeof extension === 'object') {
      loopThroughExtensions({
        extensions: extension,
        stackTrail,
        inputs,
        metaStackTrail,
      });
    }
  });
};


type ToCombinedSettingsPanelArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
  inputs: BaseSettingsInputs[];
};

const toCombinedSettingsPanel = ({ store, context, inputs }: ToCombinedSettingsPanelArgs) => {
  const settingTitle = 'CodeSquared settings';

  // If no panel is open, create a new one and update the HTML
  if (!store.settingPanel) {
    store.settingPanel = window.createWebviewPanel(
      'settingDetailView',
      settingTitle,
      ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [Uri.joinPath(context.extensionUri, 'out')],
      }
    );
  }

  // If a panel is open, update the HTML with the selected item's content
  store.settingPanel.title = settingTitle; // matchedSetting.title;

  store.settingPanel.webview.html = getCombinedSettingsHtml({
    webview: store.settingPanel.webview,
    extensionUri: context.extensionUri,
    inputs: inputs,
  });

  store.settingPanel.reveal(store.settingPanel.viewColumn, true);

  // If a panel is open and receives an update message, update the notes array and the panel title/html
  store.settingPanel.webview.onDidReceiveMessage((message) => {
    match(message)
      .with({ command: 'updateSetting' }, (matched) => {
        const { payload } = updateSettingMessage.parse(matched);

        const { value, stackTrail, fromForm } = payload;

        updateSettingValue({ store, context, value, stackTrail, fromForm });
      })
      .otherwise(() => {});
  });

  store.settingPanel.onDidDispose(
    () => {
      // When the panel is closed, cancel any future updates to the webview content
      store.settingPanel = undefined;
    },
    null,
    context.subscriptions
  );
};

type ToSchemaSettingsPanelArgs = {
  store: ExtensionStore;
  context: ExtensionContext;
  inputs: Stringable[];
};

const toSchemaSettingsPanel = ({ store, context, inputs }: ToSchemaSettingsPanelArgs) => {
  const settingTitle = 'CodeSquared settings';

  // If no panel is open, create a new one and update the HTML
  if (!store.settingPanel) {
    store.settingPanel = window.createWebviewPanel(
      'settingDetailView',
      settingTitle,
      ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [Uri.joinPath(context.extensionUri, 'out')],
      }
    );
  }

  // If a panel is open, update the HTML with the selected item's content
  store.settingPanel.title = settingTitle; // matchedSetting.title;

  store.settingPanel.webview.html = getCombinedSettingsHtml({
    webview: store.settingPanel.webview,
    extensionUri: context.extensionUri,
    inputs: inputs,
  });

  store.settingPanel.reveal(store.settingPanel.viewColumn, true);

  // If a panel is open and receives an update message, update the notes array and the panel title/html
  store.settingPanel.webview.onDidReceiveMessage((message) => {
    match(message)
      .with({ command: 'updateSetting' }, (matched) => {
        const { payload } = updateSettingMessage.parse(matched);

        const { value, stackTrail, fromForm } = payload;

        updateSettingValue({ store, context, value, stackTrail, fromForm });
      })
      .otherwise(() => {});
  });

  store.settingPanel.onDidDispose(
    () => {
      // When the panel is closed, cancel any future updates to the webview content
      store.settingPanel = undefined;
    },
    null,
    context.subscriptions
  );
};

const settingMetaToStackTrail = (meta: SettingMeta | undefined) => {
  if (!meta) {
    return [];
  }

  return match(meta)
    .with({ type: 'generators' }, () => ['generators'])
    .with({ type: 'generator' }, (matched) => ['generators', matched.generatorId])
    .with({ type: 'model' }, (matched) => ['generators', matched.generatorId, matched.refName])
    .with({ type: 'operation' }, (matched) => [
      'generators',
      matched.generatorId,
      matched.path,
      matched.method,
    ])
    .with({ type: 'schema' }, (matched) => [...matched.stackTrail])
    .exhaustive();
};
