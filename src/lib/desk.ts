// The counsellor desk's data: cases created only with the person's explicit, itemised, versioned
// consent; an append-only audit trail chained with a server-held key (so it can't be recomputed by
// whoever edits the record) that logs reads as well as actions, and whose every entry and seal also
// cover a keyed hash of the case's content; and time-to-contact clocks.
import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { fail, pseudonym } from './identity';
import { labKey, subkey } from './labkey';
import { store } from './store';
import type { Finding } from './lab';
import type { Relationship } from './risk';

export type CaseStatus = 'new' | 'contacted' | 'counselled' | 'referred' | 'closed' | 'withdrawn';
export const CONSENT_VERSION = 'consent-v2-2026-10-17';

export interface Consent {
  sharedGenes: boolean;      // always true to book: the case is about these
  ownResults: boolean;       // the person's full findings
  relationship: boolean;     // whether they are related
  version: string;
}

export interface DeskCase {
  id: string;
  createdAt: number;
  /**
   * A keyed code of the pairing (pairingRef), so the desk can say whether the partner booked too (they are
   * told this when they book). Not the session id: it can't be matched to the lab's seat or used-link
   * records. It does tie the two bookings to each other for as long as the cases are kept; erased on
   * withdrawal. Never sent to the desk.
   */
  pairing: string | null;
  /** `nameAr` is the person's name in Arabic, for the desk in Arabic. */
  person: { id: string; name: string; nameAr?: string; sex: 'F' | 'M' };
  /** Booked by a demo identity (shared by every visitor): kept 2 hours, not 60 days. */
  demo?: boolean;
  /** Null after withdrawal, like everything else the person chose. */
  language: 'en' | 'ar' | null;
  readingLevel: 'simple' | 'standard' | 'detailed' | null;
  consent: Consent;
  sharedGenes: string[];
  /** What each shared match means, from the lab's release: 'full', 'milder', 'low', or a globin kind ('hplc', 'bart', 'hbh-severe', 'hbh', 'trait'). */
  sharedKinds?: Record<string, string>;
  /** For alpha globin, the chance per pregnancy of the named outcome: 'quarter', 'half' or 'all'. */
  sharedChances?: Record<string, string>;
  ownFindings: Finding[] | null;
  relationship: Relationship | null;
  /**
   * Priority: 'urgent' (distress) = 4-hour clock; 'pregnant' = 4 hours from week 9, when the weeks aren't
   * known, or with a possible Hb Bart's or severe HbH match, else 1 working day; otherwise 2 working days,
   * or 1 for a possible Hb Bart's, severe HbH or SMA match.
   */
  priority: 'urgent' | 'pregnant' | 'routine' | null;
  /** Weeks of pregnancy when booked, if the person said so: testing in pregnancy has time windows. */
  pregnancyWeeks?: number | null;
  question: string | null;
  status: CaseStatus;
  dueBy: number;
  firstContactAt: number | null;
  referral: { service: string; at: number } | null;
  /** Clinical notes are the provider's record: kept (sealed) even after withdrawal, as health-records law requires. */
  notes: { at: number; by: string; text: string }[];
  sealed: boolean;
  /** The person's first booking ever: the only one the programme view counts. */
  firstEver?: boolean;
  audit: AuditEntry[];
  /** HMAC over the entry count, last hash and current content, so cutting entries off the end or editing the case is detected too. */
  auditSeal?: string;
  /** Random salt for the content hashes; replaced on withdrawal, so old hashes can't confirm a guess about erased data. */
  auditSalt?: string;
}

/** `content` is a keyed hash of the case as it was after this entry (absent on entries written before it existed). */
export interface AuditEntry { at: number; actor: string; action: string; content?: string; hash: string }

