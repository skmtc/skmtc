import { Webview, Uri } from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { BaseSettingsInputs } from './settings/BaseSettingsInputs';
import { Form } from './settings/Form';
import { List } from './settings/List';

type GetSchemaSettingsHtmlArgs = {
  webview: Webview;
  extensionUri: Uri;
  inputs: BaseSettingsInputs[];
};

export function getSchemaSettingsHtml({
  webview,
  extensionUri,
  inputs,
}: GetSchemaSettingsHtmlArgs) {
  const form = new Form({
    inputs: new List(inputs),
    cspSource: webview.cspSource,
    nonce: getNonce(),
    webviewUri: getUri(webview, extensionUri, ['out', 'webview.js']),
    styleUri: getUri(webview, extensionUri, ['out', 'style.css']),
  });

  return form.toString();
}
