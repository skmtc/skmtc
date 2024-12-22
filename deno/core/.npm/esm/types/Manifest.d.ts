import "../_dnt.polyfills.js";
import type { GeneratorKey } from './GeneratorKeys.js';
import { z } from 'zod';
import { type ResultsItem } from './Results.js';
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
    previews: Record<string, Record<string, string>>;
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
    previews: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>>;
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
    previews: Record<string, Record<string, string>>;
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
    previews: Record<string, Record<string, string>>;
    pinnable: Record<string, string>;
    results: ResultsItem;
    startAt: number;
    endAt: number;
    region?: string | undefined;
}>;
//# sourceMappingURL=Manifest.d.ts.map