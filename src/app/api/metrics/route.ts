// Programme metrics. Phones send only anonymous teach-back totals (signed-in people); everything else
// is counted from desk and family-note records.
// Privacy, per person and for life:
// - Each person counts once: their first teach-back ever, their first booking ever, and at most
//   LETTER_CAP family notes in total (each note count is noised for that many).
// - Each weekly release counts only records from that one week (the last complete week), so a
//   person's records fall in one release and repeated releases never re-noise the same people.
// - Every count gets exact discrete Laplace noise at ε = 1/SCALE per unit; a release has at most
//   LIVE_COUNTS such counts, so no person's records ever cost more than ε = LIVE_COUNTS/SCALE = 3.
// - Releases are cached: asking again returns the same numbers. Rates appear only beside a count
//   that is shown, and are computed from those same noisy counts.
// The synthetic month gets the same noise for realism but describes nobody, so it spends nothing.
// Counsellors see exact queues on the desk; only these published aggregates are noised.
import { listCases, type DeskCase } from '@/lib/desk';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { store } from '@/lib/store';
import { seedDesk } from '@/lib/seed';
import { rng } from '@/lib/sim';
import { noisyCount } from '@/lib/dp';
import { connection } from 'next/server';

const YEAR = 60 * 60 * 24 * 365;
const SCALE = 7; // ε = 1/7 per count
const LIVE_COUNTS = 21; // at most this many live counts in one release (see compute)
const EPS_PERSON = LIVE_COUNTS / SCALE;
const LETTER_CAP = 5;
const WEEK = 7 * 86_400_000;
const MIN_CELL = 5;
interface TB { n: number; correct: number; all3: number }
type Bucket = Record<string, TB>; // `${lang}:${level}`
const LANGS = ['ar', 'en'], LEVELS = ['simple', 'standard', 'detailed'];

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ lang?: string; level?: string; correct?: number }>(req);
  if (b instanceof Response) return b;
  // Only a person's first teach-back ever is counted.
  if (!(await store().putNew(`tbdone:${p.id}`, true, YEAR))) return Response.json({ ok: true, counted: false });
  const lang = b.lang === 'ar' ? 'ar' : 'en';
  const level = LEVELS.includes(b.level ?? '') ? b.level! : 'standard';
  const correct = Math.max(0, Math.min(3, Math.round(Number(b.correct) || 0)));
  const w = Math.floor(Date.now() / WEEK);
  await store().incr(`metrics:tb:w${w}:${lang}:${level}:n`, YEAR);
  if (correct === 3) await store().incr(`metrics:tb:w${w}:${lang}:${level}:all3`, YEAR);
  return Response.json({ ok: true, counted: true });
}

async function teachBackWeek(w: number): Promise<Bucket> {
  const out: Bucket = {};
  for (const l of LANGS) for (const v of LEVELS) {
    const [n, all3] = await Promise.all([store().get<number>(`metrics:tb:w${w}:${l}:${v}:n`), store().get<number>(`metrics:tb:w${w}:${l}:${v}:all3`)]);
    if (n) out[`${l}:${v}`] = { n, correct: 0, all3: all3 ?? 0 };
  }
  return out;
}

/** Seeded synthetic teach-back responses: shown so the view isn't empty, always labelled as synthetic. */
function syntheticTeachBack(): Bucket {
  const r = rng(20261017);
  const out: Bucket = {};
  const rates: Record<string, number> = { 'ar:simple': 0.74, 'ar:standard': 0.79, 'ar:detailed': 0.76, 'en:simple': 0.77, 'en:standard': 0.82, 'en:detailed': 0.8 };
  for (const [k, p] of Object.entries(rates)) {
    const n = 40 + Math.floor(r() * 25);
    let all3 = 0, correct = 0;
    for (let i = 0; i < n; i++) { const ok = r() < p; all3 += ok ? 1 : 0; correct += ok ? 3 : 1 + Math.floor(r() * 2); }
    out[k] = { n, correct, all3 };
  }
  return out;
}

type CaseLike = Pick<DeskCase, 'createdAt' | 'firstContactAt' | 'status' | 'dueBy' | 'referral' | 'language'>;

/**
 * A seeded synthetic month for one screening centre, so the view shows what it would look like at
 * scale. Shape only: about 1 in 9 screened couples share a gene (M42 reported 11% of 1,118), most
 * book, most are reached within the target. Always labelled synthetic; never mixed with live data.
 */
function syntheticMonth(): { cases: CaseLike[]; letters: { read: number; booked: number }[] } {
  const r = rng(20261018);
  const start = Date.UTC(2026, 8, 1);
  const cases: CaseLike[] = [];
  for (let i = 0; i < 96; i++) {
    const createdAt = start + Math.floor(r() * 28) * 86_400_000 + Math.floor(r() * 10 + 8) * 3_600_000;
    const dueBy = createdAt + 2 * 86_400_000;
    const reached = r() < 0.93;
    const hours = r() < 0.8 ? 2 + r() * 22 : 24 + r() * 40;
    const withdrawn = r() < 0.03;
    const referred = reached && !withdrawn && r() < 0.42;
    cases.push({
      createdAt, dueBy, language: r() < 0.68 ? 'ar' : 'en',
      firstContactAt: reached && !withdrawn ? createdAt + hours * 3_600_000 : null,
      status: withdrawn ? 'withdrawn' : referred ? 'referred' : reached ? 'counselled' : 'new',
      referral: referred ? { service: 'Reproductive genetics clinic', at: createdAt + (2 + r() * 8) * 86_400_000 } : null,
    });
  }
  const letters = Array.from({ length: 61 }, () => ({ read: r() < 0.55 ? 1 : 0, booked: r() < 0.18 ? 1 : 0 }));
  return { cases, letters };
}

