"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.basename = basename;
const basename_js_1 = require("../_common/basename.js");
const strip_trailing_separators_js_1 = require("../_common/strip_trailing_separators.js");
const _util_js_1 = require("./_util.js");
/**
 * Return the last portion of a `path`.
 * Trailing directory separators are ignored, and optional suffix is removed.
 *
 * @example Usage
 * ```ts
 * import { basename } from "@std/path/posix/basename";
 * import { assertEquals } from "@std/assert";
 *
 * assertEquals(basename("/home/user/Documents/"), "Documents");
 * assertEquals(basename("/home/user/Documents/image.png"), "image.png");
 * assertEquals(basename("/home/user/Documents/image.png", ".png"), "image");
 * ```
 *
 * Note: If you are working with file URLs,
 * use the new version of `basename` from `@std/path/posix/unstable-basename`.
 *
 * @param path The path to extract the name from.
 * @param suffix The suffix to remove from extracted name.
 * @returns The extracted name.
 */
function basename(path, suffix = "") {
    (0, basename_js_1.assertArgs)(path, suffix);
    const lastSegment = (0, basename_js_1.lastPathSegment)(path, _util_js_1.isPosixPathSeparator);
    const strippedSegment = (0, strip_trailing_separators_js_1.stripTrailingSeparators)(lastSegment, _util_js_1.isPosixPathSeparator);
    return suffix ? (0, basename_js_1.stripSuffix)(strippedSegment, suffix) : strippedSegment;
}
