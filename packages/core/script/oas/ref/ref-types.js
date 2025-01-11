"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasRefData = exports.oasHeaderRefData = exports.oasRequestBodyRefData = exports.oasExampleRefData = exports.oasParameterRefData = exports.oasResponseRefData = exports.oasSchemaRefData = void 0;
const markdown_types_js_1 = require("../markdown/markdown-types.js");
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasSchemaRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['schema']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
exports.oasResponseRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['response']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
exports.oasParameterRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['parameter']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
exports.oasExampleRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['example']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
exports.oasRequestBodyRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['requestBody']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
exports.oasHeaderRefData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('ref'),
    refType: zod_openapi_1.z.enum(['header']),
    $ref: zod_openapi_1.z.string(),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional()
});
// OasPathItemRefData
exports.oasRefData = zod_openapi_1.z.union([
    exports.oasSchemaRefData,
    exports.oasResponseRefData,
    exports.oasParameterRefData,
    exports.oasExampleRefData,
    exports.oasRequestBodyRefData,
    exports.oasHeaderRefData
    // oasPathItemRefData
]);
