import { type LevelName } from '../deps/jsr.io/@std/log/0.224.8/levels.js';
import type { LogRecord } from '../deps/jsr.io/@std/log/0.224.8/logger.js';
import { BaseHandler } from '../deps/jsr.io/@std/log/0.224.8/base_handler.js';
import type { BaseHandlerOptions } from '../deps/jsr.io/@std/log/0.224.8/base_handler.js';
import type { CoreContext } from './CoreContext.js';
export interface ResultsHandlerOptions extends BaseHandlerOptions {
    context: CoreContext;
}
export declare class ResultsHandler extends BaseHandler {
    #private;
    context: CoreContext;
    constructor(levelName: LevelName, options: ResultsHandlerOptions);
    setup(): void;
    handle(logRecord: LogRecord): void;
    log(levelName: string): void;
    flush(): void;
    destroy(): void;
}
//# sourceMappingURL=ResultsHandler.d.ts.map