import "../_dnt.polyfills.js";
import { z } from 'zod';
import { type Method } from './Method.js';
export type OperationPreview = {
    type: 'operation';
    generatorId: string;
    operationPath: string;
    operationMethod: Method;
};
export type ModelPreview = {
    type: 'model';
    generatorId: string;
    refName: string;
};
export type Preview = {
    name: string;
    route?: string;
    exportPath: string;
    group: string;
    source: OperationPreview | ModelPreview;
};
export declare const operationPreview: z.ZodObject<{
    type: z.ZodLiteral<"operation">;
    generatorId: z.ZodString;
    operationPath: z.ZodString;
    operationMethod: z.ZodType<Method, z.ZodTypeDef, Method>;
}, "strip", z.ZodTypeAny, {
    type: "operation";
    generatorId: string;
    operationPath: string;
    operationMethod: Method;
}, {
    type: "operation";
    generatorId: string;
    operationPath: string;
    operationMethod: Method;
}>;
export declare const modelPreview: z.ZodObject<{
    type: z.ZodLiteral<"model">;
    generatorId: z.ZodString;
    refName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "model";
    generatorId: string;
    refName: string;
}, {
    type: "model";
    generatorId: string;
    refName: string;
}>;
export declare const preview: z.ZodObject<{
    name: z.ZodString;
    exportPath: z.ZodString;
    group: z.ZodString;
    route: z.ZodOptional<z.ZodString>;
    source: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"operation">;
        generatorId: z.ZodString;
        operationPath: z.ZodString;
        operationMethod: z.ZodType<Method, z.ZodTypeDef, Method>;
    }, "strip", z.ZodTypeAny, {
        type: "operation";
        generatorId: string;
        operationPath: string;
        operationMethod: Method;
    }, {
        type: "operation";
        generatorId: string;
        operationPath: string;
        operationMethod: Method;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"model">;
        generatorId: z.ZodString;
        refName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "model";
        generatorId: string;
        refName: string;
    }, {
        type: "model";
        generatorId: string;
        refName: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    exportPath: string;
    group: string;
    source: {
        type: "operation";
        generatorId: string;
        operationPath: string;
        operationMethod: Method;
    } | {
        type: "model";
        generatorId: string;
        refName: string;
    };
    route?: string | undefined;
}, {
    name: string;
    exportPath: string;
    group: string;
    source: {
        type: "operation";
        generatorId: string;
        operationPath: string;
        operationMethod: Method;
    } | {
        type: "model";
        generatorId: string;
        refName: string;
    };
    route?: string | undefined;
}>;
//# sourceMappingURL=Preview.d.ts.map