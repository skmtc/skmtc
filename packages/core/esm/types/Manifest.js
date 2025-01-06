import "../_dnt.polyfills.js";
import { isGeneratorKey } from './GeneratorKeys.js';
import { z } from 'zod';
import { resultsItem } from './Results.js';
import { preview } from './Preview.js';
export const manifestEntry = z.object({
    numberOfLines: z.number(),
    numberOfCharacters: z.number(),
    hash: z.string(),
    generatorKeys: z.array(z.string().refine(isGeneratorKey)),
    destinationPath: z.string()
});
export const previewItem = z.object({
    name: z.string(),
    exportPath: z.string()
});
export const manifestContent = z.object({
    deploymentId: z.string(),
    traceId: z.string(),
    spanId: z.string(),
    region: z.string().optional(),
    files: z.record(manifestEntry),
    previews: z.record(z.string(), z.record(preview)),
    pinnable: z.record(z.string().refine(isGeneratorKey), z.string()),
    results: resultsItem,
    startAt: z.number(),
    endAt: z.number()
});
