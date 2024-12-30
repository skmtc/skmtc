"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.set = void 0;
const type_js_1 = require("../type.js");
const { hasOwn } = Object;
function resolveYamlSet(data) {
    if (data === null)
        return true;
    for (const key in data) {
        if (hasOwn(data, key)) {
            if (data[key] !== null)
                return false;
        }
    }
    return true;
}
function constructYamlSet(data) {
    return data !== null ? data : {};
}
exports.set = new type_js_1.Type("tag:yaml.org,2002:set", {
    construct: constructYamlSet,
    kind: "mapping",
    resolve: resolveYamlSet,
});
