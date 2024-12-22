"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSON_SCHEMA = exports.FAILSAFE_SCHEMA = exports.EXTENDED_SCHEMA = exports.DEFAULT_SCHEMA = exports.CORE_SCHEMA = void 0;
var core_js_1 = require("./core.js");
Object.defineProperty(exports, "CORE_SCHEMA", { enumerable: true, get: function () { return core_js_1.core; } });
var default_js_1 = require("./default.js");
Object.defineProperty(exports, "DEFAULT_SCHEMA", { enumerable: true, get: function () { return default_js_1.def; } });
var extended_js_1 = require("./extended.js");
Object.defineProperty(exports, "EXTENDED_SCHEMA", { enumerable: true, get: function () { return extended_js_1.extended; } });
var failsafe_js_1 = require("./failsafe.js");
Object.defineProperty(exports, "FAILSAFE_SCHEMA", { enumerable: true, get: function () { return failsafe_js_1.failsafe; } });
var json_js_1 = require("./json.js");
Object.defineProperty(exports, "JSON_SCHEMA", { enumerable: true, get: function () { return json_js_1.json; } });
