import "../_dnt.polyfills.js";
import type { OasOperation } from '../oas/operation/Operation.js';
import type { Brand } from './Brand.js';
import type { RefName } from './RefName.js';
import { type Method } from './Method.js';
export type NakedOperationGeneratorKey = `${string}|${string}|${Method}`;
export type NakedModelGeneratorKey = `${string}|${string}`;
export type OperationGeneratorKey = Brand<NakedOperationGeneratorKey, 'OperationGeneratorKey'>;
export type ModelGeneratorKey = Brand<NakedModelGeneratorKey, 'ModelGeneratorKey'>;
export type GeneratorOnlyKey = Brand<string, 'GeneratorOnlyKey'>;
export type GeneratorKey = OperationGeneratorKey | ModelGeneratorKey | GeneratorOnlyKey;
type ToOperationGeneratorKeyArgs = {
    generatorId: string;
    path: string;
    method: Method;
} | {
    generatorId: string;
    operation: OasOperation;
};
export declare const toOperationGeneratorKey: ({ generatorId, ...rest }: ToOperationGeneratorKeyArgs) => OperationGeneratorKey;
type ToModelGeneratorKeyArgs = {
    generatorId: string;
    refName: RefName;
};
export declare const toModelGeneratorKey: ({ generatorId, refName }: ToModelGeneratorKeyArgs) => ModelGeneratorKey;
type ToGeneratorOnlyKeyArgs = {
    generatorId: string;
};
export declare const toGeneratorOnlyKey: ({ generatorId }: ToGeneratorOnlyKeyArgs) => GeneratorOnlyKey;
export declare const isGeneratorKey: (arg: unknown) => arg is GeneratorKey;
export declare const isOperationGeneratorKey: (arg: unknown) => arg is OperationGeneratorKey;
export declare const isModelGeneratorKey: (arg: unknown) => arg is ModelGeneratorKey;
export declare const isGeneratorOnlyKey: (arg: unknown) => arg is GeneratorOnlyKey;
export declare const toGeneratorId: (generatorKey: GeneratorKey) => string;
export type GeneratorKeyObject = {
    type: 'operation';
    generatorId: string;
    path: string;
    method: Method;
} | {
    type: 'model';
    generatorId: string;
    refName: string;
} | {
    type: 'generator-only';
    generatorId: string;
};
export declare const fromGeneratorKey: (generatorKey: GeneratorKey) => GeneratorKeyObject;
export {};
//# sourceMappingURL=GeneratorKeys.d.ts.map