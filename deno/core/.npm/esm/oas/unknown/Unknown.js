/**
 * Object representing an unknown type in the OpenAPI Specification.
 *
 * JSON schema treats a definition without any type information as 'any'.
 * Since this is not useful in an API context, we use OasUnknown to
 * represent types that are not specified.
 */
export class OasUnknown {
    constructor(fields) {
        /**
         * Object is part the 'schema' set which is used
         * to define data types in an OpenAPI document.
         */
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'schema'
        });
        /**
         * Constant value 'unknown' useful for type narrowing and tagged unions.
         */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'unknown'
        });
        /**
         * A short summary of the unknown type.
         */
        Object.defineProperty(this, "title", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * A description of the unknown type.
         */
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Specification Extension fields */
        Object.defineProperty(this, "extensionFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** An example of the unknown type. */
        Object.defineProperty(this, "example", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.title = fields.title;
        this.description = fields.description;
        this.extensionFields = fields.extensionFields;
        this.example = fields.example;
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
}
