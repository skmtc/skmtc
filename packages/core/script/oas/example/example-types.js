"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasExampleData = void 0;
const markdown_types_js_1 = require("../markdown/markdown-types.js");
const zod_openapi_1 = require("@hono/zod-openapi");
exports.oasExampleData = zod_openapi_1.z.object({
    oasType: zod_openapi_1.z.literal('example'),
    summary: zod_openapi_1.z.string().optional(),
    description: markdown_types_js_1.markdown.optional(),
    value: zod_openapi_1.z.unknown().optional()
    // externalValue: url.optional()
});