const TTL = 60 * 60 * 24 * 60; // cases live 60 days in the demo
const DEMO_TTL = 2 * 3600; // a case booked by a shared demo identity lives 2 hours
/** Seconds left to keep a case: 2 hours from booking for a demo identity's case, else 60 days. */
export const caseTtl = (c: Pick<DeskCase, 'demo' | 'createdAt'>) => (c.demo ? Math.max(60, Math.ceil((c.createdAt + DEMO_TTL * 1000 - Date.now()) / 1000)) : TTL);
const enc = new TextEncoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const mac = (key: Uint8Array, msg: string) => hex(hmac(sha256, key, enc.encode(msg)));
const ZERO = '0'.repeat(64);
const auditKey = () => subkey('audit');
/** The key, and entry format, from before per-purpose subkeys: entries written then still verify. */
const legacyKey = () => hmac(sha256, labKey(), enc.encode('twokeys/audit/v1'));
const salt = () => hex(crypto.getRandomValues(new Uint8Array(16)));

/** Canonical JSON (sorted keys, undefined dropped as the store drops it), so a hash depends on content, not key order. */
function canon(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canon).join(',')}]`;
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(x ?? null);
}
/** Keyed hash of everything on the case except its trail. */
function contentHash(c: DeskCase) {
  return mac(auditKey(), `content|${c.auditSalt ?? ''}|${canon({ ...c, audit: undefined, auditSeal: undefined, auditSalt: undefined })}`);
}
function link(prev: string, e: Omit<AuditEntry, 'hash'>) {
  return e.content === undefined
    ? mac(legacyKey(), `${prev}|${e.at}|${e.actor}|${e.action}`)
    : mac(auditKey(), `v2|${prev}|${e.at}|${e.actor}|${e.action}|${e.content}`);
}
function seal(c: DeskCase) {
  const last = c.audit.at(-1);
  if (last && last.content === undefined) return mac(legacyKey(), `seal|${c.id}|${c.audit.length}|${last.hash}`);
  return mac(auditKey(), `seal/v2|${c.id}|${c.audit.length}|${last?.hash ?? ''}|${contentHash(c)}`);
}

/** Appends an entry. Call it after the change it records: the entry and the seal cover the content as it is then. */
export function audit(c: DeskCase, actor: string, action: string, at = Date.now()) {
  c.auditSalt ??= salt();
  const e = { at, actor, action, content: contentHash(c) };
  c.audit.push({ ...e, hash: link(c.audit.at(-1)?.hash ?? ZERO, e) });
  c.auditSeal = seal(c);
}

/** True if no entry was edited, reordered or removed, and the case itself wasn't edited, by anyone without the server key. */
export function verifyAudit(c: DeskCase): boolean {
  let prev = ZERO;
  for (const e of c.audit) {
    if (link(prev, e) !== e.hash) return false;
    prev = e.hash;
  }
  return c.auditSeal === undefined ? c.audit.length === 0 : c.auditSeal === seal(c);
}

/**
 * Desk-wide log of queue reads, chained like a case's trail: each row's hash covers the row before it and a
 * keyed hash of exactly what was shown. Rows are numbered and write-once, so two reads at the same moment
 * can't fork the chain; the head pointer is only a hint, and catches up when it is behind.
 */
export async function logQueueRead(actor: string, shown: unknown[]) {
  const db = store();
  const content = mac(auditKey(), `queue|${canon(shown)}`);
  const row = (n: number) => `deskaudit:q:${String(n).padStart(9, '0')}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const head = (await db.get<{ n: number; hash: string }>('deskaudit:head')) ?? { n: 0, hash: ZERO };
    const e = { at: Date.now(), actor, action: `read the queue (${shown.length} summaries)`, content };
    const hash = mac(auditKey(), `queue/v2|${head.hash}|${e.at}|${e.actor}|${e.action}|${e.content}`);
    if (await db.putNew(row(head.n + 1), { n: head.n + 1, ...e, hash }, TTL)) { await db.put('deskaudit:head', { n: head.n + 1, hash }, TTL); return; }
    const taken = await db.get<{ n: number; hash: string }>(row(head.n + 1));
    if (taken) await db.put('deskaudit:head', { n: taken.n, hash: taken.hash }, TTL);
  }
}

