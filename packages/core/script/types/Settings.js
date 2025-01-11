"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skmtcStackConfig = exports.skmtcClientConfig = exports.clientSettings = exports.modulePackage = exports.clientGeneratorSettings = exports.modelsGeneratorSettings = exports.operationsGeneratorSettings = exports.enrichedSetting = void 0;
require("../_dnt.polyfills.js");
const Method_js_1 = require("./Method.js");
const zod_openapi_1 = require("@hono/zod-openapi");
exports.enrichedSetting = zod_openapi_1.z
    .object({
    selected: zod_openapi_1.z.boolean(),
    enrichments: zod_openapi_1.z.unknown().optional()
})
    .openapi('EnrichedSetting');
exports.operationsGeneratorSettings = zod_openapi_1.z
    .object({
    id: zod_openapi_1.z.string(),
    description: zod_openapi_1.z.string().optional(),
    operations: zod_openapi_1.z.record(zod_openapi_1.z.record(Method_js_1.method, exports.enrichedSetting))
})
    .openapi('OperationsGeneratorSettings');
exports.modelsGeneratorSettings = zod_openapi_1.z
    .object({
    id: zod_openapi_1.z.string(),
    exportPath: zod_openapi_1.z.string().optional(),
    description: zod_openapi_1.z.string().optional(),
    models: zod_openapi_1.z.record(exports.enrichedSetting)
})
    .openapi('ModelsGeneratorSettings');
exports.clientGeneratorSettings = zod_openapi_1.z
    .union([exports.operationsGeneratorSettings, exports.modelsGeneratorSettings])
    .openapi('GeneratorSettings');
exports.modulePackage = zod_openapi_1.z
    .object({
    rootPath: zod_openapi_1.z.string(),
    moduleName: zod_openapi_1.z.string()
})
    .openapi('ModulePackage');
exports.clientSettings = zod_openapi_1.z
    .object({
    basePath: zod_openapi_1.z.string().optional(),
    packages: zod_openapi_1.z.array(exports.modulePackage).optional().openapi('ModulePackages'),
    generators: zod_openapi_1.z.array(exports.clientGeneratorSettings)
})
    .openapi('ClientSettings');
exports.skmtcClientConfig = zod_openapi_1.z
    .object({
    serverName: zod_openapi_1.z.string().optional(),
    stackName: zod_openapi_1.z.string().optional(),
    deploymentId: zod_openapi_1.z.string().optional(),
    settings: exports.clientSettings
})
    .openapi('SkmtcClientConfig');
exports.skmtcStackConfig = zod_openapi_1.z
    .object({
    name: zod_openapi_1.z.string().optional(),
    version: zod_openapi_1.z.string().optional(),
    generators: zod_openapi_1.z.array(zod_openapi_1.z.string())
})
    .openapi('SkmtcStackConfig');
