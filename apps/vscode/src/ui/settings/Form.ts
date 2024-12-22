import { List } from './List';
import { Uri } from 'vscode';

type FormArgs = {
  inputs: List;
  cspSource: string;
  nonce: string;
  webviewUri: Uri;
  styleUri: Uri;
};

export class Form {
  inputs: List;
  cspSource: string;
  nonce: string;
  webviewUri: Uri;
  styleUri: Uri;

  constructor({ inputs, cspSource, nonce, webviewUri, styleUri }: FormArgs) {
    this.inputs = inputs;
    this.cspSource = cspSource;
    this.nonce = nonce;
    this.webviewUri = webviewUri;
    this.styleUri = styleUri;
  }

  toString() {
    return `    <!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${this.nonce}'; script-src 'nonce-${this.nonce}';">
          <link rel="stylesheet" href="${this.styleUri}">
          <title>CodeSquared settings</title>
      </head>
      <body id="webview-body">

        <vscode-label>Settings</vscode-label>
        <form class="base-settings-form">
          ${this.inputs}
        </form>
        <script type="module" nonce="${this.nonce}" src="${this.webviewUri}"></script>
      </body>
    </html>
`;
  }
}