/**
 * What the queue shows of a case: an urgent/normal level, whether it is overdue, due today or later (never
 * the exact due time, which would tell the pregnancy and match clocks apart), its place in the queue,
 * counts and the person's name. Nothing else. The opened case shows the exact clock.
 */
export interface QueueItem {
  id: string; name: string; nameAr?: string; status: CaseStatus; level: 'urgent' | 'normal';
  due: 'overdue' | 'today' | 'later' | null; overdue: boolean;
  /** 0 is the top of the queue. Synthetic history is pinned first, so a judge always finds it. */
  rank: number; pinned: boolean;
  createdAt: number; firstContactAt: number | null; sharedCount: number; notesCount: number;
}
const GULF = 4 * 3_600_000; // UAE time, UTC+4, for "due today"
const done = (c: DeskCase) => c.status === 'withdrawn' || c.status === 'closed';
const isUrgent = (c: DeskCase) => c.status !== 'withdrawn' && (c.priority === 'urgent' || c.dueBy - c.createdAt <= 4 * 3_600_000);
export const isSeed = (c: Pick<DeskCase, 'person'>) => c.person.id.startsWith('synthetic-');
/** Pinned synthetic history first, then waiting cases before contacted ones, finished last; urgent first, then soonest due. */
const order = (a: DeskCase, b: DeskCase) => Number(done(a)) - Number(done(b)) || Number(!isSeed(a)) - Number(!isSeed(b))
  || Number(!!a.firstContactAt) - Number(!!b.firstContactAt) || Number(!isUrgent(a)) - Number(!isUrgent(b)) || a.dueBy - b.dueBy;
export function queue(cases: DeskCase[], now = Date.now()): QueueItem[] {
  const endOfDay = Math.floor((now + GULF) / 86_400_000) * 86_400_000 + 86_400_000 - GULF;
  return [...cases].sort(order).map((c, rank) => {
    const waiting = !done(c) && !c.firstContactAt;
    const overdue = waiting && c.dueBy < now;
    return {
      id: c.id, name: c.person.name, nameAr: c.person.nameAr, status: c.status, level: isUrgent(c) ? 'urgent' : 'normal',
      due: !waiting ? null : overdue ? 'overdue' : c.dueBy < endOfDay ? 'today' : 'later', overdue, rank, pinned: isSeed(c) && !done(c),
      createdAt: c.createdAt, firstContactAt: c.firstContactAt, sharedCount: c.sharedGenes.length, notesCount: c.sealed ? 0 : c.notes.length,
    };
  });
}

