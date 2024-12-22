import "../_dnt.polyfills.js";
import { join } from '../deps/jsr.io/@std/path/1.0.6/mod.js';
export const toResolvedArtifactPath = ({ basePath, destinationPath }) => {
    return join(basePath ?? 'dist', destinationPath.replace(/^@\//, ''));
};
