import type { PrettierConfigType } from '../types/prettierConfig.js';
import type { AddGeneratorKeyArgs, RenderResult } from './types.js';
import type { Definition } from '../dsl/Definition.js';
import type { PickArgs } from './GenerateContext.js';
import type { ResultType } from '../types/Results.js';
import type { StackTrail } from './StackTrail.js';
import type * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js';
import type { File } from '../dsl/File.js';
import type { Preview } from '../types/Preview.js';
type ConstructorArgs = {
    files: Map<string, File>;
    previews: Record<string, Record<string, Preview>>;
    prettier?: PrettierConfigType;
    basePath: string | undefined;
    pinnableGenerators: string[];
    stackTrail: StackTrail;
    logger: log.Logger;
    captureCurrentResult: (result: ResultType) => void;
};
export declare class RenderContext {
    #private;
    files: Map<string, File>;
    previews: Record<string, Record<string, Preview>>;
    private prettier?;
    basePath: string | undefined;
    currentDestinationPath: string | 'PRE_RENDER' | 'POST_RENDER';
    pinnableGenerators: string[];
    logger: log.Logger;
    captureCurrentResult: (result: ResultType) => void;
    constructor({ files, previews, prettier, basePath, pinnableGenerators, logger, stackTrail, captureCurrentResult }: ConstructorArgs);
    render(): Omit<RenderResult, 'results'>;
    private collate;
    trace<T>(token: string | string[], fn: () => T): T;
    getFile(filePath: string): File;
    addGeneratorKey({ generatorKey }: AddGeneratorKeyArgs): void;
    pick({ name, exportPath }: PickArgs): Definition | undefined;
}
export {};
//# sourceMappingURL=RenderContext.d.ts.map