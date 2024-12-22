import { z } from 'zod';

export const extensionsObject = z.object({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __x__: z.object({
    type: z.string(),
    extensionFields: z.record(z.unknown()),
  }),
});
