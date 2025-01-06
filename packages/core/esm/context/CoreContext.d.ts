import { GenerateContext } from './GenerateContext.js';
import { RenderContext } from './RenderContext.js';
import { ParseContext } from './ParseContext.js';
import type { PrettierConfigType } from '../types/prettierConfig.js';
import type { OasDocument } from '../oas/document/Document.js';
import type { ClientSettings } from '../types/Settings.js';
import type { ResultType } from '../types/Results.js';
import * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js';
import type { GeneratorKey } from '../types/GeneratorKeys.js';
import type { GeneratorType, GeneratorsMap } from '../types/GeneratorType.js';
import { Preview } from '../types/Preview.js';
export type ParsePhase = {
    type: 'parse';
    context: ParseContext;
};
export type GeneratePhase = {
    type: 'generate';
    context: GenerateContext;
};
export type RenderPhase = {
    type: 'render';
    context: RenderContext;
};
export type ExecutionPhase = ParsePhase | GeneratePhase | RenderPhase;
type CoreContextArgs = {
    spanId: string;
    logsPath?: string;
};
type TransformArgs = {
    schema: string;
    settings: ClientSettings | undefined;
    toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<GeneratorType<EnrichmentType>, EnrichmentType>;
    prettier?: PrettierConfigType;
};
export declare class CoreContext {
    #private;
    logger: log.Logger;
    constructor({ spanId, logsPath }: CoreContextArgs);
    parse(schema: string): {
        oasDocument: OasDocument;
        extensions: Record<string, unknown>;
    };
    transform({ schema, settings, toGeneratorsMap, prettier }: TransformArgs): {
        results: import("../types/Results.js").ResultsItem;
        files: Record<string, import("../types/Manifest.js").ManifestEntry>;
        previews: Record<string, Record<string, Preview>>;
        pinnable: Partial<Record<GeneratorKey, string>>;
        artifacts: Record<string, string>;
    };
    trace<T>(token: string | string[], fn: () => T): T;
    captureCurrentResult(result: ResultType): void;
}
export type JsonFormatterArgs = {
    logRecord: log.LogRecord;
    stackTrail: string;
};
export declare function skmtcFormatter({ logRecord, stackTrail }: JsonFormatterArgs): string;
export {};
//# sourceMappingURL=CoreContext.d.ts.map