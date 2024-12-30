export const tracer = (stackTrail, token, fn) => {
    stackTrail.append(token);
    const result = fn();
    stackTrail.remove(token);
    return result;
};
