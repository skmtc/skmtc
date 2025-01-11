import "../_dnt.polyfills.js";
import { z } from 'zod';
import { method } from './Method.js';
const operationPreview = z.object({
    type: z.literal('operation'),
    generatorId: z.string(),
    operationPath: z.string(),
    operationMethod: method
});
const modelPreview = z.object({
    type: z.literal('model'),
    generatorId: z.string(),
    refName: z.string()
});
export const preview = z.object({
    name: z.string(),
    exportPath: z.string(),
    group: z.string(),
    route: z.string().optional(),
    source: z.union([operationPreview, modelPreview])
});
