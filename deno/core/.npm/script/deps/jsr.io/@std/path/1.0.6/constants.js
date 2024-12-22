"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEPARATOR_PATTERN = exports.SEPARATOR = exports.DELIMITER = void 0;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
const _os_js_1 = require("./_os.js");
/**
 * The character used to separate entries in the PATH environment variable.
 * On Windows, this is `;`. On all other platforms, this is `:`.
 */
exports.DELIMITER = _os_js_1.isWindows ? ";" : ":";
/**
 * The character used to separate components of a file path.
 * On Windows, this is `\`. On all other platforms, this is `/`.
 */
exports.SEPARATOR = _os_js_1.isWindows ? "\\" : "/";
/**
 * A regular expression that matches one or more path separators.
 */
exports.SEPARATOR_PATTERN = _os_js_1.isWindows ? /[\\/]+/ : /\/+/;
