import "../_dnt.polyfills.js";
import type { z } from 'zod';
export type EnrichmentRequest<EnrichmentType> = {
    prompt: string;
    responseSchema: z.ZodType<EnrichmentType>;
    content: string;
};
//# sourceMappingURL=EnrichmentRequest.d.ts.map