"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportName = exports.Import = void 0;
class Import {
    constructor({ module, importNames }) {
        Object.defineProperty(this, "module", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "importNames", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.module = module;
        this.importNames = importNames.map(importName => new ImportName(importName));
    }
    toRecord() {
        return {
            [this.module]: this.importNames.map(({ name, alias }) => alias ? { [name]: alias } : name)
        };
    }
    toString() {
        // @TODO move syntax to typescript package to enable
        // language agnostic use
        return `import { ${this.importNames.join(', ')} } from '${this.module}'`;
    }
}
exports.Import = Import;
class ImportName {
    constructor(name) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "alias", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (typeof name === 'string') {
            this.name = name;
        }
        else {
            const [n, alias] = Object.entries(name)[0];
            this.name = n;
            this.alias = alias;
        }
    }
    toString() {
        return this.alias ? `${this.name} as ${this.alias}` : this.name;
    }
}
exports.ImportName = ImportName;
