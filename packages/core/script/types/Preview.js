"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preview = exports.modelPreview = exports.operationPreview = exports.formatterOption = exports.inputOption = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
const Method_js_1 = require("./Method.js");
exports.inputOption = zod_1.z.object({
    schema: zod_1.z.record(zod_1.z.unknown()),
    label: zod_1.z.string(),
    name: zod_1.z.string().optional()
});
exports.formatterOption = zod_1.z.object({
    schema: zod_1.z.record(zod_1.z.unknown()),
    label: zod_1.z.string()
});
exports.operationPreview = zod_1.z.object({
    type: zod_1.z.literal('operation'),
    generatorId: zod_1.z.string(),
    operationPath: zod_1.z.string(),
    operationMethod: Method_js_1.method
});
exports.modelPreview = zod_1.z.object({
    type: zod_1.z.literal('model'),
    generatorId: zod_1.z.string(),
    refName: zod_1.z.string()
});
exports.preview = zod_1.z
    .object({
    name: zod_1.z.string(),
    exportPath: zod_1.z.string(),
    group: zod_1.z.string(),
    route: zod_1.z.string().optional(),
    input: exports.inputOption.optional(),
    formatter: exports.formatterOption.optional(),
    source: zod_1.z.discriminatedUnion('type', [exports.operationPreview, exports.modelPreview])
})
    .openapi('Preview');
