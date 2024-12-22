import invariant from 'tiny-invariant';
import { workspace, window } from 'vscode';

export const toRootPath = () => {
  const currentFile = window.activeTextEditor?.document.uri;

  const currentWorkspace = currentFile
    ? workspace.getWorkspaceFolder(currentFile)
    : workspace.workspaceFolders?.[0];

  const rootPath = currentWorkspace?.uri?.fsPath;

  // console.log('rootPath', rootPath);

  invariant(rootPath, 'No workspace root path found');

  return rootPath;
};
