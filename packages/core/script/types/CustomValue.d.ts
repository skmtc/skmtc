import type { GenerateContext } from '../context/GenerateContext.js';
import { ValueBase } from '../dsl/ValueBase.js';
import type { Stringable } from '../dsl/Stringable.js';
import type { GeneratorKey } from './GeneratorKeys.js';
import type { OasRef } from '../oas/ref/Ref.js';
type CreateArgs = {
    context: GenerateContext;
    value: Stringable;
    generatorKey?: GeneratorKey;
};
export declare class CustomValue extends ValueBase {
    type: "custom";
    value: Stringable;
    constructor({ context, value, generatorKey }: CreateArgs);
    isRef(): this is OasRef<'schema'>;
    resolve(): CustomValue;
    resolveOnce(): CustomValue;
    toString(): string;
}
export declare const isCustomValue: (value: unknown) => value is CustomValue;
export {};
//# sourceMappingURL=CustomValue.d.ts.map