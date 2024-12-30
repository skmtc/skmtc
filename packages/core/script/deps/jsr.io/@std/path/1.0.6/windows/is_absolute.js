"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAbsolute = isAbsolute;
const constants_js_1 = require("../_common/constants.js");
const assert_path_js_1 = require("../_common/assert_path.js");
const _util_js_1 = require("./_util.js");
/**
 * Verifies whether provided path is absolute.
 *
 * @example Usage
 * ```ts
 * import { isAbsolute } from "@std/path/windows/is-absolute";
 * import { assert, assertFalse } from "@std/assert";
 *
 * assert(isAbsolute("C:\\foo\\bar"));
 * assertFalse(isAbsolute("..\\baz"));
 * ```
 *
 * @param path The path to verify.
 * @returns `true` if the path is absolute, `false` otherwise.
 */
function isAbsolute(path) {
    (0, assert_path_js_1.assertPath)(path);
    const len = path.length;
    if (len === 0)
        return false;
    const code = path.charCodeAt(0);
    if ((0, _util_js_1.isPathSeparator)(code)) {
        return true;
    }
    else if ((0, _util_js_1.isWindowsDeviceRoot)(code)) {
        // Possible device root
        if (len > 2 && path.charCodeAt(1) === constants_js_1.CHAR_COLON) {
            if ((0, _util_js_1.isPathSeparator)(path.charCodeAt(2)))
                return true;
        }
    }
    return false;
}
