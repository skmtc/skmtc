import { SKMTC_API } from '../api/constants';

type ToServerUrlArgs = {
  serverName: string;
  deploymentId?: string;
};

export const toServerUrl = ({ serverName, deploymentId }: ToServerUrlArgs) => {
  const base = `${SKMTC_API}/servers/${serverName}`;
  return deploymentId ? `${base}/${deploymentId}` : base;
};
