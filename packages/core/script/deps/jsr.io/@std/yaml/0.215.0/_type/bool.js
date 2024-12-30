"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.bool = void 0;
const type_js_1 = require("../type.js");
const _utils_js_1 = require("../_utils.js");
function resolveYamlBoolean(data) {
    const max = data.length;
    return ((max === 4 && (data === "true" || data === "True" || data === "TRUE")) ||
        (max === 5 && (data === "false" || data === "False" || data === "FALSE")));
}
function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
}
exports.bool = new type_js_1.Type("tag:yaml.org,2002:bool", {
    construct: constructYamlBoolean,
    defaultStyle: "lowercase",
    kind: "scalar",
    predicate: _utils_js_1.isBoolean,
    represent: {
        lowercase(object) {
            return object ? "true" : "false";
        },
        uppercase(object) {
            return object ? "TRUE" : "FALSE";
        },
        camelcase(object) {
            return object ? "True" : "False";
        },
    },
    resolve: resolveYamlBoolean,
});
