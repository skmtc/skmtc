import { z } from 'zod';

export type ServerModel = {
  id: string;
  stackName: string;
  deploymentId: string | null;
  createdAt: string;
};

export const serverModel = z.object({
  id: z.string(),
  stackName: z.string(),
  deploymentId: z.number().nullable(),
  createdAt: z.string(),
});
