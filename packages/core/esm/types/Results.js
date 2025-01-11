import "../_dnt.polyfills.js";
import { z } from '@hono/zod-openapi';
import { zodToJsonSchema } from 'zod-to-json-schema';
export const resultType = z.enum(['success', 'warning', 'error', 'notSelected', 'notSupported']);
export const resultsItem = z.record(z.lazy(() => z.union([resultsItem, resultType, z.array(resultsItem.nullable())])));
export const resultsItemJsonSchema = zodToJsonSchema(resultsItem, {
    basePath: [`#/components/schemas/ResultsItem`],
    target: 'openApi3',
    strictUnions: true
});
