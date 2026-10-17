// Runs a pairing between two phones. One secret, shared in the link's #fragment (which browsers
// never send to a server), gives both phones:
//   - the session id the lab binds tokens to,
//   - an AES-GCM key, so the relay stores only ciphertext,
//   - three words both people read aloud, so a swapped link would be noticed.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { Initiator, Responder, type Mode, type Msg1, type Msg2, type Msg3, type Outcome, type Token } from './psi';

const enc = new TextEncoder();
const dec = new TextDecoder();

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export interface Link { box: string; secret: Uint8Array }

export function newLink(): Link {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  const s = new Uint8Array(32); crypto.getRandomValues(s);
  return { box: hex(b), secret: s };
}
export const linkFragment = (l: Link) => `${l.box}.${b64u(l.secret)}`;
export function parseFragment(f: string): Link | null {
  const m = /^#?([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(f.trim());
  if (!m) return null;
  const secret = unb64u(m[2]);
  return secret.length === 32 ? { box: m[1], secret } : null;
}

const derive = (l: Link, info: string, len = 32) => hkdf(sha256, l.secret, enc.encode(l.box), enc.encode(`twokeys/v1/${info}`), len);
export const sessionId = (l: Link) => hex(derive(l, 'session'));

const WORDS = {
  en: ['palm', 'falcon', 'pearl', 'dune', 'oasis', 'camel', 'harbour', 'lantern', 'saffron', 'cedar', 'compass', 'coral', 'dhow', 'ember', 'fig', 'gazelle',
    'henna', 'incense', 'jasmine', 'kettle', 'lemon', 'mangrove', 'nightjar', 'orchard', 'pepper', 'quill', 'reed', 'sail', 'tide', 'umbrella', 'violet', 'well'],
  ar: ['نخلة', 'صقر', 'لؤلؤة', 'كثيب', 'واحة', 'جمل', 'مرفأ', 'فانوس', 'زعفران', 'أرز', 'بوصلة', 'مرجان', 'سفينة', 'جمرة', 'تين', 'غزال',
    'حناء', 'بخور', 'ياسمين', 'دلّة', 'ليمون', 'قرم', 'سبد', 'بستان', 'فلفل', 'ريشة', 'قصب', 'شراع', 'مدّ', 'مظلة', 'بنفسج', 'بئر'],
};
/** Three words both screens show; if they differ, someone swapped the link. */
export function checkWords(l: Link, lang: 'en' | 'ar'): string[] {
  const d = derive(l, 'words', 3);
  return Array.from(d, (x) => WORDS[lang][x % 32]);
}

async function aesKey(l: Link) {
  const raw = derive(l, 'relay');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(l: Link, slot: string, obj: unknown): Promise<string> {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(slot) }, await aesKey(l), enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64u(out);
}
async function open<T>(l: Link, slot: string, c: string): Promise<T> {
  const raw = unb64u(c);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: enc.encode(slot) }, await aesKey(l), raw.slice(12));
  return JSON.parse(dec.decode(pt)) as T;
}

export type Step =
  | { kind: 'tokens'; count: number }
  | { kind: 'sent'; slot: string; bytes: number; sample: string[]; cipher: string }
  | { kind: 'received'; slot: string; bytes: number }
  | { kind: 'waiting'; for: string }
  | { kind: 'done'; outcome: Outcome; ms: number };

export interface RunOptions {
  person: string;
  link: Link;
  base?: string; // API origin, for tests
  onStep?: (s: Step) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function api<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status}).`);
  return json as T;
}

async function tokens(o: RunOptions, role: 'A' | 'B'): Promise<Token[]> {
  const r = await api<{ tokens: Token[] }>(o.base ?? '', '/api/lab/tokens', { method: 'POST', body: JSON.stringify({ person: o.person, session: sessionId(o.link), role }) });
  o.onStep?.({ kind: 'tokens', count: r.tokens.length });
  return r.tokens;
}

async function send(o: RunOptions, slot: string, msg: unknown, sample: string[]) {
  const c = await seal(o.link, slot, msg);
  await api(o.base ?? '', `/api/relay/${o.link.box}`, { method: 'PUT', body: JSON.stringify({ slot, c }) });
  o.onStep?.({ kind: 'sent', slot, bytes: c.length, sample: sample.slice(0, 4), cipher: c.slice(0, 64) });
}

async function receive<T>(o: RunOptions, slot: string): Promise<T> {
  o.onStep?.({ kind: 'waiting', for: slot });
  const until = Date.now() + (o.timeoutMs ?? 10 * 60_000);
  for (let wait = 400; Date.now() < until; wait = Math.min(wait * 1.25, 1500)) {
    if (o.signal?.aborted) throw new Error('Cancelled.');
    const r = await api<{ c: string } | null>(o.base ?? '', `/api/relay/${o.link.box}?slot=${slot}`);
    if (r?.c) {
      o.onStep?.({ kind: 'received', slot, bytes: r.c.length });
      return open<T>(o.link, slot, r.c);
    }
    await new Promise((res) => setTimeout(res, wait));
  }
  throw new Error('Your partner hasn’t joined yet. Share the link again or start over.');
}

/** The person who created the link. */
export async function runInitiator(o: RunOptions & { mode?: Mode }): Promise<Outcome> {
  const t0 = performance.now();
  const me = new Initiator(await tokens(o, 'A'), o.mode ?? 'reveal');
  const m1 = me.step1();
  await send(o, 'm1', m1, m1.a);
  const m2 = await receive<Msg2>(o, 'm2');
  const { msg: m3, outcome } = me.step3(m2);
  await send(o, 'm3', m3, m3.ba);
  o.onStep?.({ kind: 'done', outcome, ms: performance.now() - t0 });
  return outcome;
}

/** The person who opened the link. */
export async function runResponder(o: RunOptions): Promise<Outcome> {
  const t0 = performance.now();
  const me = new Responder(await tokens(o, 'B'));
  const m1 = await receive<Msg1>(o, 'm1');
  const m2 = me.step2(m1);
  await send(o, 'm2', m2, m2.b);
  const m3 = await receive<Msg3>(o, 'm3');
  const outcome = me.step4(m3);
  o.onStep?.({ kind: 'done', outcome, ms: performance.now() - t0 });
  return outcome;
}
