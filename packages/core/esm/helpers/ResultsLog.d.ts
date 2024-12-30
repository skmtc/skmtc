import type { ResultsItem, ResultType } from '../types/Results.js';
export declare class ResultsLog {
    #private;
    constructor();
    capture(stackTrail: string, result: ResultType): void;
    toTree(): ResultsItem;
}
//# sourceMappingURL=ResultsLog.d.ts.map