export class OasParameter {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'parameter'
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "location", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "description", {
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
        Object.defineProperty(this, "deprecated", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "allowEmptyValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "allowReserved", {
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
        Object.defineProperty(this, "content", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "style", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "explode", {
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
        this.name = fields.name;
        this.location = fields.location;
        this.style = fields.style;
        this.explode = fields.explode;
        this.description = fields.description;
        this.required = fields.required;
        this.deprecated = fields.deprecated;
        this.allowEmptyValue = fields.allowEmptyValue;
        this.allowReserved = fields.allowReserved;
        this.schema = fields.schema;
        this.examples = fields.examples;
        this.content = fields.content;
        this.style = fields.style;
        this.explode = fields.explode;
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
        if (this.schema) {
            return this.schema;
        }
        const schema = this.content?.[mediaType]?.schema;
        if (!schema) {
            throw new Error(`Schema not found for media type ${mediaType}`);
        }
        return schema;
    }
    toJsonSchema(options) {
        return {
            name: this.name,
            in: this.location,
            description: this.description,
            required: this.required,
            deprecated: this.deprecated,
            allowEmptyValue: this.allowEmptyValue,
            allowReserved: this.allowReserved,
            schema: this.schema?.toJsonSchema(options),
            examples: this.examples,
            content: Object.fromEntries(Object.entries(this.content ?? {}).map(([mediaType, mediaTypeObject]) => [
                mediaType,
                mediaTypeObject.toJsonSchema(options)
            ])),
            style: this.style,
            explode: this.explode
        };
    }
}
