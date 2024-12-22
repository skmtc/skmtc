import { z } from 'zod';
import { getSession } from '../auth/getSession';
import { ExtensionStore } from '../types/ExtensionStore';
import { SKMTC_API } from './constants';
import ndjsonStream from 'can-ndjson-stream';
import { writeLogs } from '../utilities/writeLogs';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { window } from 'vscode';
import { existsSync } from 'node:fs';
import { match } from 'ts-pattern';

type GetDeploymentArgs = {
  deploymentId: string;
  store: ExtensionStore;
  stackTrail: string;
  startAt: number;
  endAt: number;
};

const deploymentLogLine = z.object({
  time: z.string(),
  level: z.enum(['error', 'warning', 'info', 'debug']),
  message: z.string(),
  region: z.string(),
});

const localLogLine = z.object({
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']),
  message: z.string(),
});

export const getRemoteRuntimeLogs = async ({
  stackTrail,
  startAt,
  endAt,
  deploymentId,
  store,
}: GetDeploymentArgs) => {
  const session = await getSession({ createIfNone: true });

  const controller = new AbortController();

  if (!session) {
    return {
      dispose: () => {},
    };
  }

  const query = new URLSearchParams({
    q: stackTrail,
    since: new Date(startAt).toISOString(),
    until: new Date(endAt).toISOString(),
  });

  const url = `${SKMTC_API}/deployments/${deploymentId}/runtime-logs?${query}`;

  const response = await fetch(url, {
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

  store.remoteRuntimeLogs.clear();

  store.remoteRuntimeLogs.info(`Fetching logs for '${stackTrail}'`);

  store.remoteRuntimeLogs.show();

  pump();

  function pump() {
    return (
      reader
        ?.read()
        // @ts-expect-error
        .then(({ done, value }) => {
          // When no more data needs to be consumed, close the stream

          if (done) {
            store.remoteRuntimeLogs.info(`Done`);
            console.log('DONE');
            return;
          }

          writeLogs(store.remoteRuntimeLogs, deploymentLogLine.parse(value));

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

type GetLocalDeploymentArgs = {
  store: ExtensionStore;
  stackTrail: string;
};

export const getLocalRuntimeLogs = async ({ stackTrail, store }: GetLocalDeploymentArgs) => {
  const spanId = stackTrail.split(':').shift();

  const logsPath = join(store.blinkLogsPath, `${spanId}.txt`);

  if (!existsSync(logsPath)) {
    window.showErrorMessage(`No logs found at '${logsPath}'`);
    return;
  }

  fs.readFile(logsPath, 'utf8', (err, data) => {
    if (err) {
      store.localRuntimeLogs.error(err);
      return;
    }

    store.remoteRuntimeLogs.clear();

    store.remoteRuntimeLogs.info(`Reading local logs for '${stackTrail}'`);

    store.remoteRuntimeLogs.show();

    data
      .split('\n')
      .filter((line) => line.includes(stackTrail))
      .forEach((line) => {
        try {
          const parsed = JSON.parse(line);

          const checked = localLogLine.parse(parsed);

          const tweaked = match(checked)
            .with({ level: 'ERROR' }, ({ level, ...rest }) => {
              return { level: 'error' as const, ...rest };
            })
            .with({ level: 'WARN' }, ({ level, ...rest }) => {
              return { level: 'warning' as const, ...rest };
            })
            .with({ level: 'INFO' }, ({ level, ...rest }) => {
              return { level: 'info' as const, ...rest };
            })
            .with({ level: 'DEBUG' }, ({ level, ...rest }) => {
              return { level: 'debug' as const, ...rest };
            })
            .exhaustive();

          writeLogs(store.remoteRuntimeLogs, tweaked);
        } catch (error) {
          store.localRuntimeLogs.error(error?.toString() ?? 'Unknown error');
          store.localRuntimeLogs.error(`Failed to parse line: ${line}`);
        }
      });

    store.remoteRuntimeLogs.info(`Done`);
  });
};
