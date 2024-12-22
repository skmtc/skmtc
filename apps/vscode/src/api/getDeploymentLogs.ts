import { z } from 'zod';
import { getSession } from '../auth/getSession';
import { ExtensionStore } from '../types/ExtensionStore';
import { SKMTC_API } from './constants';
import ndjsonStream from 'can-ndjson-stream';
import { writeLogs } from '../utilities/writeLogs';

type GetDeploymentLogsArgs = {
  store: ExtensionStore;
  deploymentId: string;
};

export const getDeploymentLogs = async ({ store, deploymentId }: GetDeploymentLogsArgs) => {
  const session = await getSession({ createIfNone: true });

  const controller = new AbortController();

  if (!session) {
    return {
      dispose: () => {},
    };
  }

  const response = await fetch(`${SKMTC_API}/deployments/${deploymentId}/deployment-logs`, {
    method: 'GET',
    signal: controller.signal,
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Accept': 'application/x-ndjson',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Authorization': `Bearer ${session.accessToken}`,
    },
  });

  const reader = ndjsonStream(response.body).getReader();

  store.remoteDeploymentLogs.clear();

  store.remoteDeploymentLogs.show();

  pump();

  function pump() {
    return (
      reader
        ?.read()
        // @ts-expect-error
        .then(({ done, value }) => {
          // When no more data needs to be consumed, close the stream

          if (done) {
            return;
          }

          writeLogs(store.remoteDeploymentLogs, value);

          pump();
        })
        .catch((e: unknown) => {
          console.error(e);
        })
    );
  }

  return {
    dispose: () => {
      reader.cancel();
      controller.abort();
    },
  };
};
