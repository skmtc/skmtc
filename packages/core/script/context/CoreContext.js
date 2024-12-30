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
var _CoreContext_instances, _CoreContext_phase, _CoreContext_results, _CoreContext_stackTrail, _CoreContext_setupLogger, _CoreContext_setupParsePhase, _CoreContext_setupGeneratePhase, _CoreContext_setupRenderPhase;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreContext = void 0;
exports.skmtcFormatter = skmtcFormatter;
const GenerateContext_js_1 = require("./GenerateContext.js");
const RenderContext_js_1 = require("./RenderContext.js");
const ParseContext_js_1 = require("./ParseContext.js");
const log = __importStar(require("../deps/jsr.io/@std/log/0.224.8/mod.js"));
const ResultsHandler_js_1 = require("./ResultsHandler.js");
const StackTrail_js_1 = require("./StackTrail.js");
const tracer_js_1 = require("../helpers/tracer.js");
const ResultsLog_js_1 = require("../helpers/ResultsLog.js");
const Sentry = __importStar(require("@sentry/deno"));
const mod_js_1 = require("../deps/jsr.io/@std/path/1.0.6/mod.js");
class CoreContext {
    constructor({ spanId, logsPath }) {
        _CoreContext_instances.add(this);
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _CoreContext_phase.set(this, void 0);
        _CoreContext_results.set(this, void 0);
        _CoreContext_stackTrail.set(this, void 0);
        __classPrivateFieldSet(this, _CoreContext_stackTrail, new StackTrail_js_1.StackTrail([spanId]), "f");
        __classPrivateFieldSet(this, _CoreContext_results, new ResultsLog_js_1.ResultsLog(), "f");
        this.logger = __classPrivateFieldGet(this, _CoreContext_instances, "m", _CoreContext_setupLogger).call(this, { spanId, logsPath });
    }
    parse(schema) {
        __classPrivateFieldSet(this, _CoreContext_phase, __classPrivateFieldGet(this, _CoreContext_instances, "m", _CoreContext_setupParsePhase).call(this, schema), "f");
        const oasDocument = __classPrivateFieldGet(this, _CoreContext_phase, "f").context.parse();
        const extensions = __classPrivateFieldGet(this, _CoreContext_phase, "f").context.extentions;
        return {
            oasDocument,
            extensions
        };
    }
    transform({ schema, settings, toGeneratorsMap, prettier }) {
        // Temp workaround to extract generator keys during
        // 'render' by invoking a callback passed during 'generate'
        try {
            const callback = (generatorKey) => {
                if (__classPrivateFieldGet(this, _CoreContext_phase, "f")?.type === 'render') {
                    __classPrivateFieldGet(this, _CoreContext_phase, "f").context.addGeneratorKey({ generatorKey });
                }
            };
            const oasDocument = this.trace('parse', () => {
                __classPrivateFieldSet(this, _CoreContext_phase, __classPrivateFieldGet(this, _CoreContext_instances, "m", _CoreContext_setupParsePhase).call(this, schema), "f");
                return __classPrivateFieldGet(this, _CoreContext_phase, "f").context.parse();
            });
            const { files, previews } = this.trace('generate', () => {
                __classPrivateFieldSet(this, _CoreContext_phase, __classPrivateFieldGet(this, _CoreContext_instances, "m", _CoreContext_setupGeneratePhase).call(this, {
                    toGeneratorsMap,
                    oasDocument,
                    settings,
                    callback
                }), "f");
                return __classPrivateFieldGet(this, _CoreContext_phase, "f").context.generate();
            });
            this.logger.debug(`${files.size} files generated`);
            const renderOutput = this.trace('render', () => {
                __classPrivateFieldSet(this, _CoreContext_phase, __classPrivateFieldGet(this, _CoreContext_instances, "m", _CoreContext_setupRenderPhase).call(this, {
                    files,
                    previews,
                    pinnableGenerators: Object.values(toGeneratorsMap())
                        .map(({ id, pinnable }) => (pinnable ? id : null))
                        .filter(generatorId => generatorId !== null),
                    prettier,
                    basePath: settings?.basePath
                }), "f");
                return __classPrivateFieldGet(this, _CoreContext_phase, "f").context.render();
            });
            return {
                ...renderOutput,
                results: __classPrivateFieldGet(this, _CoreContext_results, "f").toTree()
            };
        }
        catch (error) {
            console.error(error);
            this.logger.error(error);
            Sentry.captureException(error);
            return {
                artifacts: {},
                files: {},
                previews: {},
                pinnable: {},
                results: __classPrivateFieldGet(this, _CoreContext_results, "f").toTree()
            };
        }
        finally {
            this.logger.handlers.forEach(handler => {
                if (handler instanceof log.FileHandler) {
                    handler.flush();
                }
            });
        }
    }
    trace(token, fn) {
        return (0, tracer_js_1.tracer)(__classPrivateFieldGet(this, _CoreContext_stackTrail, "f"), token, fn);
    }
    captureCurrentResult(result) {
        __classPrivateFieldGet(this, _CoreContext_results, "f").capture(__classPrivateFieldGet(this, _CoreContext_stackTrail, "f").toString(), result);
    }
}
exports.CoreContext = CoreContext;
_CoreContext_phase = new WeakMap(), _CoreContext_results = new WeakMap(), _CoreContext_stackTrail = new WeakMap(), _CoreContext_instances = new WeakSet(), _CoreContext_setupLogger = function _CoreContext_setupLogger({ spanId, logsPath }) {
    const filename = (0, mod_js_1.join)(logsPath ?? '', `${spanId}.txt`);
    log.setup({
        handlers: {
            [`${spanId}-logs`]: new log.ConsoleHandler('DEBUG', {
                formatter: logRecord => skmtcFormatter({
                    logRecord,
                    stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f").toString()
                }),
                useColors: false
            }),
            ...(logsPath && {
                file: new log.FileHandler('DEBUG', {
                    filename,
                    // you can change format of output message using any keys in `LogRecord`.
                    formatter: logRecord => {
                        return skmtcFormatter({
                            logRecord,
                            stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f").toString()
                        });
                    }
                })
            }),
            [`${spanId}-results`]: new ResultsHandler_js_1.ResultsHandler('WARN', {
                formatter: ({ levelName }) => levelName,
                context: this
            })
        },
        loggers: {
            [spanId]: {
                level: 'DEBUG',
                handlers: [`${spanId}-logs`, `${spanId}-results`, 'file']
            }
        }
    });
    return log.getLogger(spanId);
}, _CoreContext_setupParsePhase = function _CoreContext_setupParsePhase(schema) {
    const parseContext = new ParseContext_js_1.ParseContext({
        schema,
        logger: this.logger,
        stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f")
    });
    return { type: 'parse', context: parseContext };
}, _CoreContext_setupGeneratePhase = function _CoreContext_setupGeneratePhase({ oasDocument, settings, callback, toGeneratorsMap }) {
    const generateContext = new GenerateContext_js_1.GenerateContext({
        oasDocument,
        settings,
        logger: this.logger,
        callback,
        stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f"),
        captureCurrentResult: this.captureCurrentResult.bind(this),
        toGeneratorsMap
    });
    return { type: 'generate', context: generateContext };
}, _CoreContext_setupRenderPhase = function _CoreContext_setupRenderPhase({ files, previews, prettier, basePath, pinnableGenerators }) {
    const renderContext = new RenderContext_js_1.RenderContext({
        files,
        previews,
        prettier,
        basePath,
        pinnableGenerators,
        logger: this.logger,
        stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f"),
        captureCurrentResult: this.captureCurrentResult.bind(this)
    });
    return { type: 'render', context: renderContext };
};
function skmtcFormatter({ logRecord, stackTrail }) {
    return JSON.stringify({
        stackTrail,
        level: logRecord.levelName,
        datetime: logRecord.datetime.getTime(),
        message: logRecord.msg,
        args: flattenArgs(logRecord.args)
    });
}
function flattenArgs(args) {
    if (args.length === 1) {
        return args[0];
    }
    else if (args.length > 1) {
        return args;
    }
}
