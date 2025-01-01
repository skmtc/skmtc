export class OasResponse {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'response'
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "headers", {
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
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.description = fields.description;
        this.headers = fields.headers;
        this.content = fields.content;
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
            description: this.description ?? '',
            headers: Object.fromEntries(Object.entries(this.headers ?? {}).map(([header, headerObject]) => [
                header,
                headerObject.toJsonSchema(options)
            ])),
            content: Object.fromEntries(Object.entries(this.content ?? {}).map(([mediaType, mediaTypeObject]) => [
                mediaType,
                mediaTypeObject.toJsonSchema(options)
            ]))
        };
    }
}
