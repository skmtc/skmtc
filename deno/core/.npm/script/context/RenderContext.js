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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _RenderContext_stackTrail;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderContext = void 0;
const Sentry = __importStar(require("@sentry/deno"));
const tiny_invariant_1 = __importDefault(require("tiny-invariant"));
const mod_js_1 = require("../deps/jsr.io/@std/path/1.0.6/mod.js");
const toResolvedArtifactPath_js_1 = require("../helpers/toResolvedArtifactPath.js");
const tracer_js_1 = require("../helpers/tracer.js");
class RenderContext {
    constructor({ files, previews, prettier, basePath, pinnableGenerators, logger, stackTrail, captureCurrentResult }) {
        Object.defineProperty(this, "files", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "previews", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "prettier", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "basePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "currentDestinationPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pinnableGenerators", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        _RenderContext_stackTrail.set(this, void 0);
        Object.defineProperty(this, "captureCurrentResult", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.currentDestinationPath = 'PRE_RENDER';
        this.files = files;
        this.previews = previews;
        this.prettier = prettier;
        this.basePath = basePath;
        this.pinnableGenerators = pinnableGenerators;
        this.logger = logger;
        __classPrivateFieldSet(this, _RenderContext_stackTrail, stackTrail, "f");
        this.captureCurrentResult = captureCurrentResult;
        console.log('PREVIEW 2', previews);
    }
    render() {
        return Sentry.startSpan({ name: 'Render artifacts' }, () => {
            const result = Sentry.startSpan({ name: 'Collate content' }, () => {
                return this.collate();
            });
            const pinnable = Sentry.startSpan({ name: 'Generate pinnable' }, () => {
                return generatePinnable({
                    pinnableGenerators: this.pinnableGenerators,
                    files: result.files
                });
            });
            const rendered = {
                artifacts: result.artifacts,
                files: result.files,
                previews: this.previews,
                pinnable
            };
            return rendered;
        });
    }
    collate() {
        const fileEntries = Array.from(this.files.entries());
        const fileObjects = fileEntries
            .map(([destinationPath, file]) => {
            return this.trace(destinationPath, () => {
                // Set the current destination path to be used by
                // addGeneratorKey method to apply generator keys
                // to Correct file
                // @TODO: Could this be combined with the tracer call above?
                this.currentDestinationPath = destinationPath;
                const renderedFile = renderFile({
                    content: file.toString(),
                    generatorKeys: Array.from(file.generatorKeys).filter(Boolean),
                    destinationPath,
                    basePath: this.basePath,
                    prettier: this.prettier
                });
                this.captureCurrentResult('success');
                return renderedFile;
            });
        })
            .filter(fileObject => fileObject !== undefined);
        this.currentDestinationPath = 'POST_RENDER';
        return fileObjects.reduce((acc, { content, path, ...fileMeta }) => ({
            ...acc,
            artifacts: {
                ...acc.artifacts,
                [path]: content
            },
            files: {
                ...acc.files,
                [path]: {
                    ...fileMeta
                }
            }
        }), {
            artifacts: {},
            files: {},
            pinnable: {}
        });
    }
    trace(token, fn) {
        return (0, tracer_js_1.tracer)(__classPrivateFieldGet(this, _RenderContext_stackTrail, "f"), token, fn);
    }
    getFile(filePath) {
        const normalisedPath = (0, mod_js_1.normalize)(filePath);
        const currentFile = this.files.get(normalisedPath);
        (0, tiny_invariant_1.default)(currentFile, `File not found during render phase: ${normalisedPath}`);
        return currentFile;
    }
    addGeneratorKey({ generatorKey }) {
        const path = this.currentDestinationPath;
        (0, tiny_invariant_1.default)(!['PRE_RENDER', 'POST_RENDER'].includes(path), `Cannot add generator key during ${path} phase`);
        const currentFile = this.getFile(path);
        currentFile.generatorKeys.add(generatorKey);
    }
    pick({ name, exportPath }) {
        return this.getFile(exportPath).definitions.get(name);
    }
}
exports.RenderContext = RenderContext;
_RenderContext_stackTrail = new WeakMap();
const renderFile = ({ content, generatorKeys, destinationPath, basePath }) => {
    return {
        content,
        path: (0, toResolvedArtifactPath_js_1.toResolvedArtifactPath)({ basePath, destinationPath }),
        destinationPath,
        numberOfLines: content.split('\n').length,
        numberOfCharacters: content.length,
        generatorKeys,
        hash: 'PLACEHOLDER'
    };
};
const generatePinnable = ({ pinnableGenerators, files }) => {
    const output = {};
    Object.values(files).forEach(entry => {
        entry.generatorKeys.forEach(generatorKey => {
            if (!output[generatorKey]) {
                output[generatorKey] = [];
            }
            output[generatorKey].push(entry.destinationPath);
        });
    });
    const pinnableEntries = Object.entries(output)
        .map(([generatorKey, files]) => {
        if (files.length !== 1) {
            return null;
        }
        const isPinnable = pinnableGenerators.reduce((acc, pinnableGenerator) => {
            if (generatorKey.startsWith(pinnableGenerator)) {
                return true;
            }
            return acc;
        }, false);
        return isPinnable ? [generatorKey, files[0]] : null;
    })
        .filter((generatorKey) => generatorKey !== null);
    return Object.fromEntries(pinnableEntries);
};
