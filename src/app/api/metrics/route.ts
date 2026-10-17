// Programme metrics. Phones send only anonymous teach-back totals (signed-in people, rate-limited);
// everything else is counted from desk and family-note records.
// Privacy: one release per hour, cached, so repeated queries can't average the noise away. Every
// count gets Laplace noise (ε = 1 per count; the release's total budget is reported); a rate or
// median is published only when its noisy denominator is at least 5, and medians are coarsened.
// Synthetic seeded responses are kept separate from live ones and labelled.
import { listCases, type DeskCase } from '@/lib/desk';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';
import { seedDesk } from '@/lib/seed';
import { rng } from '@/lib/sim';

const TTL = 60 * 60 * 24 * 90;
const EPS = 1;
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

function laplace(r: () => number) {
  const u = r() - 0.5;
  return -(1 / EPS) * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
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

async function compute(hour: number) {
  await seedDesk();
  const r = rng(hour);
  // Only counts over live records spend privacy budget; the synthetic month describes nobody.
  let spent = 0, charging = true;
  const noisy = (n: number) => { if (charging) spent += EPS; return Math.max(0, Math.round(n + laplace(r))); };
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
      medianHoursToFirstContact: hrs.length >= MIN_CELL ? Math.max(1, Math.round(hrs[Math.floor(hrs.length / 2)] / 4) * 4) : null,
      withinTarget: contacted.length >= MIN_CELL ? Math.min(1, noisy(contacted.filter((c) => c.firstContactAt! <= c.dueBy).length) / Math.max(1, noisy(contacted.length))) : null,
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
    hour,
    counselling: { live: liveCounselling, seededSynthetic: caseStats(synth.cases) },
    understanding: { live: liveViews, seededSynthetic: views(syntheticTeachBack()) },
    family: { live: liveFamily, seededSynthetic: fam(synth.letters) },
    neverCounted: ['marriages', 'individual results', 'which couples are at increased chance'],
  };
  return { ...release, privacy: { epsilonPerCount: EPS, epsilonThisRelease: spent, minimumCell: MIN_CELL, refreshed: 'hourly; repeated requests return the same release' } };
}

export async function GET() {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `metrics:release:${hour}`;
  let r = await store().get<Awaited<ReturnType<typeof compute>>>(key);
  if (!r) {
    r = await compute(hour);
    await store().putNew(key, r, 7200);
    r = (await store().get<typeof r>(key)) ?? r; // whoever wrote first wins, everyone serves the same
  }
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
