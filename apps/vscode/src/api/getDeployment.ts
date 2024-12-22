import { getSession } from '../auth/getSession';
import { SKMTC_API } from './constants';

type GetDeploymentArgs = {
  deploymentId: string;
};

export const getDeployment = async ({ deploymentId }: GetDeploymentArgs) => {
  const session = await getSession({ createIfNone: true });

  if (!session) {
    return;
  }

  const deploymentRes = await fetch(`${SKMTC_API}/deployments/${deploymentId}`, {
    method: 'GET',
    headers: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Content-Type': 'application/json',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'Authorization': `Bearer ${session.accessToken}`,
    },
  });

  return await deploymentRes.json();
};
