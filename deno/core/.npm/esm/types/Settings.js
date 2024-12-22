import "../_dnt.polyfills.js";
import { method } from './Method.js';
import { z } from 'zod';
export const operationsGeneratorSettings = z.object({
    id: z.string(),
    description: z.string().optional(),
    operations: z.record(z.record(method, z.boolean()))
});
export const modelsGeneratorSettings = z.object({
    id: z.string(),
    exportPath: z.string().optional(),
    description: z.string().optional(),
    models: z.record(z.boolean())
});
export const clientGeneratorSettings = z.union([
    operationsGeneratorSettings,
    modelsGeneratorSettings
]);
export const modulePackage = z.object({
    rootPath: z.string(),
    moduleName: z.string()
});
export const clientSettings = z.object({
    basePath: z.string().optional(),
    packages: z.array(modulePackage).optional(),
    generators: z.array(clientGeneratorSettings)
});
export const skmtcClientConfig = z.object({
    serverName: z.string().optional(),
    stackName: z.string().optional(),
    deploymentId: z.string().optional(),
    settings: clientSettings
});
export const generatorType = z.enum(['operation', 'model']);
export const skmtcStackConfig = z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    generators: z.array(z.string())
});
