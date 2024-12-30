"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.failsafe = void 0;
const schema_js_1 = require("../schema.js");
const mod_js_1 = require("../_type/mod.js");
// Standard YAML's Failsafe schema.
// http://www.yaml.org/spec/1.2/spec.html#id2802346
exports.failsafe = new schema_js_1.Schema({
    explicit: [mod_js_1.str, mod_js_1.seq, mod_js_1.map],
});
