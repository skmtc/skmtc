"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifestContent = exports.previewItem = exports.manifestEntry = void 0;
require("../_dnt.polyfills.js");
const GeneratorKeys_js_1 = require("./GeneratorKeys.js");
const zod_1 = require("zod");
const Results_js_1 = require("./Results.js");
const Preview_js_1 = require("./Preview.js");
exports.manifestEntry = zod_1.z.object({
    numberOfLines: zod_1.z.number(),
    numberOfCharacters: zod_1.z.number(),
    hash: zod_1.z.string(),
    generatorKeys: zod_1.z.array(zod_1.z.string().refine(GeneratorKeys_js_1.isGeneratorKey)),
    destinationPath: zod_1.z.string()
});
exports.previewItem = zod_1.z.object({
    name: zod_1.z.string(),
    exportPath: zod_1.z.string()
});
exports.manifestContent = zod_1.z.object({
    deploymentId: zod_1.z.string(),
    traceId: zod_1.z.string(),
    spanId: zod_1.z.string(),
    region: zod_1.z.string().optional(),
    files: zod_1.z.record(exports.manifestEntry),
    previews: zod_1.z.record(zod_1.z.string(), zod_1.z.record(Preview_js_1.preview)),
    pinnable: zod_1.z.record(zod_1.z.string().refine(GeneratorKeys_js_1.isGeneratorKey), zod_1.z.string()),
    results: Results_js_1.resultsItem,
    startAt: zod_1.z.number(),
    endAt: zod_1.z.number()
});
