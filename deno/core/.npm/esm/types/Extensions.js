import "../_dnt.polyfills.js";
import { z } from 'zod';
export const extensions = z.record(z.union([z.string(), z.lazy(() => extensions)]));
