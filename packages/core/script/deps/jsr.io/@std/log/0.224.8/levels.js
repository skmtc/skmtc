"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevelNames = exports.LogLevels = void 0;
exports.getLevelByName = getLevelByName;
exports.getLevelName = getLevelName;
/**
 * Use this to retrieve the numeric log level by it's associated name.
 * Defaults to INFO.
 */
exports.LogLevels = {
    NOTSET: 0,
    DEBUG: 10,
    INFO: 20,
    WARN: 30,
    ERROR: 40,
    CRITICAL: 50,
};
/** Permitted log level names */
exports.LogLevelNames = Object.keys(exports.LogLevels).filter((key) => isNaN(Number(key)));
const byLevel = {
    [exports.LogLevels.NOTSET]: "NOTSET",
    [exports.LogLevels.DEBUG]: "DEBUG",
    [exports.LogLevels.INFO]: "INFO",
    [exports.LogLevels.WARN]: "WARN",
    [exports.LogLevels.ERROR]: "ERROR",
    [exports.LogLevels.CRITICAL]: "CRITICAL",
};
/**
 * Returns the numeric log level associated with the passed,
 * stringy log level name.
 */
function getLevelByName(name) {
    const level = exports.LogLevels[name];
    if (level !== undefined) {
        return level;
    }
    throw new Error(`Cannot get log level: no level named ${name}`);
}
/** Returns the stringy log level name provided the numeric log level. */
function getLevelName(level) {
    const levelName = byLevel[level];
    if (levelName) {
        return levelName;
    }
    throw new Error(`Cannot get log level: no name for level: ${level}`);
}
