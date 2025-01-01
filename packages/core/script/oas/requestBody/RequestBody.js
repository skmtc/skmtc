"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasRequestBody = void 0;
class OasRequestBody {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'requestBody'
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "content", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "required", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.description = fields.description;
        this.content = fields.content;
        this.required = fields.required;
        this.extensionFields = fields.extensionFields;
    }
    isRef() {
        return false;
    }
    resolve() {
        return this;
    }
    resolveOnce() {
        return this;
    }
    toSchema(mediaType = 'application/json') {
        return this.content?.[mediaType]?.schema;
    }
    toJsonSchema(options) {
        return {
            description: this.description,
            content: Object.fromEntries(Object.entries(this.content).map(([mediaType, mediaTypeObject]) => [
                mediaType,
                mediaTypeObject.toJsonSchema(options)
            ])),
            required: this.required
        };
    }
}
exports.OasRequestBody = OasRequestBody;
