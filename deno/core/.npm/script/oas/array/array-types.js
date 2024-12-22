"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasArrayData = void 0;
const zod_1 = require("zod");
const schema_types_js_1 = require("../schema/schema-types.js");
const ref_types_js_1 = require("../ref/ref-types.js");
exports.oasArrayData = zod_1.z.object({
    oasType: zod_1.z.literal('schema'),
    // Add soon
    type: zod_1.z.literal('array'),
    // additionalItems: z.lazy(() => z.union([z.boolean(), jsonSchema4]).optional()),
    items: zod_1.z.lazy(() => zod_1.z.union([schema_types_js_1.oasSchemaData, ref_types_js_1.oasSchemaRefData])),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    default: zod_1.z.array(zod_1.z.unknown()).optional()
    // Add soon
    // maxItems: z.number().optional(),
    // minItems: z.number().optional(),
    // uniqueItems: z.boolean().optional()
});
