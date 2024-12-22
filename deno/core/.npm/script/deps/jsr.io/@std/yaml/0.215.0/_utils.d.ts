export type Any = any;
export declare function isNothing(subject: unknown): subject is never;
export declare function isArray(value: unknown): value is Any[];
export declare function isBoolean(value: unknown): value is boolean;
export declare function isNull(value: unknown): value is null;
export declare function isNumber(value: unknown): value is number;
export declare function isString(value: unknown): value is string;
export declare function isSymbol(value: unknown): value is symbol;
export declare function isUndefined(value: unknown): value is undefined;
export declare function isObject(value: unknown): value is Record<string, unknown>;
export declare function isError(e: unknown): boolean;
export declare function isFunction(value: unknown): value is () => void;
export declare function isRegExp(value: unknown): value is RegExp;
export declare function toArray<T>(sequence: T): T | [] | [T];
export declare function repeat(str: string, count: number): string;
export declare function isNegativeZero(i: number): boolean;
export interface ArrayObject<T = Any> {
    [P: string]: T;
}
//# sourceMappingURL=_utils.d.ts.map