import "../_dnt.polyfills.js";
import { z } from 'zod';
import { method } from './Method.js';
export const inputOption = z.object({
    schema: z.record(z.unknown()),
    label: z.string(),
    name: z.string().optional()
});
export const formatterOption = z.object({
    schema: z.record(z.unknown()),
    label: z.string()
});
export const operationPreview = z.object({
    type: z.literal('operation'),
    generatorId: z.string(),
    operationPath: z.string(),
    operationMethod: method
});
export const modelPreview = z.object({
    type: z.literal('model'),
    generatorId: z.string(),
    refName: z.string()
});
export const preview = z
    .object({
    name: z.string(),
    exportPath: z.string(),
    group: z.string(),
    route: z.string().optional(),
    input: inputOption.optional(),
    formatter: formatterOption.optional(),
    source: z.discriminatedUnion('type', [operationPreview, modelPreview])
})
    .openapi('Preview');
