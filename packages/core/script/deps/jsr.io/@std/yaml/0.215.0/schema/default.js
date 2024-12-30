"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.def = void 0;
const schema_js_1 = require("../schema.js");
const mod_js_1 = require("../_type/mod.js");
const core_js_1 = require("./core.js");
// JS-YAML's default schema for `safeLoad` function.
// It is not described in the YAML specification.
exports.def = new schema_js_1.Schema({
    explicit: [mod_js_1.binary, mod_js_1.omap, mod_js_1.pairs, mod_js_1.set],
    implicit: [mod_js_1.timestamp, mod_js_1.merge],
    include: [core_js_1.core],
});
