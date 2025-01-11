import { markdown } from '../markdown/markdown-types.js';
import { z } from '@hono/zod-openapi';
export const oasSchemaRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['schema']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
export const oasResponseRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['response']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
export const oasParameterRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['parameter']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
export const oasExampleRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['example']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
export const oasRequestBodyRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['requestBody']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
export const oasHeaderRefData = z.object({
    oasType: z.literal('ref'),
    refType: z.enum(['header']),
    $ref: z.string(),
    summary: z.string().optional(),
    description: markdown.optional()
});
// OasPathItemRefData
export const oasRefData = z.union([
    oasSchemaRefData,
    oasResponseRefData,
    oasParameterRefData,
    oasExampleRefData,
    oasRequestBodyRefData,
    oasHeaderRefData
    // oasPathItemRefData
]);
