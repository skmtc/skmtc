"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// Copyright the Browserify authors. MIT License.
// Ported from https://github.com/browserify/path-browserify/
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPosixPathSeparator = isPosixPathSeparator;
exports.isPathSeparator = isPathSeparator;
exports.isWindowsDeviceRoot = isWindowsDeviceRoot;
const constants_js_1 = require("../_common/constants.js");
function isPosixPathSeparator(code) {
    return code === constants_js_1.CHAR_FORWARD_SLASH;
}
function isPathSeparator(code) {
    return code === constants_js_1.CHAR_FORWARD_SLASH || code === constants_js_1.CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
    return ((code >= constants_js_1.CHAR_LOWERCASE_A && code <= constants_js_1.CHAR_LOWERCASE_Z) ||
        (code >= constants_js_1.CHAR_UPPERCASE_A && code <= constants_js_1.CHAR_UPPERCASE_Z));
}
