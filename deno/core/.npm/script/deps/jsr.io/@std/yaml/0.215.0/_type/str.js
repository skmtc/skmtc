"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.str = void 0;
const type_js_1 = require("../type.js");
exports.str = new type_js_1.Type("tag:yaml.org,2002:str", {
    construct(data) {
        return data !== null ? data : "";
    },
    kind: "scalar",
});
