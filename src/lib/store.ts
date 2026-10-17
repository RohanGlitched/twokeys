// Short-lived key–value storage for the relay, the lab's session book, the counsellor queue and
// family notes. In production this is DynamoDB with TTL; in development (or when no table is
// configured) it falls back to process memory.
import 'server-only';
import { awsConfig } from './aws';

export interface Store {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  /** Write only if the key doesn't exist yet. Returns false if it did. */
  putNew<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Items whose key starts with `prefix` (small collections only: queues, notes). */
  list<T>(prefix: string): Promise<{ key: string; value: T }[]>;
  /** Atomically add 1 and return the new value (rate limits, counters). */
  incr(key: string, ttlSeconds: number): Promise<number>;
  /** Write only if the stored value is still exactly `old` (compare-and-swap). Returns false if it changed or is gone. */
  replace<T>(key: string, old: T, value: T, ttlSeconds: number): Promise<boolean>;
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
  async replace<T>(key: string, old: T, value: T, ttl: number) {
    const e = this.live(key);
    if (!e || e.v !== JSON.stringify(old)) return false;
    this.m.set(key, { v: JSON.stringify(value), exp: Date.now() + ttl * 1000 });
    return true;
  }
  async incr(key: string, ttl: number) {
    const e = this.live(key);
    const n = (e ? Number(JSON.parse(e.v)) : 0) + 1;
    this.m.set(key, { v: JSON.stringify(n), exp: e ? e.exp : Date.now() + ttl * 1000 });
    return n;
  }
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

/**
 * DynamoDB: one table, partition key `pk` (the part of the key before the first ':'), sort key
 * `sk` (the rest), item TTL in `exp`. TTL deletion is lazy, so reads also check `exp`.
 */
class DynamoStore implements Store {
  constructor(private table: string) {}
  private doc?: import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;
  private async client() {
    if (!this.doc) {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
      this.doc = DynamoDBDocumentClient.from(new DynamoDBClient(awsConfig()));
    }
    return this.doc;
  }
  private split(key: string) { const i = key.indexOf(':'); return i < 0 ? { pk: key, sk: '-' } : { pk: key.slice(0, i), sk: key.slice(i + 1) || '-' }; }
  async get<T>(key: string) {
    const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
    const r = await (await this.client()).send(new GetCommand({ TableName: this.table, Key: this.split(key), ConsistentRead: true }));
    if (!r.Item || (r.Item.exp as number) * 1000 < Date.now()) return null;
    if (r.Item.v === undefined && typeof r.Item.n === 'number') return r.Item.n as T; // a counter written by incr
    return JSON.parse(r.Item.v as string) as T;
  }
  async put<T>(key: string, value: T, ttl: number) {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    await (await this.client()).send(new PutCommand({ TableName: this.table, Item: { ...this.split(key), v: JSON.stringify(value), exp: Math.floor(Date.now() / 1000) + ttl } }));
  }
  async putNew<T>(key: string, value: T, ttl: number) {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const now = Math.floor(Date.now() / 1000);
    try {
      await (await this.client()).send(new PutCommand({
        TableName: this.table, Item: { ...this.split(key), v: JSON.stringify(value), exp: now + ttl },
        // Allow overwriting an item that has expired but not yet been swept.
        ConditionExpression: 'attribute_not_exists(pk) OR #e < :now', ExpressionAttributeNames: { '#e': 'exp' }, ExpressionAttributeValues: { ':now': now },
      }));
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }
  async replace<T>(key: string, old: T, value: T, ttl: number) {
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    try {
      await (await this.client()).send(new PutCommand({
        TableName: this.table, Item: { ...this.split(key), v: JSON.stringify(value), exp: Math.floor(Date.now() / 1000) + ttl },
        ConditionExpression: 'v = :old', ExpressionAttributeValues: { ':old': JSON.stringify(old) },
      }));
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return false;
      throw e;
    }
  }
  async del(key: string) {
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    await (await this.client()).send(new DeleteCommand({ TableName: this.table, Key: this.split(key) }));
  }
  async incr(key: string, ttl: number) {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const r = await (await this.client()).send(new UpdateCommand({
      TableName: this.table, Key: this.split(key),
      UpdateExpression: 'ADD #n :one SET #e = if_not_exists(#e, :exp)',
      ExpressionAttributeNames: { '#n': 'n', '#e': 'exp' },
      ExpressionAttributeValues: { ':one': 1, ':exp': Math.floor(Date.now() / 1000) + ttl },
      ReturnValues: 'UPDATED_NEW',
    }));
    return Number(r.Attributes?.n ?? 1);
  }
  async list<T>(prefix: string) {
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const { pk, sk } = this.split(prefix);
    const out: { key: string; value: T }[] = [];
    let start: Record<string, unknown> | undefined;
    const now = Math.floor(Date.now() / 1000);
    do {
      const r = await (await this.client()).send(new QueryCommand({
        TableName: this.table, ExclusiveStartKey: start,
        KeyConditionExpression: sk === '-' ? 'pk = :pk' : 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: sk === '-' ? { ':pk': pk } : { ':pk': pk, ':sk': sk },
      }));
      for (const it of r.Items ?? []) if ((it.exp as number) >= now) out.push({ key: `${it.pk}:${it.sk}`, value: JSON.parse(it.v as string) as T });
      start = r.LastEvaluatedKey;
    } while (start && out.length < 2000);
    return out;
  }
}

const g = globalThis as unknown as { __twokeysStore?: Store };

/** DynamoDB when STORE_TABLE is set (production); process memory otherwise (development, tests). */
export function store(): Store {
  if (!g.__twokeysStore) g.__twokeysStore = process.env.STORE_TABLE ? new DynamoStore(process.env.STORE_TABLE) : new MemoryStore();
  return g.__twokeysStore;
}
