import "../_dnt.polyfills.js";
import type { GeneratorKey } from './GeneratorKeys.js';
import { z } from '@hono/zod-openapi';
import { type ResultsItem } from './Results.js';
import { type Preview } from './Preview.js';
export type ManifestEntry = {
    numberOfLines: number;
    numberOfCharacters: number;
    hash: string;
    generatorKeys: GeneratorKey[];
    destinationPath: string;
};
export declare const manifestEntry: z.ZodObject<{
    numberOfLines: z.ZodNumber;
    numberOfCharacters: z.ZodNumber;
    hash: z.ZodString;
    generatorKeys: z.ZodArray<z.ZodEffects<z.ZodString, GeneratorKey, string>, "many">;
    destinationPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    numberOfLines: number;
    numberOfCharacters: number;
    hash: string;
    generatorKeys: GeneratorKey[];
    destinationPath: string;
}, {
    numberOfLines: number;
    numberOfCharacters: number;
    hash: string;
    generatorKeys: string[];
    destinationPath: string;
}>;
export type PreviewItem = {
    name: string;
    exportPath: string;
};
export declare const previewItem: z.ZodObject<{
    name: z.ZodString;
    exportPath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    exportPath: string;
}, {
    name: string;
    exportPath: string;
}>;
export type ManifestContent = {
    deploymentId: string;
    traceId: string;
    spanId: string;
    region?: string;
    files: Record<string, ManifestEntry>;
    previews: Record<string, Record<string, Preview>>;
    pinnable: Partial<Record<GeneratorKey, string>>;
    results: ResultsItem;
    startAt: number;
    endAt: number;
};
export declare const manifestContent: z.ZodObject<{
    deploymentId: z.ZodString;
    traceId: z.ZodString;
    spanId: z.ZodString;
    region: z.ZodOptional<z.ZodString>;
    files: z.ZodRecord<z.ZodString, z.ZodObject<{
        numberOfLines: z.ZodNumber;
        numberOfCharacters: z.ZodNumber;
        hash: z.ZodString;
        generatorKeys: z.ZodArray<z.ZodEffects<z.ZodString, GeneratorKey, string>, "many">;
        destinationPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        numberOfLines: number;
        numberOfCharacters: number;
        hash: string;
        generatorKeys: GeneratorKey[];
        destinationPath: string;
    }, {
        numberOfLines: number;
        numberOfCharacters: number;
        hash: string;
        generatorKeys: string[];
        destinationPath: string;
    }>>;
    previews: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        name: z.ZodString;
        exportPath: z.ZodString;
        group: z.ZodString;
        route: z.ZodOptional<z.ZodString>;
        source: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"operation">;
            generatorId: z.ZodString;
            operationPath: z.ZodString;
            operationMethod: z.ZodType<import("./Method.js").Method, z.ZodTypeDef, import("./Method.js").Method>;
        }, "strip", z.ZodTypeAny, {
            type: "operation";
            generatorId: string;
            operationPath: string;
            operationMethod: import("./Method.js").Method;
        }, {
            type: "operation";
            generatorId: string;
            operationPath: string;
            operationMethod: import("./Method.js").Method;
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
            operationMethod: import("./Method.js").Method;
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
            operationMethod: import("./Method.js").Method;
        } | {
            type: "model";
            generatorId: string;
            refName: string;
        };
        route?: string | undefined;
    }>>>;
    pinnable: z.ZodRecord<z.ZodEffects<z.ZodString, GeneratorKey, string>, z.ZodString>;
    results: z.ZodType<ResultsItem, z.ZodTypeDef, ResultsItem>;
    startAt: z.ZodNumber;
    endAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    deploymentId: string;
    traceId: string;
    spanId: string;
    files: Record<string, {
        numberOfLines: number;
        numberOfCharacters: number;
        hash: string;
        generatorKeys: GeneratorKey[];
        destinationPath: string;
    }>;
    previews: Record<string, Record<string, {
        name: string;
        exportPath: string;
        group: string;
        source: {
            type: "operation";
            generatorId: string;
            operationPath: string;
            operationMethod: import("./Method.js").Method;
        } | {
            type: "model";
            generatorId: string;
            refName: string;
        };
        route?: string | undefined;
    }>>;
    pinnable: Partial<Record<GeneratorKey, string>>;
    results: ResultsItem;
    startAt: number;
    endAt: number;
    region?: string | undefined;
}, {
    deploymentId: string;
    traceId: string;
    spanId: string;
    files: Record<string, {
        numberOfLines: number;
        numberOfCharacters: number;
        hash: string;
        generatorKeys: string[];
        destinationPath: string;
    }>;
    previews: Record<string, Record<string, {
        name: string;
        exportPath: string;
        group: string;
        source: {
            type: "operation";
            generatorId: string;
            operationPath: string;
            operationMethod: import("./Method.js").Method;
        } | {
            type: "model";
            generatorId: string;
            refName: string;
        };
        route?: string | undefined;
    }>>;
    pinnable: Record<string, string>;
    results: ResultsItem;
    startAt: number;
    endAt: number;
    region?: string | undefined;
}>;
//# sourceMappingURL=Manifest.d.ts.map