import * as fs from 'fs';
import * as path from 'path';
import { toRootPath } from '../utilities/getRootPath';
import { window } from 'vscode';

type ReadSchemaFileArgs = {
  notifyIfMissing?: boolean;
};

export const readSchemaFile = ({ notifyIfMissing }: ReadSchemaFileArgs = {}):
  | string
  | undefined => {
  const rootPath = toRootPath();

  const schemaJsonFilePath = path.resolve(rootPath, '.codesquared', 'schema.json');

  if (fs.existsSync(schemaJsonFilePath)) {
    return fs.readFileSync(schemaJsonFilePath, 'utf-8');
  }

  const schemaYamlFilePath = path.resolve(rootPath, '.codesquared', 'schema.yaml');

  if (fs.existsSync(schemaYamlFilePath)) {
    return fs.readFileSync(schemaYamlFilePath, 'utf-8');
  }

  if (notifyIfMissing) {
    window.showErrorMessage(
      `Schema file not found at '${schemaJsonFilePath}' or at '${schemaJsonFilePath}'`
    );

    return;
  }
};
