"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = getLogger;
const logger_js_1 = require("./logger.js");
const _state_js_1 = require("./_state.js");
/** Get a logger instance. If not specified `name`, get the default logger. */
function getLogger(name) {
    if (!name) {
        const d = _state_js_1.state.loggers.get("default");
        if (d === undefined) {
            throw new Error(`"default" logger must be set for getting logger without name`);
        }
        return d;
    }
    const result = _state_js_1.state.loggers.get(name);
    if (!result) {
        const logger = new logger_js_1.Logger(name, "NOTSET", { handlers: [] });
        _state_js_1.state.loggers.set(name, logger);
        return logger;
    }
    return result;
}
