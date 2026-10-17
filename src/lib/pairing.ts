// Runs a pairing between two phones. One secret, shared in the link's #fragment (which browsers
// never send to a server), gives both phones:
//   - the session id the lab binds tokens to,
//   - an AES-GCM key, so the relay stores only ciphertext,
//   - three words both people read aloud, so a swapped link would be noticed.
// Anyone else holding the link could open that outer layer too, so the parts that would let them count
// matches (the double-locked lists, in m2 and m3) are sealed again under the phones' own key K (psi.ts),
// which no link holder can compute.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { attestMessage, Initiator, Responder, type AttCheck, type FirstLock, type Msg1, type Msg2, type Msg3, type Token } from './psi';
import type { SharedGene } from './lab';

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
  const d = derive(l, 'words', 8);
  const picked: number[] = [];
  for (const x of d) { const i = x % 32; if (!picked.includes(i)) picked.push(i); if (picked.length === 3) break; }
  return picked.map((i) => WORDS[lang][i]);
}

const aesKey = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
/** AES-GCM under a raw 32-byte key, bound to a slot label. */
async function sealRaw(key: Uint8Array, slot: string, obj: unknown): Promise<string> {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(slot) }, await aesKey(key), enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64u(out);
}
async function openRaw<T>(key: Uint8Array, slot: string, c: string): Promise<T> {
  const raw = unb64u(c);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12), additionalData: enc.encode(slot) }, await aesKey(key), raw.slice(12));
  return JSON.parse(dec.decode(pt)) as T;
}
/** The relay layer: under the link key. */
export const seal = (l: Link, slot: string, obj: unknown) => sealRaw(derive(l, 'relay'), slot, obj);
export const open = <T>(l: Link, slot: string, c: string) => openRaw<T>(derive(l, 'relay'), slot, c);

/**
 * m2 and m3 as they go to the relay (inside the link layer). m2 keeps in the link layer only what A needs
 * to derive K and check the lab's attestation (B's single-locked list, Yb, the signature); B's lock on A's
 * list and its proof are sealed under K. All of m3 is sealed under K.
 */
export interface WireM2 { b: string[]; yb: string; att?: string; k: string }
export interface WireM3 { k: string }
export async function wireM2(m: Msg2, key: Uint8Array): Promise<WireM2> {
  return { b: m.b, yb: m.yb, att: m.att, k: await sealRaw(key, 'm2/k', { ab: m.ab, proof: m.proof }) };
}
export async function unwireM2(w: WireM2, key: Uint8Array): Promise<Msg2> {
  const { ab, proof } = await openRaw<Pick<Msg2, 'ab' | 'proof'>>(key, 'm2/k', w.k);
  return { ab, proof, b: w.b, yb: w.yb, att: w.att };
}
export const wireM3 = async (m: Msg3, key: Uint8Array): Promise<WireM3> => ({ k: await sealRaw(key, 'm3/k', m) });
export const unwireM3 = (w: WireM3, key: Uint8Array) => openRaw<Msg3>(key, 'm3/k', w.k);
const unreadable = () => new Error('Your partner’s phone sent a message this phone can’t open. Nothing was revealed. Start a new pairing.');

/** What a finished pairing tells this phone: lab-confirmed shared genes, and whether its own comparison agreed. */
export interface PairResult { genes: SharedGene[]; agrees: boolean; personal: number; ms: number }

export type Step =
  | { kind: 'tokens'; count: number }
  | { kind: 'sent'; slot: string; bytes: number; sample: string[]; cipher: string }
  | { kind: 'received'; slot: string; bytes: number }
  | { kind: 'waiting'; for: string }
  | { kind: 'proof'; ok: true }
  | { kind: 'confirmed'; partner: string }
  | { kind: 'done'; result: PairResult };

