import "../_dnt.polyfills.js";
import { z } from 'zod';
export const resultType = z.enum(['success', 'warning', 'error', 'notSelected', 'notSupported']);
export const resultsItem = z.record(z.lazy(() => z.union([resultsItem, resultType, z.array(resultsItem.nullable())])));