async function compute(week: number) {
  await seedDesk();
  // Only counts over live records spend privacy budget; the synthetic month describes nobody.
  let counts = 0, charging = true;
  const noisy = (n: number, sensitivity = 1) => { if (charging) counts++; return noisyCount(n, SCALE, sensitivity); };
  const shown = (v: number) => (v < MIN_CELL ? { value: null, suppressed: true } : { value: v, suppressed: false });
  const inWeek = (t: number) => Math.floor(t / WEEK) === week;

  // Each person's first booking ever, if it was made in this week.
  const first = new Map<string, DeskCase>();
  for (const c of (await listCases()).filter((c) => !c.person.id.startsWith('synthetic-')).sort((a, b) => a.createdAt - b.createdAt)) if (!first.has(c.person.id)) first.set(c.person.id, c);
  const cases = [...first.values()].filter((c) => inWeek(c.createdAt));
  const synth = syntheticMonth();
  const live = await teachBackWeek(week);
  const letters = (await store().list<{ read: number; booked: number; createdAt: number }>('letter:')).map((x) => x.value).filter((l) => inWeek(l.createdAt));

  const caseStats = (cs: CaseLike[]) => {
    const contacted = cs.filter((c) => c.firstContactAt);
    const hrs = contacted.map((c) => (c.firstContactAt! - c.createdAt) / 3_600_000).sort((a, b) => a - b);
    const nb = noisy(cs.length), nc = noisy(contacted.length);
    const within = noisy(contacted.filter((c) => c.firstContactAt! <= c.dueBy).length), arabic = noisy(cs.filter((c) => c.language === 'ar').length);
    return {
      booked: shown(nb),
      contacted: shown(nc),
      overdue: shown(noisy(cs.filter((c) => !c.firstContactAt && c.status !== 'withdrawn' && c.dueBy < Date.now()).length)),
      referred: shown(noisy(cs.filter((c) => c.referral).length)),
      withdrawn: shown(noisy(cs.filter((c) => c.status === 'withdrawn').length)),
      // Medians can't be noised safely with this budget, so only the synthetic month shows one.
      medianHoursToFirstContact: charging ? null : hrs.length >= MIN_CELL ? Math.max(1, Math.round(hrs[Math.floor(hrs.length / 2)] / 4) * 4) : null,
      // Rates only beside a count that is shown, from the same noisy counts.
      withinTarget: nc >= MIN_CELL ? Math.min(1, within / nc) : null,
      arabicShare: nb >= MIN_CELL ? Math.min(1, arabic / nb) : null,
    };
  };
  const tb = (bucket: Bucket, key: (k: string) => boolean) => {
    const rows = Object.entries(bucket).filter(([k]) => key(k)).map(([, v]) => v);
    const n = noisy(rows.reduce((a, x) => a + x.n, 0));
    const all3 = noisy(rows.reduce((a, x) => a + x.all3, 0));
    return n < MIN_CELL ? { people: null, allThreeRight: null } : { people: n, allThreeRight: Math.min(1, all3 / n) };
  };
  const views = (bucket: Bucket) => ({
    ar: tb(bucket, (k) => k.startsWith('ar:')), en: tb(bucket, (k) => k.startsWith('en:')),
    simple: tb(bucket, (k) => k.endsWith(':simple')), standard: tb(bucket, (k) => k.endsWith(':standard')), detailed: tb(bucket, (k) => k.endsWith(':detailed')),
  });
  // One sender writes at most LETTER_CAP notes ever, so note counts are noised for that many.
  const fam = (ls: { read: number; booked: number }[]) => ({
    notes: shown(noisy(ls.length, LETTER_CAP)),
    readShared: shown(noisy(ls.filter((l) => l.read > 0).length, LETTER_CAP)),
    booked: shown(noisy(ls.reduce((a, l) => a + Math.min(1, l.booked), 0), LETTER_CAP)),
  });
  const liveCounselling = caseStats(cases), liveViews = views(live), liveFamily = fam(letters);
  charging = false;
  if (counts > LIVE_COUNTS) throw new Error('Release would exceed its privacy budget.');
  const release = {
    week,
    counselling: { live: liveCounselling, seededSynthetic: caseStats(synth.cases) },
    understanding: { live: liveViews, seededSynthetic: views(syntheticTeachBack()) },
    family: { live: liveFamily, seededSynthetic: fam(synth.letters) },
    neverCounted: ['marriages', 'individual results', 'which couples are at increased chance'],
  };
  const releases = await store().incr('metrics:releases', YEAR);
  return {
    ...release,
    privacy: {
      epsilonPerCount: Number((1 / SCALE).toFixed(3)), epsilonThisRelease: Number((counts / SCALE).toFixed(2)), epsilonPerPersonLifetime: EPS_PERSON,
      releases, minimumCell: MIN_CELL, letterCap: LETTER_CAP, refreshed: 'weekly, covering the last complete week; repeated requests return the same release',
    },
  };
}

export async function GET() {
  await connection();
  const week = Math.floor(Date.now() / WEEK) - 1; // the last complete week
  const key = `metrics:release:v2:w${week}`;
  let r = await store().get<Awaited<ReturnType<typeof compute>>>(key);
  if (!r) {
    r = await compute(week);
    await store().putNew(key, r, 60 * 60 * 24 * 14);
    r = (await store().get<typeof r>(key)) ?? r; // whoever wrote first wins, everyone serves the same
  }
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
