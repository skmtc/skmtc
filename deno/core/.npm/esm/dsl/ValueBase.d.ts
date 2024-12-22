import type { GenerateContext } from '../context/GenerateContext.js';
import type { RegisterArgs } from '../context/GenerateContext.js';
import type { GeneratorKey } from '../types/GeneratorKeys.js';
type ValueBaseArgs = {
    context: GenerateContext;
    generatorKey?: GeneratorKey;
};
export declare class ValueBase {
    context: GenerateContext;
    skipped: boolean;
    generatorKey: GeneratorKey | undefined;
    constructor({ context, generatorKey }: ValueBaseArgs);
    register(args: RegisterArgs): void;
}
export {};
//# sourceMappingURL=ValueBase.d.ts.map