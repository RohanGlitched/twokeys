// Short-lived key–value storage for the relay, the lab's session book, the counsellor queue and
// family notes. In production this is DynamoDB with TTL; in development (or when no table is
// configured) it falls back to process memory.
import 'server-only';

export interface Store {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  /** Write only if the key doesn't exist yet. Returns false if it did. */
  putNew<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Items whose key starts with `prefix` (small collections only: queues, notes). */
  list<T>(prefix: string): Promise<{ key: string; value: T }[]>;
}

class MemoryStore implements Store {
  private m = new Map<string, { v: string; exp: number }>();
  private live(key: string) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) { this.m.delete(key); return null; }
    return e;
  }
  async get<T>(key: string) { const e = this.live(key); return e ? (JSON.parse(e.v) as T) : null; }
  async put<T>(key: string, value: T, ttl: number) { this.m.set(key, { v: JSON.stringify(value), exp: Date.now() + ttl * 1000 }); }
  async putNew<T>(key: string, value: T, ttl: number) {
    if (this.live(key)) return false;
    await this.put(key, value, ttl);
    return true;
  }
  async del(key: string) { this.m.delete(key); }
  async list<T>(prefix: string) {
    const out: { key: string; value: T }[] = [];
    for (const k of this.m.keys()) {
      if (!k.startsWith(prefix)) continue;
      const e = this.live(k);
      if (e) out.push({ key: k, value: JSON.parse(e.v) as T });
    }
    return out;
  }
}

const g = globalThis as unknown as { __twokeysStore?: Store };

export function store(): Store {
  if (!g.__twokeysStore) {
    // The DynamoDB adapter is wired in once the table exists; until then memory keeps dev and tests working.
    g.__twokeysStore = new MemoryStore();
  }
  return g.__twokeysStore;
}
