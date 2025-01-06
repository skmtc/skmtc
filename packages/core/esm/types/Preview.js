import { z } from 'zod';
export const preview = z.object({
    importName: z.string(),
    importPath: z.string(),
    group: z.string(),
    route: z.string().optional()
});
