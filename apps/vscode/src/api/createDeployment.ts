import { SkmtcStackConfig } from '@skmtc/core/Settings';
import { getSession } from '../auth/getSession';
import { DenoFiles } from '../types/File';
import { SKMTC_API } from './constants';
import { z } from 'zod';

export type Plugin = {
  id: string;
  src: string;
  type: 'operations' | 'models';
  description?: string;
};

type CreateDeploymentArgs = {
  assets: DenoFiles;
  stackConfig: SkmtcStackConfig;
};

const denoDeployment = z.object({
  id: z.string(),
  serverName: z.string(),
  projectId: z.string(),
  status: z.enum(['pending', 'success', 'failed']),
  createdAt: z.string(),
});

export const createDeployment = async ({ assets, stackConfig }: CreateDeploymentArgs) => {
  const session = await getSession({ createIfNone: true });

  if (!session) {
    return;
  }

  const res = await fetch(`${SKMTC_API}/servers`, {
    method: 'POST',
    body: JSON.stringify({
      assets,
      generators: stackConfig.generators,
    }),
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Authorization': `Bearer ${session.accessToken}`,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(`Failed to deploy stack: ${body.message}`);
  }

  return denoDeployment.parse(body);
};
