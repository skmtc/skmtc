"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasParameterData = exports.oasParameterStyle = exports.oasParameterLocation = void 0;
const example_types_js_1 = require("../example/example-types.js");
const markdown_types_js_1 = require("../markdown/markdown-types.js");
const mediaType_types_js_1 = require("../mediaType/mediaType-types.js");
const ref_types_js_1 = require("../ref/ref-types.js");
const schema_types_js_1 = require("../schema/schema-types.js");
const zod_1 = require("zod");
exports.oasParameterLocation = zod_1.z.enum([
    'query',
    'header',
    'path',
    'cookie'
]);
exports.oasParameterStyle = zod_1.z.enum([
    'matrix',
    'label',
    'form',
    'simple',
    'spaceDelimited',
    'pipeDelimited',
    'deepObject'
]);
exports.oasParameterData = zod_1.z.object({
    oasType: zod_1.z.literal('parameter'),
    // Default values (based on value of in): for query - form; for path - simple; for header - simple; for cookie - form.
    // example: z.any().optional(),
    allowReserved: zod_1.z.boolean().optional(),
    allowEmptyValue: zod_1.z.boolean().optional(),
    content: zod_1.z.record(mediaType_types_js_1.oasMediaTypeData).optional(),
    deprecated: zod_1.z.boolean().optional(),
    description: markdown_types_js_1.markdown.optional(),
    examples: zod_1.z.record(zod_1.z.union([example_types_js_1.oasExampleData, ref_types_js_1.oasExampleRefData])).optional(),
    explode: zod_1.z.boolean(),
    location: exports.oasParameterLocation,
    name: zod_1.z.string(),
    required: zod_1.z.boolean().optional(),
    schema: zod_1.z.union([schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData]).optional(),
    style: exports.oasParameterStyle
});
