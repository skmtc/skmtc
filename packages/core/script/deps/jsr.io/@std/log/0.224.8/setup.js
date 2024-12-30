"use strict";
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setup = setup;
const _config_js_1 = require("./_config.js");
const logger_js_1 = require("./logger.js");
const _state_js_1 = require("./_state.js");
/** Setup logger config. */
function setup(config) {
    _state_js_1.state.config = {
        handlers: { ..._config_js_1.DEFAULT_CONFIG.handlers, ...config.handlers },
        loggers: { ..._config_js_1.DEFAULT_CONFIG.loggers, ...config.loggers },
    };
    // tear down existing handlers
    _state_js_1.state.handlers.forEach((handler) => {
        handler.destroy();
    });
    _state_js_1.state.handlers.clear();
    // setup handlers
    const handlers = _state_js_1.state.config.handlers ?? {};
    for (const [handlerName, handler] of Object.entries(handlers)) {
        handler.setup();
        _state_js_1.state.handlers.set(handlerName, handler);
    }
    // remove existing loggers
    _state_js_1.state.loggers.clear();
    // setup loggers
    const loggers = _state_js_1.state.config.loggers ?? {};
    for (const [loggerName, loggerConfig] of Object.entries(loggers)) {
        const handlerNames = loggerConfig.handlers ?? [];
        const handlers = [];
        handlerNames.forEach((handlerName) => {
            const handler = _state_js_1.state.handlers.get(handlerName);
            if (handler) {
                handlers.push(handler);
            }
        });
        const levelName = loggerConfig.level ?? _config_js_1.DEFAULT_LEVEL;
        const logger = new logger_js_1.Logger(loggerName, levelName, { handlers: handlers });
        _state_js_1.state.loggers.set(loggerName, logger);
    }
}
setup(_config_js_1.DEFAULT_CONFIG);
