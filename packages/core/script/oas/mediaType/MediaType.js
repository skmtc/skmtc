"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OasMediaType = void 0;
class OasMediaType {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'mediaType'
        });
        Object.defineProperty(this, "mediaType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "examples", {
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
        this.mediaType = fields.mediaType;
        this.schema = fields.schema;
        this.examples = fields.examples;
        this.extensionFields = fields.extensionFields;
    }
    toJsonSchema(options) {
        return {
            schema: this.schema?.toJsonSchema(options),
            examples: this.examples
        };
    }
}
exports.OasMediaType = OasMediaType;
