"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifestContent = exports.previewItem = exports.manifestEntry = void 0;
require("../_dnt.polyfills.js");
const GeneratorKeys_js_1 = require("./GeneratorKeys.js");
const zod_openapi_1 = require("@hono/zod-openapi");
const Results_js_1 = require("./Results.js");
const Preview_js_1 = require("./Preview.js");
exports.manifestEntry = zod_openapi_1.z
    .object({
    numberOfLines: zod_openapi_1.z.number(),
    numberOfCharacters: zod_openapi_1.z.number(),
    hash: zod_openapi_1.z.string(),
    generatorKeys: zod_openapi_1.z.array(zod_openapi_1.z.string().refine(GeneratorKeys_js_1.isGeneratorKey)),
    destinationPath: zod_openapi_1.z.string()
})
    .openapi('ManifestEntry');
exports.previewItem = zod_openapi_1.z
    .object({
    name: zod_openapi_1.z.string(),
    exportPath: zod_openapi_1.z.string()
})
    .openapi('PreviewItem');
exports.manifestContent = zod_openapi_1.z
    .object({
    deploymentId: zod_openapi_1.z.string(),
    traceId: zod_openapi_1.z.string(),
    spanId: zod_openapi_1.z.string(),
    region: zod_openapi_1.z.string().optional(),
    files: zod_openapi_1.z.record(exports.manifestEntry),
    previews: zod_openapi_1.z.record(zod_openapi_1.z.record(Preview_js_1.preview)),
    pinnable: zod_openapi_1.z.record(zod_openapi_1.z.string().refine(GeneratorKeys_js_1.isGeneratorKey), zod_openapi_1.z.string()),
    results: Results_js_1.resultsItem.openapi('ResultsItem', Results_js_1.resultsItemJsonSchema),
    startAt: zod_openapi_1.z.number(),
    endAt: zod_openapi_1.z.number()
})
    .openapi('ManifestContent');
