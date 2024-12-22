"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skmtcStackConfig = exports.generatorType = exports.skmtcClientConfig = exports.clientSettings = exports.modulePackage = exports.clientGeneratorSettings = exports.modelsGeneratorSettings = exports.operationsGeneratorSettings = void 0;
require("../_dnt.polyfills.js");
const Method_js_1 = require("./Method.js");
const zod_1 = require("zod");
exports.operationsGeneratorSettings = zod_1.z.object({
    id: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    operations: zod_1.z.record(zod_1.z.record(Method_js_1.method, zod_1.z.boolean()))
});
exports.modelsGeneratorSettings = zod_1.z.object({
    id: zod_1.z.string(),
    exportPath: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    models: zod_1.z.record(zod_1.z.boolean())
});
exports.clientGeneratorSettings = zod_1.z.union([
    exports.operationsGeneratorSettings,
    exports.modelsGeneratorSettings
]);
exports.modulePackage = zod_1.z.object({
    rootPath: zod_1.z.string(),
    moduleName: zod_1.z.string()
});
exports.clientSettings = zod_1.z.object({
    basePath: zod_1.z.string().optional(),
    packages: zod_1.z.array(exports.modulePackage).optional(),
    generators: zod_1.z.array(exports.clientGeneratorSettings)
});
exports.skmtcClientConfig = zod_1.z.object({
    serverName: zod_1.z.string().optional(),
    stackName: zod_1.z.string().optional(),
    deploymentId: zod_1.z.string().optional(),
    settings: exports.clientSettings
});
exports.generatorType = zod_1.z.enum(['operation', 'model']);
exports.skmtcStackConfig = zod_1.z.object({
    name: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
    generators: zod_1.z.array(zod_1.z.string())
});
