import '../../public/seed-data.js';
export const SEED = globalThis.ILTIZAM_SEED;
export const DAY = 86400000;
export const findCourse = id => SEED.free.find(c => c.id === id) || SEED.paid.find(c => c.id === id);
