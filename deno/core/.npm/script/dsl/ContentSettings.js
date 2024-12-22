"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentSettings = void 0;
class ContentSettings {
    constructor({ identifier, selected, exportPath }) {
        Object.defineProperty(this, "identifier", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "selected", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "exportPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.identifier = identifier;
        this.selected = selected;
        this.exportPath = exportPath;
    }
    static empty({ identifier, exportPath }) {
        return new ContentSettings({
            selected: true,
            identifier,
            exportPath
        });
    }
}
exports.ContentSettings = ContentSettings;
