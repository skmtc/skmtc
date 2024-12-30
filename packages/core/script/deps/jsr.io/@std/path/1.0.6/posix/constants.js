"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEPARATOR_PATTERN = exports.SEPARATOR = exports.DELIMITER = void 0;
/**
 * The character used to separate entries in the PATH environment variable.
 */
exports.DELIMITER = ":";
/**
 * The character used to separate components of a file path.
 */
exports.SEPARATOR = "/";
/**
 * A regular expression that matches one or more path separators.
 */
exports.SEPARATOR_PATTERN = /\/+/;
