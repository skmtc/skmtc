import { normalize } from '../deps/jsr.io/@std/path/1.0.6/mod.js';
export const isImported = (pathOne, pathTwo) => {
    return normalize(pathOne) !== normalize(pathTwo);
};
