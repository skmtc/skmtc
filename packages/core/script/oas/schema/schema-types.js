"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oasSchemaData = void 0;
const zod_openapi_1 = require("@hono/zod-openapi");
const array_types_js_1 = require("../array/array-types.js");
const boolean_types_js_1 = require("../boolean/boolean-types.js");
const null_types_js_1 = require("../null/null-types.js");
const unknown_types_js_1 = require("../unknown/unknown-types.js");
const union_types_js_1 = require("../union/union-types.js");
const integer_types_js_1 = require("../integer/integer-types.js");
const number_types_js_1 = require("../number/number-types.js");
const intersection_types_js_1 = require("../intersection/intersection-types.js");
const string_types_js_1 = require("../string/string-types.js");
const object_types_js_1 = require("../object/object-types.js");
exports.oasSchemaData = zod_openapi_1.z.union([
    object_types_js_1.oasObjectData,
    array_types_js_1.oasArrayData,
    boolean_types_js_1.oasBooleanData,
    string_types_js_1.oasStringData,
    number_types_js_1.oasNumberData,
    null_types_js_1.oasNullData,
    integer_types_js_1.oasIntegerData,
    union_types_js_1.oasUnionData,
    intersection_types_js_1.oasIntersectionData,
    unknown_types_js_1.oasUnknownData
]);
