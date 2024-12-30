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
import { GenerateContext } from './GenerateContext.js';
import { RenderContext } from './RenderContext.js';
import { ParseContext } from './ParseContext.js';
import * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js';
import { ResultsHandler } from './ResultsHandler.js';
import { StackTrail } from './StackTrail.js';
import { tracer } from '../helpers/tracer.js';
import { ResultsLog } from '../helpers/ResultsLog.js';
import * as Sentry from '@sentry/deno';
import { join } from '../deps/jsr.io/@std/path/1.0.6/mod.js';
export class CoreContext {
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
        __classPrivateFieldSet(this, _CoreContext_stackTrail, new StackTrail([spanId]), "f");
        __classPrivateFieldSet(this, _CoreContext_results, new ResultsLog(), "f");
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
        return tracer(__classPrivateFieldGet(this, _CoreContext_stackTrail, "f"), token, fn);
    }
    captureCurrentResult(result) {
        __classPrivateFieldGet(this, _CoreContext_results, "f").capture(__classPrivateFieldGet(this, _CoreContext_stackTrail, "f").toString(), result);
    }
}
_CoreContext_phase = new WeakMap(), _CoreContext_results = new WeakMap(), _CoreContext_stackTrail = new WeakMap(), _CoreContext_instances = new WeakSet(), _CoreContext_setupLogger = function _CoreContext_setupLogger({ spanId, logsPath }) {
    const filename = join(logsPath ?? '', `${spanId}.txt`);
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
            [`${spanId}-results`]: new ResultsHandler('WARN', {
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
    const parseContext = new ParseContext({
        schema,
        logger: this.logger,
        stackTrail: __classPrivateFieldGet(this, _CoreContext_stackTrail, "f")
    });
    return { type: 'parse', context: parseContext };
}, _CoreContext_setupGeneratePhase = function _CoreContext_setupGeneratePhase({ oasDocument, settings, callback, toGeneratorsMap }) {
    const generateContext = new GenerateContext({
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
    const renderContext = new RenderContext({
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
export function skmtcFormatter({ logRecord, stackTrail }) {
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
