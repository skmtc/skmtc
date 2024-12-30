export class OasPathItem {
    constructor(fields = {}) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'pathItem'
        });
        Object.defineProperty(this, "summary", {
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
        Object.defineProperty(this, "parameters", {
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
        this.summary = fields.summary;
        this.description = fields.description;
        this.parameters = fields.parameters;
        this.extensionFields = fields.extensionFields;
    }
}
