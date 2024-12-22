"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.map = void 0;
const type_js_1 = require("../type.js");
exports.map = new type_js_1.Type("tag:yaml.org,2002:map", {
    construct(data) {
        return data !== null ? data : {};
    },
    kind: "mapping",
});
