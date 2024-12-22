import { getSession } from '../auth/getSession';
import { window } from 'vscode';
import { ClientSettings } from '@skmtc/core/Settings';
import { createArtifactsResponse } from '../types/generationResponse';
import { ExtensionStore } from '../types/ExtensionStore';

type GenerateArgs = {
  store: ExtensionStore;
  stackUrl: string;
  schema: string;
  prettier: string | undefined;
  clientSettings: ClientSettings | undefined;
};

export const createArtifacts = async ({
  store,
  stackUrl,
  schema,
  prettier,
  clientSettings,
}: GenerateArgs) => {
  try {
    const session = await getSession({ createIfNone: true });

    if (!session) {
      return;
    }

    const res = await fetch(stackUrl, {
      method: 'POST',
      body: JSON.stringify({
        schema,
        clientSettings,
        prettier,
      }),
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Authorization': `Bearer ${session.accessToken}`,
      },
    });

    const json = await res.json();

    return createArtifactsResponse.parse(json);
  } catch (error) {
    store.sentryClient.captureException(error);

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    window.showErrorMessage(`Failed to run stack: ${errorMessage}`);

    return null;
  }
};
