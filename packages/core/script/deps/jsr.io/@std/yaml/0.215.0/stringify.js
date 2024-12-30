"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringify = stringify;
const dumper_js_1 = require("./_dumper/dumper.js");
/**
 * Serializes `object` as a YAML document.
 *
 * You can disable exceptions by setting the skipInvalid option to true.
 */
function stringify(obj, options) {
    return (0, dumper_js_1.dump)(obj, options);
}
