import { ValueBase } from '../dsl/ValueBase.js';
import type { GenerateContext } from '../context/GenerateContext.js';
import type { OasOperation } from '../oas/operation/Operation.js';
import type { GeneratorKey } from '../types/GeneratorKeys.js';
type CreateArgs = {
    context: GenerateContext;
    generatorKey: GeneratorKey;
    operation: OasOperation;
    destinationPath: string;
};
export declare class ReactRouterPathParams extends ValueBase {
    getParams: string;
    assertParams: string;
    passProps: string;
    names: string[];
    constructor({ context, operation, generatorKey, destinationPath }: CreateArgs);
    toString(): string;
}
export {};
//# sourceMappingURL=ReactRouterPathParams.d.ts.map