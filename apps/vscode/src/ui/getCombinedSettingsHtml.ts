import { Webview, Uri } from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { Form } from './settings/Form';
import { List } from './settings/List';
import { Stringable } from '@skmtc/core';

type GetCombinedSettingsHtmlArgs = {
  webview: Webview;
  extensionUri: Uri;
  inputs: Stringable[];
};

export function getCombinedSettingsHtml({
  webview,
  extensionUri,
  inputs,
}: GetCombinedSettingsHtmlArgs) {
  const form = new Form({
    inputs: new List(inputs),
    cspSource: webview.cspSource,
    nonce: getNonce(),
    webviewUri: getUri(webview, extensionUri, ['out', 'webview.js']),
    styleUri: getUri(webview, extensionUri, ['out', 'style.css']),
  });

  return form.toString();
}
