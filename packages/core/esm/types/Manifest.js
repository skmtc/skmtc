import "../_dnt.polyfills.js";
import { isGeneratorKey } from './GeneratorKeys.js';
import { z } from '@hono/zod-openapi';
import { resultsItem, resultsItemJsonSchema } from './Results.js';
import { preview } from './Preview.js';
export const manifestEntry = z
    .object({
    numberOfLines: z.number(),
    numberOfCharacters: z.number(),
    hash: z.string(),
    generatorKeys: z.array(z.string().refine(isGeneratorKey)),
    destinationPath: z.string()
})
    .openapi('ManifestEntry');
export const previewItem = z
    .object({
    name: z.string(),
    exportPath: z.string()
})
    .openapi('PreviewItem');
export const manifestContent = z
    .object({
    deploymentId: z.string(),
    traceId: z.string(),
    spanId: z.string(),
    region: z.string().optional(),
    files: z.record(manifestEntry),
    previews: z.record(z.record(preview)),
    pinnable: z.record(z.string().refine(isGeneratorKey), z.string()),
    results: resultsItem.openapi('ResultsItem', resultsItemJsonSchema),
    startAt: z.number(),
    endAt: z.number()
})
    .openapi('ManifestContent');
