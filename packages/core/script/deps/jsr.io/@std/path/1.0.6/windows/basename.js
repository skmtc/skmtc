"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.basename = basename;
const basename_js_1 = require("../_common/basename.js");
const constants_js_1 = require("../_common/constants.js");
const strip_trailing_separators_js_1 = require("../_common/strip_trailing_separators.js");
const _util_js_1 = require("./_util.js");
/**
 * Return the last portion of a `path`.
 * Trailing directory separators are ignored, and optional suffix is removed.
 *
 * @example Usage
 * ```ts
 * import { basename } from "@std/path/windows/basename";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(basename("C:\\user\\Documents\\"), "Documents");
 * assertEquals(basename("C:\\user\\Documents\\image.png"), "image.png");
 * assertEquals(basename("C:\\user\\Documents\\image.png", ".png"), "image");
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `basename` from `@std/path/windows/unstable-basename`.
 *
 * @param path The path to extract the name from.
 * @param suffix The suffix to remove from extracted name.
 * @returns The extracted name.
 */
function basename(path, suffix = "") {
    (0, basename_js_1.assertArgs)(path, suffix);
    // Check for a drive letter prefix so as not to mistake the following
    // path separator as an extra separator at the end of the path that can be
    // disregarded
    let start = 0;
    if (path.length >= 2) {
        const drive = path.charCodeAt(0);
        if ((0, _util_js_1.isWindowsDeviceRoot)(drive)) {
            if (path.charCodeAt(1) === constants_js_1.CHAR_COLON)
                start = 2;
        }
    }
    const lastSegment = (0, basename_js_1.lastPathSegment)(path, _util_js_1.isPathSeparator, start);
    const strippedSegment = (0, strip_trailing_separators_js_1.stripTrailingSeparators)(lastSegment, _util_js_1.isPathSeparator);
    return suffix ? (0, basename_js_1.stripSuffix)(strippedSegment, suffix) : strippedSegment;
}
