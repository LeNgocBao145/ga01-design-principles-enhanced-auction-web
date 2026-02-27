export const eq = (a, b) => a === b;
export const ne = (a, b) => a !== b;
export const gt = (a, b) => a > b;
export const gte = (a, b) => a >= b;
export const lt = (a, b) => a < b;
export const lte = (a, b) => a <= b;
export const add = (a, b) => a + b;
export const subtract = (a, b) => a - b;
export const multiply = (a, b) => a * b;
export const round = (value, decimals) =>
  Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
export const and = (...args) => args.slice(0, -1).every(Boolean);
export const or = (...args) => args.slice(0, -1).some(Boolean);
