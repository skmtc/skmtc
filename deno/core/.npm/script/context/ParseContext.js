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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ParseContext_instances, _ParseContext_parseSchema, _ParseContext_parseDocument;
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchema = exports.ParseContext = void 0;
const lodash_es_1 = require("lodash-es");
const Sentry = __importStar(require("@sentry/deno"));
const mod_js_1 = require("../deps/jsr.io/@std/yaml/0.215.0/mod.js");
const toDocumentFieldsV3_js_1 = require("../oas/document/toDocumentFieldsV3.js");
const Document_js_1 = require("../oas/document/Document.js");
const tracer_js_1 = require("../helpers/tracer.js");
const openapi_down_convert_1 = require("@apiture/openapi-down-convert");
class ParseContext {
    constructor({ schema, logger, stackTrail }) {
        _ParseContext_instances.add(this);
        Object.defineProperty(this, "schema", {
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
        Object.defineProperty(this, "oasDocument", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "stackTrail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "extentions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.schema = schema;
        this.logger = logger;
        this.stackTrail = stackTrail;
        this.extentions = {};
        this.oasDocument = new Document_js_1.OasDocument();
    }
    parse() {
        const documentObject = __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseSchema).call(this);
        if (documentObject.openapi.startsWith('3.1')) {
            const options = {
                verbose: false,
                deleteExampleWithId: false,
                allOfTransform: true
            };
            const converter = new openapi_down_convert_1.Converter(documentObject, options);
            const oas30Document = converter.convert();
            return __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseDocument).call(this, oas30Document);
        }
        return __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseDocument).call(this, documentObject);
    }
    trace(token, fn) {
        return (0, tracer_js_1.tracer)(this.stackTrail, token, fn);
    }
    registerExtension({ extensionFields, stackTrail, type }) {
        (0, lodash_es_1.setWith)(this.extentions, stackTrail.concat('__x__'), { type, extensionFields }, Object);
    }
    logSkippedFields(skipped) {
        Object.entries(skipped).forEach(([key, value]) => {
            this.trace(key, () => {
                const str = JSON.stringify(value);
                const reduced = str.length > 30 ? `${str.slice(0, 30)}...` : str;
                this.logger.warn(`Property not yet implemented. value: ${reduced}`);
            });
        });
    }
}
exports.ParseContext = ParseContext;
_ParseContext_instances = new WeakSet(), _ParseContext_parseSchema = function _ParseContext_parseSchema() {
    const documentObject = Sentry.startSpan({ name: 'Parse string schema to object' }, () => (0, exports.parseSchema)(this.schema));
    return documentObject;
}, _ParseContext_parseDocument = function _ParseContext_parseDocument(documentObject) {
    if (!documentObject.openapi.startsWith('3.0.')) {
        throw new Error('Only OpenAPI v3 is supported');
    }
    this.oasDocument.fields = (0, toDocumentFieldsV3_js_1.toDocumentFieldsV3)({
        documentObject,
        context: this
    });
    return this.oasDocument;
};
const parseSchema = (schema) => {
    if (schema.trimStart().startsWith('{')) {
        return JSON.parse(schema);
    }
    else {
        return (0, mod_js_1.parse)(schema);
    }
};
exports.parseSchema = parseSchema;
