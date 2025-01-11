import "../_dnt.polyfills.js";
import { method } from './Method.js';
import { z } from '@hono/zod-openapi';
export const enrichedSetting = z
    .object({
    selected: z.boolean(),
    enrichments: z.unknown().optional()
})
    .openapi('EnrichedSetting');
export const operationsGeneratorSettings = z
    .object({
    id: z.string(),
    description: z.string().optional(),
    operations: z.record(z.record(method, enrichedSetting))
})
    .openapi('OperationsGeneratorSettings');
export const modelsGeneratorSettings = z
    .object({
    id: z.string(),
    exportPath: z.string().optional(),
    description: z.string().optional(),
    models: z.record(enrichedSetting)
})
    .openapi('ModelsGeneratorSettings');
export const clientGeneratorSettings = z
    .union([operationsGeneratorSettings, modelsGeneratorSettings])
    .openapi('GeneratorSettings');
export const modulePackage = z
    .object({
    rootPath: z.string(),
    moduleName: z.string()
})
    .openapi('ModulePackage');
export const clientSettings = z
    .object({
    basePath: z.string().optional(),
    packages: z.array(modulePackage).optional().openapi('ModulePackages'),
    generators: z.array(clientGeneratorSettings)
})
    .openapi('ClientSettings');
export const skmtcClientConfig = z
    .object({
    serverName: z.string().optional(),
    stackName: z.string().optional(),
    deploymentId: z.string().optional(),
    settings: clientSettings
})
    .openapi('SkmtcClientConfig');
export const skmtcStackConfig = z
    .object({
    name: z.string().optional(),
    version: z.string().optional(),
    generators: z.array(z.string())
})
    .openapi('SkmtcStackConfig');
