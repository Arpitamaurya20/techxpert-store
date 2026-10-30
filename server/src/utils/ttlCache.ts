/** Tiny in-process TTL cache. One process (PM2 fork) only — no Redis. */

export type TtlCache<T> = {
  get: () => T | undefined;
  set: (value: T) => void;
  clear: () => void;
};

export function createTtlCache<T>(ttlMs: number): TtlCache<T> {
  let entry: { value: T; expiresAt: number } | null = null;
  return {
    get() {
      if (!entry) return undefined;
      if (Date.now() >= entry.expiresAt) {
        entry = null;
        return undefined;
      }
      return entry.value;
    },
    set(value: T) {
      entry = { value, expiresAt: Date.now() + ttlMs };
    },
    clear() {
      entry = null;
    },
  };
}
