// Programme metrics. Phones send only anonymous teach-back totals (signed-in people, rate-limited);
// everything else is counted from desk and family-note records.
// Privacy: one release a week, cached, so repeated queries can't average the noise away. Each
// release spends a fixed budget (ε = 3 in total, split evenly over its live counts) using discrete
// Laplace noise from a cryptographic source; the running total across releases is published.
// Rates appear only when their noisy denominator is at least 5; live medians are not published.
// The synthetic month gets the same noise for realism but describes nobody, so it spends nothing.
// Counsellors see exact queues on the desk; only these published aggregates are noised.
import { listCases, type DeskCase } from '@/lib/desk';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';
import { seedDesk } from '@/lib/seed';
import { rng } from '@/lib/sim';
import { noisyCount } from '@/lib/dp';
import { connection } from 'next/server';

const TTL = 60 * 60 * 24 * 90;
const EPS_RELEASE = 3;
const LIVE_COUNTS = 21; // at most this many counts are drawn from live records in one release (see compute)
const EPS = EPS_RELEASE / LIVE_COUNTS;
const WEEK = 7 * 86_400_000;
const MIN_CELL = 5;
interface TB { n: number; correct: number; all3: number }
type Bucket = Record<string, TB>; // `${lang}:${level}`

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'teachback', 6, p.id)) return Response.json({ ok: true });
  const b = await readJson<{ lang?: string; level?: string; correct?: number }>(req);
  if (b instanceof Response) return b;
  const lang = b.lang === 'ar' ? 'ar' : 'en';
  const level = ['simple', 'standard', 'detailed'].includes(b.level ?? '') ? b.level! : 'standard';
  const correct = Math.max(0, Math.min(3, Math.round(Number(b.correct) || 0)));
  const db = store();
  const all = (await db.get<Bucket>('metrics:teachback')) ?? {};
  const k = `${lang}:${level}`;
  const cur = all[k] ?? { n: 0, correct: 0, all3: 0 };
  all[k] = { n: cur.n + 1, correct: cur.correct + correct, all3: cur.all3 + (correct === 3 ? 1 : 0) };
  await db.put('metrics:teachback', all, TTL);
  return Response.json({ ok: true });
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
  let spent = 0, charging = true;
  const noisy = (n: number) => { if (charging) spent += EPS; return noisyCount(n, EPS); };
  const cell = (n: number) => { const v = noisy(n); return v < MIN_CELL ? { value: null, suppressed: true } : { value: v, suppressed: false }; };

  const all = await listCases();
  const cases = all.filter((c) => !c.person.id.startsWith('synthetic-'));
  const synth = syntheticMonth();
  const live = (await store().get<Bucket>('metrics:teachback')) ?? {};
  const letters = (await store().list<{ read: number; booked: number }>('letter:')).map((x) => x.value);

  const caseStats = (cs: CaseLike[]) => {
    const contacted = cs.filter((c) => c.firstContactAt);
    const hrs = contacted.map((c) => (c.firstContactAt! - c.createdAt) / 3_600_000).sort((a, b) => a - b);
    const nb = noisy(cs.length);
    return {
      booked: nb < MIN_CELL ? { value: null, suppressed: true } : { value: nb, suppressed: false },
      contacted: cell(contacted.length),
      overdue: cell(cs.filter((c) => !c.firstContactAt && c.status !== 'withdrawn' && c.dueBy < Date.now()).length),
      referred: cell(cs.filter((c) => c.referral).length),
      withdrawn: cell(cs.filter((c) => c.status === 'withdrawn').length),
      // Medians can't be noised safely with this budget, so only the synthetic month shows one.
      medianHoursToFirstContact: charging ? null : hrs.length >= MIN_CELL ? Math.max(1, Math.round(hrs[Math.floor(hrs.length / 2)] / 4) * 4) : null,
      withinTarget: ((d) => (d >= MIN_CELL ? Math.min(1, noisy(contacted.filter((c) => c.firstContactAt! <= c.dueBy).length) / d) : null))(noisy(contacted.length)),
      arabicShare: nb >= MIN_CELL ? Math.min(1, noisy(cs.filter((c) => c.language === 'ar').length) / nb) : null,
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
  const fam = (ls: { read: number; booked: number }[]) => ({ notes: cell(ls.length), readShared: cell(ls.filter((l) => l.read > 0).length), booked: cell(ls.reduce((a, l) => a + l.booked, 0)) });
  const liveCounselling = caseStats(cases), liveViews = views(live), liveFamily = fam(letters);
  charging = false;
  const release = {
    week,
    counselling: { live: liveCounselling, seededSynthetic: caseStats(synth.cases) },
    understanding: { live: liveViews, seededSynthetic: views(syntheticTeachBack()) },
    family: { live: liveFamily, seededSynthetic: fam(synth.letters) },
    neverCounted: ['marriages', 'individual results', 'which couples are at increased chance'],
  };
  const releases = await store().incr('metrics:releases', 60 * 60 * 24 * 365);
  return { ...release, privacy: { epsilonPerCount: Number(EPS.toFixed(3)), epsilonThisRelease: Number(spent.toFixed(2)), epsilonCumulative: Number((releases * EPS_RELEASE).toFixed(1)), releases, minimumCell: MIN_CELL, refreshed: 'weekly; repeated requests return the same release' } };
}

export async function GET() {
  await connection();
  const week = Math.floor(Date.now() / WEEK);
  const key = `metrics:release:w${week}`;
  let r = await store().get<Awaited<ReturnType<typeof compute>>>(key);
  if (!r) {
    r = await compute(week);
    await store().putNew(key, r, 60 * 60 * 24 * 14);
    r = (await store().get<typeof r>(key)) ?? r; // whoever wrote first wins, everyone serves the same
  }
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
