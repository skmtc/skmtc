"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _RotatingFileHandler_maxBytes, _RotatingFileHandler_maxBackupCount, _RotatingFileHandler_currentFileSize;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RotatingFileHandler = void 0;
// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
const dntShim = __importStar(require("../../../../../_dnt.shims.js"));
const exists_js_1 = require("../../fs/1.0.4/exists.js");
const file_handler_js_1 = require("./file_handler.js");
const _file_handler_symbols_js_1 = require("./_file_handler_symbols.js");
/**
 * This handler extends the functionality of the {@linkcode FileHandler} by
 * "rotating" the log file when it reaches a certain size. `maxBytes` specifies
 * the maximum size in bytes that the log file can grow to before rolling over
 * to a new one. If the size of the new log message plus the current log file
 * size exceeds `maxBytes` then a roll-over is triggered. When a roll-over
 * occurs, before the log message is written, the log file is renamed and
 * appended with `.1`. If a `.1` version already existed, it would have been
 * renamed `.2` first and so on. The maximum number of log files to keep is
 * specified by `maxBackupCount`. After the renames are complete the log message
 * is written to the original, now blank, file.
 *
 * Example: Given `log.txt`, `log.txt.1`, `log.txt.2` and `log.txt.3`, a
 * `maxBackupCount` of 3 and a new log message which would cause `log.txt` to
 * exceed `maxBytes`, then `log.txt.2` would be renamed to `log.txt.3` (thereby
 * discarding the original contents of `log.txt.3` since 3 is the maximum number
 * of backups to keep), `log.txt.1` would be renamed to `log.txt.2`, `log.txt`
 * would be renamed to `log.txt.1` and finally `log.txt` would be created from
 * scratch where the new log message would be written.
 *
 * This handler uses a buffer for writing log messages to file. Logs can be
 * manually flushed with `fileHandler.flush()`. Log messages with a log level
 * greater than ERROR are immediately flushed. Logs are also flushed on process
 * completion.
 *
 * Additional notes on `mode` as described above:
 *
 * - `'a'` Default mode. As above, this will pick up where the logs left off in
 *   rotation, or create a new log file if it doesn't exist.
 * - `'w'` in addition to starting with a clean `filename`, this mode will also
 *   cause any existing backups (up to `maxBackupCount`) to be deleted on setup
 *   giving a fully clean slate.
 * - `'x'` requires that neither `filename`, nor any backups (up to
 *   `maxBackupCount`), exist before setup.
 *
 * This handler requires both `--allow-read` and `--allow-write` permissions on
 * the log files.
 */
class RotatingFileHandler extends file_handler_js_1.FileHandler {
    constructor(levelName, options) {
        super(levelName, options);
        _RotatingFileHandler_maxBytes.set(this, void 0);
        _RotatingFileHandler_maxBackupCount.set(this, void 0);
        _RotatingFileHandler_currentFileSize.set(this, 0);
        __classPrivateFieldSet(this, _RotatingFileHandler_maxBytes, options.maxBytes, "f");
        __classPrivateFieldSet(this, _RotatingFileHandler_maxBackupCount, options.maxBackupCount, "f");
    }
    setup() {
        if (__classPrivateFieldGet(this, _RotatingFileHandler_maxBytes, "f") < 1) {
            this.destroy();
            throw new Error(`"maxBytes" must be >= 1: received ${__classPrivateFieldGet(this, _RotatingFileHandler_maxBytes, "f")}`);
        }
        if (__classPrivateFieldGet(this, _RotatingFileHandler_maxBackupCount, "f") < 1) {
            this.destroy();
            throw new Error(`"maxBackupCount" must be >= 1: received ${__classPrivateFieldGet(this, _RotatingFileHandler_maxBackupCount, "f")}`);
        }
        super.setup();
        if (this[_file_handler_symbols_js_1.modeSymbol] === "w") {
            // Remove old backups too as it doesn't make sense to start with a clean
            // log file, but old backups
            for (let i = 1; i <= __classPrivateFieldGet(this, _RotatingFileHandler_maxBackupCount, "f"); i++) {
                try {
                    dntShim.Deno.removeSync(this[_file_handler_symbols_js_1.filenameSymbol] + "." + i);
                }
                catch (error) {
                    if (!(error instanceof dntShim.Deno.errors.NotFound)) {
                        throw error;
                    }
                }
            }
        }
        else if (this[_file_handler_symbols_js_1.modeSymbol] === "x") {
            // Throw if any backups also exist
            for (let i = 1; i <= __classPrivateFieldGet(this, _RotatingFileHandler_maxBackupCount, "f"); i++) {
                if ((0, exists_js_1.existsSync)(this[_file_handler_symbols_js_1.filenameSymbol] + "." + i)) {
                    this.destroy();
                    throw new dntShim.Deno.errors.AlreadyExists("Backup log file " + this[_file_handler_symbols_js_1.filenameSymbol] + "." + i +
                        " already exists");
                }
            }
        }
        else {
            __classPrivateFieldSet(this, _RotatingFileHandler_currentFileSize, (dntShim.Deno.statSync(this[_file_handler_symbols_js_1.filenameSymbol])).size, "f");
        }
    }
    log(msg) {
        const msgByteLength = this[_file_handler_symbols_js_1.encoderSymbol].encode(msg).byteLength + 1;
        if (__classPrivateFieldGet(this, _RotatingFileHandler_currentFileSize, "f") + msgByteLength > __classPrivateFieldGet(this, _RotatingFileHandler_maxBytes, "f")) {
            this.rotateLogFiles();
            __classPrivateFieldSet(this, _RotatingFileHandler_currentFileSize, 0, "f");
        }
        super.log(msg);
        __classPrivateFieldSet(this, _RotatingFileHandler_currentFileSize, __classPrivateFieldGet(this, _RotatingFileHandler_currentFileSize, "f") + msgByteLength, "f");
    }
    rotateLogFiles() {
        this.flush();
        this[_file_handler_symbols_js_1.fileSymbol].close();
        for (let i = __classPrivateFieldGet(this, _RotatingFileHandler_maxBackupCount, "f") - 1; i >= 0; i--) {
            const source = this[_file_handler_symbols_js_1.filenameSymbol] + (i === 0 ? "" : "." + i);
            const dest = this[_file_handler_symbols_js_1.filenameSymbol] + "." + (i + 1);
            if ((0, exists_js_1.existsSync)(source)) {
                dntShim.Deno.renameSync(source, dest);
            }
        }
        this[_file_handler_symbols_js_1.fileSymbol] = dntShim.Deno.openSync(this[_file_handler_symbols_js_1.filenameSymbol], this[_file_handler_symbols_js_1.openOptionsSymbol]);
    }
}
exports.RotatingFileHandler = RotatingFileHandler;
_RotatingFileHandler_maxBytes = new WeakMap(), _RotatingFileHandler_maxBackupCount = new WeakMap(), _RotatingFileHandler_currentFileSize = new WeakMap();