export interface RunOptions {
  /** Signed identity token from /api/demo/session (UAE PASS in production). */
  identity: string;
  link: Link;
  base?: string; // API origin, for tests
  onStep?: (s: Step) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Shows the person who joined and asks "is this your partner?". Tests pass one that says yes. */
  confirmPartner?: (partner: Partner) => Promise<boolean>;
}

export interface Partner { name: { en: string; ar: string }; sex: 'F' | 'M' }

async function api<T>(base: string, path: string, init?: RequestInit, identity?: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(identity ? { 'x-person': identity } : {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status}).`);
  return json as T;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Polls a lab route until it stops answering { waiting: true }. */
async function poll<T extends { waiting?: boolean }>(o: RunOptions, path: string, body: unknown, waitingFor: string, timeoutMsg: string): Promise<T> {
  const until = Date.now() + (o.timeoutMs ?? 10 * 60_000);
  let told = false;
  for (let wait = 500; Date.now() < until; wait = Math.min(wait * 1.25, 2000)) {
    if (o.signal?.aborted) throw new Error('Cancelled.');
    const r = await api<T>(o.base ?? '', path, { method: 'POST', body: JSON.stringify(body) }, o.identity);
    if (!r.waiting) return r;
    if (!told) { o.onStep?.({ kind: 'waiting', for: waitingFor }); told = true; }
    await sleep(wait);
  }
  throw new Error(timeoutMsg);
}

/** Takes this phone's seat; the lab hands out nothing yet. */
async function sit(o: RunOptions, role: 'A' | 'B') {
  await api(o.base ?? '', '/api/lab/tokens', { method: 'POST', body: JSON.stringify({ session: sessionId(o.link), role }) }, o.identity);
}

/**
 * Shows the person who joined; nothing is issued until both confirm each other. The link's creator
 * sees the joiner first; the joiner sees the creator only after being confirmed.
 */
async function confirm(o: RunOptions, role: 'A' | 'B') {
  const body = (ok?: boolean) => ({ session: sessionId(o.link), role, ok });
  const { partner } = await poll<{ waiting?: boolean; partner?: Partner | null }>(o, '/api/lab/confirm', body(), role === 'A' ? 'partner-join' : 'creator-confirm',
    role === 'A' ? 'Your partner hasn’t joined yet. Share the link again or start over.' : 'The person who shared the link hasn’t confirmed you yet.');
  if (!partner) throw new Error('This pairing is incomplete.');
  const yes = o.confirmPartner ? await o.confirmPartner(partner) : true;
  if (!yes) throw new Error('Stopped: you didn’t recognise the person who joined. Start a new pairing.');
  await api(o.base ?? '', '/api/lab/confirm', { method: 'POST', body: JSON.stringify(body(true)) }, o.identity);
  o.onStep?.({ kind: 'confirmed', partner: partner.name.en });
}

/** Once both have confirmed, the lab issues this phone's 64 opaque tokens. */
async function tokens(o: RunOptions, role: 'A' | 'B'): Promise<{ tokens: Token[]; personal: number }> {
  const r = await poll<{ waiting?: boolean; tokens: Token[]; personal: number }>(o, '/api/lab/tokens', { session: sessionId(o.link), role }, 'partner-confirm',
    'Your partner hasn’t confirmed yet. Ask them to check their screen, or start over.');
  o.onStep?.({ kind: 'tokens', count: r.tokens.length });
  return r;
}

/** The lab checks this phone's first lock against the tokens it issued and signs it. */
async function attest(o: RunOptions, role: 'A' | 'B', lock: FirstLock): Promise<string> {
  const r = await api<{ att: string }>(o.base ?? '', '/api/lab/attest', { method: 'POST', body: JSON.stringify({ session: sessionId(o.link), role, ...lock }) }, o.identity);
  return r.att;
}

/** Checks the lab's signature on the partner's first lock. */
async function partnerCheck(o: RunOptions, partnerRole: 'A' | 'B'): Promise<AttCheck> {
  const { publicKey } = await fetch(`${o.base ?? ''}/api/lab/key`).then((r) => r.json() as Promise<{ publicKey: string }>);
  const session = sessionId(o.link);
  return (list, y, att) => {
    if (!att || !/^[0-9a-f]{128}$/.test(att)) return false;
    try { return ed25519.verify(unhex(att), attestMessage(session, partnerRole, y, list), unhex(publicKey)); } catch { return false; }
  };
}
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

/** Reports what this phone matched, then waits until the partner has reported too. */
async function reveal(o: RunOptions, role: 'A' | 'B', matched: string[]) {
  const r = await poll<{ waiting?: boolean; genes?: SharedGene[]; agrees?: boolean; failed?: 'yours' | 'theirs' }>(o, '/api/lab/reveal', { session: sessionId(o.link), role, matched }, 'partner-report',
    'Your partner’s phone hasn’t finished comparing. Ask them to check their screen, or start over.');
  if (!r.agrees) throw new Error(r.failed === 'theirs' ? 'Your partner’s phone reported a comparison the lab couldn’t confirm, so nothing was named. Start a new pairing.' : 'This phone’s comparison didn’t match the lab’s records, so nothing was named. Start a new pairing.');
  return { genes: r.genes ?? [], agrees: true };
}
const tokensAt = (all: Token[], idx: number[]) => idx.map((i) => all.find((t) => t.i === i)!.token);

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
export async function runInitiator(o: RunOptions): Promise<PairResult> {
  const t0 = performance.now();
  await sit(o, 'A');
  await confirm(o, 'A');
  const t = await tokens(o, 'A');
  const me = new Initiator(t.tokens);
  const [att, check] = await Promise.all([attest(o, 'A', me.firstLock), partnerCheck(o, 'B')]);
  const m1 = me.step1(att);
  await send(o, 'm1', m1, m1.a);
  const w2 = await receive<WireM2>(o, 'm2');
  const key = me.channelKey(w2.yb, sessionId(o.link));
  const m2 = await unwireM2(w2, key).catch(() => { throw unreadable(); });
  const { msg: m3, outcome } = me.step3(m2, check);
  o.onStep?.({ kind: 'proof', ok: true });
  await send(o, 'm3', await wireM3(m3, key), m3.ba);
  const r = await reveal(o, 'A', tokensAt(t.tokens, outcome.matched));
  const result: PairResult = { ...r, personal: t.personal, ms: performance.now() - t0 };
  o.onStep?.({ kind: 'done', result });
  return result;
}

/** The person who opened the link. */
export async function runResponder(o: RunOptions): Promise<PairResult> {
  const t0 = performance.now();
  await sit(o, 'B');
  await confirm(o, 'B');
  const t = await tokens(o, 'B');
  const me = new Responder(t.tokens);
  const [att, check] = await Promise.all([attest(o, 'B', me.firstLock), partnerCheck(o, 'A')]);
  const m1 = await receive<Msg1>(o, 'm1');
  const m2 = me.step2(m1, att, check);
  const key = me.channelKey(m1.ya, sessionId(o.link));
  await send(o, 'm2', await wireM2(m2, key), m2.b);
  const w3 = await receive<WireM3>(o, 'm3');
  const m3 = await unwireM3(w3, key).catch(() => { throw unreadable(); });
  const outcome = me.step4(m3);
  o.onStep?.({ kind: 'proof', ok: true });
  const r = await reveal(o, 'B', tokensAt(t.tokens, outcome.matched));
  const result: PairResult = { ...r, personal: t.personal, ms: performance.now() - t0 };
  o.onStep?.({ kind: 'done', result });
  return result;
}

/** Signs in a synthetic person for the demo (UAE PASS in production). */
export async function demoSignIn(person: string, base = ''): Promise<string> {
  const r = await api<{ token: string }>(base, '/api/demo/session', { method: 'POST', body: JSON.stringify({ person }) });
  return r.token;
}
