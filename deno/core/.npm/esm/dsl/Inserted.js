export class Inserted {
    constructor({ settings, definition }) {
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "definition", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.settings = settings;
        this.definition = definition;
    }
    toName() {
        return this.settings.identifier.name;
    }
    toIdentifier() {
        return this.settings.identifier;
    }
    toExportPath() {
        return this.settings.exportPath;
    }
    toValue() {
        return this.definition?.value;
    }
}
