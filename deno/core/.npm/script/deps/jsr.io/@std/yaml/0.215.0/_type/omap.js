"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.omap = void 0;
const type_js_1 = require("../type.js");
const { hasOwn } = Object;
const _toString = Object.prototype.toString;
function resolveYamlOmap(data) {
    const objectKeys = [];
    let pairKey = "";
    let pairHasKey = false;
    for (const pair of data) {
        pairHasKey = false;
        if (_toString.call(pair) !== "[object Object]")
            return false;
        for (pairKey in pair) {
            if (hasOwn(pair, pairKey)) {
                if (!pairHasKey)
                    pairHasKey = true;
                else
                    return false;
            }
        }
        if (!pairHasKey)
            return false;
        if (objectKeys.indexOf(pairKey) === -1)
            objectKeys.push(pairKey);
        else
            return false;
    }
    return true;
}
function constructYamlOmap(data) {
    return data !== null ? data : [];
}
exports.omap = new type_js_1.Type("tag:yaml.org,2002:omap", {
    construct: constructYamlOmap,
    kind: "sequence",
    resolve: resolveYamlOmap,
});
