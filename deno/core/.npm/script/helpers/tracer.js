"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracer = void 0;
const tracer = (stackTrail, token, fn) => {
    stackTrail.append(token);
    const result = fn();
    stackTrail.remove(token);
    return result;
};
exports.tracer = tracer;
