import { ValueBase } from '../ValueBase.js';
import { toGeneratorId } from '../../types/GeneratorKeys.js';
export class ModelBase extends ValueBase {
    constructor({ context, settings, generatorKey, refName }) {
        super({ context });
        Object.defineProperty(this, "settings", {
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
        Object.defineProperty(this, "generatorKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.generatorKey = generatorKey;
        this.refName = refName;
        this.settings = settings;
    }
    insertModel(insertable, refName) {
        return this.context.insertModel({
            insertable,
            refName,
            generation: 'force',
            destinationPath: this.settings.exportPath
        });
    }
    register(args) {
        const preview = Object.keys(args.preview ?? {}).length
            ? Object.fromEntries(Object.entries(args.preview ?? {}).map(([group, preview]) => {
                const previewWithSource = {
                    ...preview,
                    source: {
                        type: 'model',
                        generatorId: toGeneratorId(this.generatorKey),
                        refName: this.refName
                    }
                };
                return [group, previewWithSource];
            }))
            : undefined;
        this.context.register({
            ...args,
            preview,
            destinationPath: this.settings.exportPath
        });
    }
}
