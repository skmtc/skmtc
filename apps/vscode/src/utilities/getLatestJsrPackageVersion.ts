import { z } from 'zod';

const jsrMeta = z.object({
  latest: z.string(),
});

type GetVersionArgs = {
  scope: string;
  name: string;
};

export const getLatestJsrPackageVersion = async ({ scope, name }: GetVersionArgs) => {
  const url = `https://jsr.io/${scope}/${name}/meta.json`;

  console.log(url);

  const metaRes = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  const possibleMeta = await metaRes.json();

  const meta = jsrMeta.parse(possibleMeta);

  const { latest } = meta;

  return latest;
};
