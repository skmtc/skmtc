export class OasLicense {
    constructor(fields) {
        Object.defineProperty(this, "oasType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'license'
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "url", {
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
        this.url = fields.url;
        this.extensionFields = fields.extensionFields;
    }
}
