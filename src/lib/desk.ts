// The counsellor desk's data: cases created only with the person's explicit, itemised consent,
// an append-only audit trail (hash-chained), and time-to-contact clocks.
import 'server-only';
import { sha256 } from '@noble/hashes/sha2.js';
import { store } from './store';
import type { Finding } from './lab';
import type { Relationship } from './risk';

export type CaseStatus = 'new' | 'contacted' | 'counselled' | 'referred' | 'closed' | 'withdrawn';

export interface Consent {
  sharedGenes: boolean;      // always true to book: the case is about these
  ownResults: boolean;       // the person's full findings
  relationship: boolean;     // whether they are related
}

export interface DeskCase {
  id: string;
  createdAt: number;
  /** Ties the two partners' requests together without naming either to the other. */
  pairing: string | null;
  person: { id: string; name: string; sex: 'F' | 'M' };
  language: 'en' | 'ar';
  readingLevel: 'simple' | 'standard' | 'detailed';
  consent: Consent;
  sharedGenes: string[];
  ownFindings: Finding[] | null;
  relationship: Relationship | null;
  status: CaseStatus;
  /** Contact due within two working days of booking. */
  dueBy: number;
  firstContactAt: number | null;
  referral: { service: string; at: number } | null;
  notes: { at: number; by: string; text: string }[];
  audit: AuditEntry[];
}

export interface AuditEntry { at: number; actor: string; action: string; hash: string }

const TTL = 60 * 60 * 24 * 60; // demo cases live 60 days

function chain(prev: string, at: number, actor: string, action: string) {
  const h = sha256(new TextEncoder().encode(`${prev}|${at}|${actor}|${action}`));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function audit(c: DeskCase, actor: string, action: string, at = Date.now()) {
  const prev = c.audit.at(-1)?.hash ?? '0'.repeat(64);
  c.audit.push({ at, actor, action, hash: chain(prev, at, actor, action) });
}

export function verifyAudit(c: DeskCase): boolean {
  let prev = '0'.repeat(64);
  for (const e of c.audit) {
    if (chain(prev, e.at, e.actor, e.action) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

/** Two working days after `t`. The UAE federal working week has run Monday to Friday since 2022. */
export function twoWorkingDaysFrom(t: number): number {
  const d = new Date(t);
  let added = 0;
  while (added < 2) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.getTime();
}

export async function saveCase(c: DeskCase) { await store().put(`case:${c.id}`, c, TTL); }
export async function getCase(id: string) { return store().get<DeskCase>(`case:${id}`); }
export async function listCases() {
  const all = await store().list<DeskCase>('case:');
  return all.map((x) => x.value).sort((a, b) => b.createdAt - a.createdAt);
}
