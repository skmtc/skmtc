import type { GenerateContext, RegisterArgs } from '../../context/GenerateContext.js';
import type { GeneratedValue } from '../../types/GeneratedValue.js';
import type { GeneratorKey } from '../../types/GeneratorKeys.js';
import type { RefName } from '../../types/RefName.js';
import type { ContentSettings } from '../ContentSettings.js';
import type { ModelInsertable } from './ModelInsertable.js';
import { ValueBase } from '../ValueBase.js';
import type { Inserted } from '../Inserted.js';
export type ModelBaseArgs = {
    context: GenerateContext;
    settings: ContentSettings;
    generatorKey: GeneratorKey;
    refName: RefName;
};
export declare class ModelBase extends ValueBase {
    settings: ContentSettings;
    refName: RefName;
    generatorKey: GeneratorKey;
    constructor({ context, settings, generatorKey, refName }: ModelBaseArgs);
    insertModel<V extends GeneratedValue>(insertable: ModelInsertable<V>, refName: RefName): Inserted<V, 'force'>;
    register(args: Omit<RegisterArgs, 'destinationPath'>): void;
}
//# sourceMappingURL=ModelBase.d.ts.map