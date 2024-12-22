import { commands, window } from 'vscode';

export const registerAddOpenApiSchema = () => {
  return commands.registerCommand('skmtc-vscode.addOpenApiSchema', async () => {
    window.showInformationMessage(
      'Add schema.json or schema.yaml OpenAPI file to .codesquared folder'
    );
  });
};
