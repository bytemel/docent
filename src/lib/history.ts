export const HISTORY_MAX = 50;
export const COALESCE_MS = 1000;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey?: string;
  lastAt?: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function pushHistory<T>(
  h: History<T>,
  next: T,
  opts: { key?: string; now?: number; max?: number } = {},
): History<T> {
  if (next === h.present) return h;
  const now = opts.now ?? Date.now();
  const max = opts.max ?? HISTORY_MAX;
  if (opts.key && h.lastKey === opts.key && h.lastAt !== undefined && now - h.lastAt < COALESCE_MS) {
    return { ...h, present: next, future: [], lastAt: now };
  }
  const past = [...h.past, h.present];
  while (past.length > max) past.shift();
  return { past, present: next, future: [], lastKey: opts.key, lastAt: now };
}

export function amendHistory<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { ...h, present: next };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next, future };
}
