"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelDriver = void 0;
const mod_js_1 = require("../../deps/jsr.io/@std/path/1.0.6/mod.js");
const Definition_js_1 = require("../Definition.js");
const GeneratorKeys_js_1 = require("../../types/GeneratorKeys.js");
class ModelDriver {
    constructor({ context, insertable, refName, generation, destinationPath }) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "insertable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "refName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "destinationPath", {
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
        this.context = context;
        this.insertable = insertable;
        this.refName = refName;
        this.destinationPath = destinationPath;
        this.settings = this.context.toModelContentSettings({ refName, insertable });
        this.definition = this.apply({ generation, destinationPath });
    }
    apply({ generation, destinationPath } = {}) {
        const { identifier, exportPath, selected } = this.settings;
        if (!selected && generation !== 'force') {
            return undefined;
        }
        const definition = this.getDefinition({ identifier, exportPath });
        if (destinationPath && (0, mod_js_1.normalize)(exportPath) !== (0, mod_js_1.normalize)(destinationPath)) {
            this.context.register({
                imports: { [exportPath]: [identifier.name] },
                destinationPath
            });
        }
        return definition;
    }
    getDefinition({ identifier, exportPath }) {
        const cachedDefinition = this.context.findDefinition({
            name: identifier.name,
            exportPath
        });
        if (this.affirmDefinition(cachedDefinition, exportPath)) {
            return cachedDefinition;
        }
        const value = new this.insertable({
            refName: this.refName,
            context: this.context,
            settings: this.settings,
            destinationPath: this.settings.exportPath
        });
        const definition = new Definition_js_1.Definition({
            context: this.context,
            value,
            identifier
        });
        this.context.register({
            definitions: [definition],
            destinationPath: exportPath
        });
        return definition;
    }
    affirmDefinition(definition, exportPath) {
        if (!definition) {
            return false;
        }
        const currentKey = (0, GeneratorKeys_js_1.toModelGeneratorKey)({
            generatorId: this.insertable.id,
            refName: this.refName
        });
        if (currentKey !== definition.generatorKey) {
            throw new Error(`Registered definition mismatch: '${definition.identifier.name}' in file '${exportPath}'. Cached key '${definition.generatorKey}' does not match new key '${currentKey}'`);
        }
        return definition.value instanceof this.insertable;
    }
}
exports.ModelDriver = ModelDriver;
