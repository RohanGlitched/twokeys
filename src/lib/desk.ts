// The counsellor desk's data: cases created only with the person's explicit, itemised, versioned
// consent; an append-only audit trail chained with a server-held key (so it can't be recomputed by
// whoever edits the record) that logs reads as well as actions; and time-to-contact clocks.
import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { labKey } from './labkey';
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
  /** Ties the two partners' requests together (they are told this when they book). */
  pairing: string | null;
  person: { id: string; name: string; sex: 'F' | 'M' };
  language: 'en' | 'ar';
  readingLevel: 'simple' | 'standard' | 'detailed';
  consent: Consent;
  sharedGenes: string[];
  ownFindings: Finding[] | null;
  relationship: Relationship | null;
  /** Priority: 'urgent' (distress) = 4-hour clock; 'pregnant' = 1 working day; otherwise 2 working days. */
  priority: 'urgent' | 'pregnant' | 'routine';
  question: string | null;
  status: CaseStatus;
  dueBy: number;
  firstContactAt: number | null;
  referral: { service: string; at: number } | null;
  /** Clinical notes are the provider's record: kept (sealed) even after withdrawal, as health-records law requires. */
  notes: { at: number; by: string; text: string }[];
  sealed: boolean;
  audit: AuditEntry[];
  /** HMAC over the entry count and last hash, so cutting entries off the end is detected too. */
  auditSeal?: string;
}

export interface AuditEntry { at: number; actor: string; action: string; hash: string }

const TTL = 60 * 60 * 24 * 60; // demo cases live 60 days

function auditKey() { return hmac(sha256, labKey(), new TextEncoder().encode('twokeys/audit/v1')); }
function chain(prev: string, at: number, actor: string, action: string) {
  const h = hmac(sha256, auditKey(), new TextEncoder().encode(`${prev}|${at}|${actor}|${action}`));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function audit(c: DeskCase, actor: string, action: string, at = Date.now()) {
  const prev = c.audit.at(-1)?.hash ?? '0'.repeat(64);
  c.audit.push({ at, actor, action, hash: chain(prev, at, actor, action) });
  c.auditSeal = seal(c);
}
function seal(c: DeskCase) {
  const h = hmac(sha256, auditKey(), new TextEncoder().encode(`seal|${c.id}|${c.audit.length}|${c.audit.at(-1)?.hash ?? ''}`));
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** True if no entry was edited, reordered or removed by anyone without the server key. */
export function verifyAudit(c: DeskCase): boolean {
  let prev = '0'.repeat(64);
  for (const e of c.audit) {
    if (chain(prev, e.at, e.actor, e.action) !== e.hash) return false;
    prev = e.hash;
  }
  return c.auditSeal === undefined ? c.audit.length === 0 : c.auditSeal === seal(c);
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
export function dueFor(priority: DeskCase['priority'], t: number) {
  return priority === 'urgent' ? t + 4 * 3_600_000 : priority === 'pregnant' ? workingDaysFrom(t, 1) : workingDaysFrom(t, 2);
}

/** Erase what the person shared; keep the counsellor's record sealed (visible to audit only). */
export function withdraw(c: DeskCase, actor: string) {
  c.status = 'withdrawn';
  c.sharedGenes = [];
  c.ownFindings = null;
  c.relationship = null;
  c.question = null;
  c.pairing = null;
  c.referral = c.referral ? { service: 'withheld after withdrawal', at: c.referral.at } : null;
  c.sealed = c.notes.length > 0;
  audit(c, actor, 'consent withdrawn; shared data erased; clinical notes sealed');
}

/** The case as a counsellor may see it: sealed notes are hidden. */
export function deskView(c: DeskCase): DeskCase {
  return c.sealed ? { ...c, notes: [] } : c;
}

export async function saveCase(c: DeskCase) { await store().put(`case:${c.id}`, c, TTL); }
export async function getCase(id: string) { return store().get<DeskCase>(`case:${id}`); }
export async function listCases() {
  const all = await store().list<DeskCase>('case:');
  return all.map((x) => x.value).sort((a, b) => b.createdAt - a.createdAt);
}