/** The same-day flag the explainer gives a person in distress: HMAC(subkey 'urgent', person id | UTC day). /api/ask sends it as `urgentSig`. */
export const signUrgent = (person: string, day = new Date().toISOString().slice(0, 10)) => mac(subkey('urgent'), `${person}|${day}`);
/** True if `sig` is signUrgent(person) for today or yesterday (UTC), so a flag made just before midnight still counts. */
export function verifyUrgent(person: string, sig: unknown): boolean {
  if (typeof sig !== 'string' || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return [0, 1].some((d) => {
    const want = signUrgent(person, new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10));
    let diff = 0;
    for (let i = 0; i < 64; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  });
}

/** The keyed pairing code a booked case keeps (see DeskCase.pairing). */
export const pairingRef = (session: string) => mac(subkey('pairing-ref'), `pairing|${session}`).slice(0, 32);
/** One open case per person: an atomic marker holding the case id, cleared on close or withdrawal. */
export const openKey = (personId: string) => `open:${pseudonym(personId)}`;
export async function clearOpen(c: DeskCase) {
  const key = openKey(c.person.id);
  if ((await store().get<string>(key)) === c.id) await store().del(key);
}

/** `n` working days after `t`. The UAE federal working week has run Monday to Friday since 2022. */
export function workingDaysFrom(t: number, n: number): number {
  const d = new Date(t);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.getTime();
}
export const twoWorkingDaysFrom = (t: number) => workingDaysFrom(t, 2);
/**
 * From week 9 a pregnancy gets the same 4-hour clock as distress: chorionic villus sampling is done at
 * about weeks 10 to 13, and later options have legal time limits, so a day can matter. `serious` is a
 * possible Hb Bart's, severe HbH or SMA match, or an alpha-globin result that waits on how one partner's two
 * alpha-plus changes sit (1 working day even without a pregnancy); 'hydrops' is a possible Hb Bart's or
 * severe HbH, as read or under the other arrangement, which in any pregnancy gets the 4-hour clock (a risk to
 * the mother too).
 */
export function dueFor(priority: DeskCase['priority'], t: number, weeks?: number | null, serious: boolean | 'hydrops' = false) {
  // Unknown weeks are treated as late: the legal window for some choices closes at 120 days.
  if (priority === 'pregnant' && (weeks == null || weeks >= 9 || serious === 'hydrops')) return t + 4 * 3_600_000;
  return priority === 'urgent' ? t + 4 * 3_600_000 : priority === 'pregnant' || serious ? workingDaysFrom(t, 1) : workingDaysFrom(t, 2);
}

/**
 * Erase what the person shared, and the details of their booking (reading level, language, pregnancy,
 * priority and its clock, referral); keep the counsellor's record sealed (visible to audit only). The
 * content-hash salt is replaced, so the trail's earlier hashes can't confirm a guess about what was erased.
 */
export function withdraw(c: DeskCase, actor: string) {
  c.status = 'withdrawn';
  c.sharedGenes = [];
  c.sharedKinds = {};
  c.sharedChances = {};
  c.ownFindings = null;
  c.relationship = null;
  c.question = null;
  c.pairing = null;
  c.language = null;
  c.readingLevel = null;
  c.pregnancyWeeks = null;
  c.priority = null;
  c.dueBy = c.createdAt;
  c.referral = null;
  c.sealed = c.notes.length > 0;
  c.auditSalt = salt();
  audit(c, actor, 'consent withdrawn; shared data erased; clinical notes sealed');
}

/** The case as a counsellor may see it: sealed notes hidden, the pairing never shown, only whether the partner booked too. */
export type DeskView = DeskCase & { partnerBooked: boolean };
export function deskView(c: DeskCase, partnerBooked = false): DeskView {
  return { ...c, auditSalt: undefined, notes: c.sealed ? [] : c.notes, pairing: null, partnerBooked };
}
/** Whether the other partner in this case's pairing has an open booking too. */
export async function partnerBooked(c: DeskCase): Promise<boolean> {
  if (!c.pairing || c.status === 'withdrawn') return false;
  return (await listCases()).some((x) => x.id !== c.id && x.pairing === c.pairing && x.person.id !== c.person.id && x.status !== 'withdrawn');
}

/** A new case only: never overwrites. */
export async function saveCase(c: DeskCase) { await store().putNew(`case:${c.id}`, c, caseTtl(c)); }
/**
 * Read-modify-write with compare-and-swap, retried on conflict: two counsellors viewing at once both
 * get their audit entry, and a view or note racing a withdrawal can't write the erased data back.
 * `change` edits the case in place, or returns a Response to stop without writing.
 */
export async function updateCase(id: string, change: (c: DeskCase) => Response | void): Promise<DeskCase | Response | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const old = await getCase(id);
    if (!old) return null;
    const c = structuredClone(old);
    const stop = change(c);
    if (stop) return stop;
    if (await store().replace(`case:${id}`, old, c, caseTtl(c))) return c;
  }
  return fail('busy', 'The case is busy. Try again.', 409);
}
export async function getCase(id: string) { return store().get<DeskCase>(`case:${id}`); }
export async function listCases() {
  const all = await store().list<DeskCase>('case:');
  return all.map((x) => x.value).sort((a, b) => b.createdAt - a.createdAt);
}
