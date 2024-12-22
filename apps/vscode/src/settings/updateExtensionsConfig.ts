import { Uri, WebviewPanel } from 'vscode';
import { getCombinedSettingsHtml } from '../ui/getCombinedSettingsHtml';
import { toSchemaSettingsInputs } from '../actions/settingsTreeItemClicked';
import { Extensions } from '@skmtc/core/Extensions';
import { writeExtensions } from '../utilities/writeExtensions';

type UpdateExtensionsConfigArgs = {
  extensions: Extensions;
  settingPanel: WebviewPanel | undefined;
  extensionUri: Uri;
  fromForm: boolean;
};

export const updateExtensionsConfig = ({
  settingPanel,
  extensions,
  extensionUri,
  fromForm,
}: UpdateExtensionsConfigArgs) => {
  // TODO: Look up metaStackTrail and apply here
  if (settingPanel && !fromForm) {
    settingPanel.webview.html = getCombinedSettingsHtml({
      webview: settingPanel.webview,
      extensionUri: extensionUri,
      inputs: toSchemaSettingsInputs({ extensions, metaStackTrail: '' }),
    });
  }

  writeExtensions(extensions);
};
