"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preview = void 0;
require("../_dnt.polyfills.js");
const zod_1 = require("zod");
const Method_js_1 = require("./Method.js");
const operationPreview = zod_1.z.object({
    type: zod_1.z.literal('operation'),
    generatorId: zod_1.z.string(),
    operationPath: zod_1.z.string(),
    operationMethod: Method_js_1.method
});
const modelPreview = zod_1.z.object({
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
    source: zod_1.z.discriminatedUnion('type', [operationPreview, modelPreview])
})
    .openapi('Preview');
