var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ParseContext_instances, _ParseContext_parseSchema, _ParseContext_parseDocument;
import { setWith } from 'lodash-es';
import * as Sentry from '@sentry/deno';
import { parse as parseYaml } from '../deps/jsr.io/@std/yaml/0.215.0/mod.js';
import { toDocumentFieldsV3 } from '../oas/document/toDocumentFieldsV3.js';
import { OasDocument } from '../oas/document/Document.js';
import { tracer } from '../helpers/tracer.js';
import { Converter } from '@apiture/openapi-down-convert';
export class ParseContext {
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
        this.oasDocument = new OasDocument();
    }
    parse() {
        const documentObject = __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseSchema).call(this);
        if (documentObject.openapi.startsWith('3.1')) {
            const options = {
                verbose: false,
                deleteExampleWithId: false,
                allOfTransform: true
            };
            const converter = new Converter(documentObject, options);
            const oas30Document = converter.convert();
            return __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseDocument).call(this, oas30Document);
        }
        return __classPrivateFieldGet(this, _ParseContext_instances, "m", _ParseContext_parseDocument).call(this, documentObject);
    }
    trace(token, fn) {
        return tracer(this.stackTrail, token, fn);
    }
    registerExtension({ extensionFields, stackTrail, type }) {
        setWith(this.extentions, stackTrail.concat('__x__'), { type, extensionFields }, Object);
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
_ParseContext_instances = new WeakSet(), _ParseContext_parseSchema = function _ParseContext_parseSchema() {
    const documentObject = Sentry.startSpan({ name: 'Parse string schema to object' }, () => parseSchema(this.schema));
    return documentObject;
}, _ParseContext_parseDocument = function _ParseContext_parseDocument(documentObject) {
    if (!documentObject.openapi.startsWith('3.0.')) {
        throw new Error('Only OpenAPI v3 is supported');
    }
    this.oasDocument.fields = toDocumentFieldsV3({
        documentObject,
        context: this
    });
    return this.oasDocument;
};
export const parseSchema = (schema) => {
    if (schema.trimStart().startsWith('{')) {
        return JSON.parse(schema);
    }
    else {
        return parseYaml(schema);
    }
};
