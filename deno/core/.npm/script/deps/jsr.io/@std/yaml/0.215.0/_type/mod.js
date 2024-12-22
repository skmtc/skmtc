"use strict";
// Ported from js-yaml v3.13.1:
// https://github.com/nodeca/js-yaml/commit/665aadda42349dcae869f12040d9b10ef18d12da
// Copyright 2011-2015 by Vitaly Puzrin. All rights reserved. MIT license.
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.undefinedType = exports.timestamp = exports.str = exports.set = exports.seq = exports.regexp = exports.pairs = exports.omap = exports.nil = exports.merge = exports.map = exports.int = exports.func = exports.float = exports.bool = exports.binary = void 0;
var binary_js_1 = require("./binary.js");
Object.defineProperty(exports, "binary", { enumerable: true, get: function () { return binary_js_1.binary; } });
var bool_js_1 = require("./bool.js");
Object.defineProperty(exports, "bool", { enumerable: true, get: function () { return bool_js_1.bool; } });
var float_js_1 = require("./float.js");
Object.defineProperty(exports, "float", { enumerable: true, get: function () { return float_js_1.float; } });
var function_js_1 = require("./function.js");
Object.defineProperty(exports, "func", { enumerable: true, get: function () { return function_js_1.func; } });
var int_js_1 = require("./int.js");
Object.defineProperty(exports, "int", { enumerable: true, get: function () { return int_js_1.int; } });
var map_js_1 = require("./map.js");
Object.defineProperty(exports, "map", { enumerable: true, get: function () { return map_js_1.map; } });
var merge_js_1 = require("./merge.js");
Object.defineProperty(exports, "merge", { enumerable: true, get: function () { return merge_js_1.merge; } });
var nil_js_1 = require("./nil.js");
Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return nil_js_1.nil; } });
var omap_js_1 = require("./omap.js");
Object.defineProperty(exports, "omap", { enumerable: true, get: function () { return omap_js_1.omap; } });
var pairs_js_1 = require("./pairs.js");
Object.defineProperty(exports, "pairs", { enumerable: true, get: function () { return pairs_js_1.pairs; } });
var regexp_js_1 = require("./regexp.js");
Object.defineProperty(exports, "regexp", { enumerable: true, get: function () { return regexp_js_1.regexp; } });
var seq_js_1 = require("./seq.js");
Object.defineProperty(exports, "seq", { enumerable: true, get: function () { return seq_js_1.seq; } });
var set_js_1 = require("./set.js");
Object.defineProperty(exports, "set", { enumerable: true, get: function () { return set_js_1.set; } });
var str_js_1 = require("./str.js");
Object.defineProperty(exports, "str", { enumerable: true, get: function () { return str_js_1.str; } });
var timestamp_js_1 = require("./timestamp.js");
Object.defineProperty(exports, "timestamp", { enumerable: true, get: function () { return timestamp_js_1.timestamp; } });
var undefined_js_1 = require("./undefined.js");
Object.defineProperty(exports, "undefinedType", { enumerable: true, get: function () { return undefined_js_1.undefinedType; } });
