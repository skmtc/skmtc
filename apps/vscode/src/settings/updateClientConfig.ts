import { Uri, WebviewPanel } from 'vscode';
import { writeClientConfig } from '../utilities/writeClientConfig';
import type { SkmtcClientConfig } from '@skmtc/core/Settings';


type UpdateClientConfigArgs = {
  clientConfig: SkmtcClientConfig;
  settingPanel: WebviewPanel | undefined;
  extensionUri: Uri;
  fromForm: boolean;
};

export const updateClientConfig = ({
  settingPanel,
  clientConfig,
  extensionUri,
  fromForm,
}: UpdateClientConfigArgs) => {


  writeClientConfig(clientConfig);
};
