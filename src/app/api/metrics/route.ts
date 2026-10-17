// Programme metrics. Phones send only anonymous teach-back totals (signed-in people); everything else
// is counted from desk and family-note records.
// Privacy, per person per calendar year:
// - Each person counts once a year: their first teach-back and first booking of the year, and only their
//   first LETTER_CAP family notes of the year (each note count is noised for that many). The markers that
//   enforce this are keyed by a pseudonym whose key rotates every UTC year (identity.pseudonym) and expire
//   when the year ends (dp.untilYearEnd), so no permanent per-person trace outlives a withdrawal.
// - Every count gets exact discrete Laplace noise at ε = 1/SCALE per unit. A first booking touches 7
//   counts, a first teach-back 4, and all of a person's counted notes together at most 3 counts' worth,
//   so a person's records cost at most ε = 14/SCALE = 2 per year over every release in it; we publish the
//   looser bound EPS_PERSON = 3 per person per year (a release also never holds more than LIVE_COUNTS counts).
// - Each weekly release counts only records from that one week (the last complete week) and is made
//   once: it is written write-once to an append-only ledger (metrics:ledger:w<week>, with its ε and
//   count of noised values), never versioned and never deleted, and every later request serves it.
// - The noise comes from a PRF keyed by the 'dp' subkey over (week, count name), so even if a release
//   were computed twice it would carry the same noise, not a fresh sample to average.
// - Released values are made consistent after noising (a part never exceeds its whole, nothing is
//   negative), which is post-processing and costs no privacy. Rates appear only beside a count that is
//   shown, and are computed from those same noisy counts.
// The synthetic month gets the same noise for realism but describes nobody, so it spends nothing.
// Counsellors see exact queues on the desk; only these published aggregates are noised.
import { listCases, type DeskCase } from '@/lib/desk';
import { needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { subkey } from '@/lib/labkey';
import { store } from '@/lib/store';
import { seedDesk } from '@/lib/seed';
import { rng } from '@/lib/sim';
import { dayStart, FOREVER, noisyCount, prf, untilYearEnd } from '@/lib/dp';
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
  // Only a person's first teach-back of the year is counted (the older per-id marker still counts as done).
  if (await store().get(`tbdone:${p.id}`)) return Response.json({ ok: true, counted: false });
  if (!(await store().putNew(`dp:tb:${pseudonym(p.id)}`, true, untilYearEnd()))) return Response.json({ ok: true, counted: false });
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
  let counts = 0, charging = true, part = 'live';
  const dpKey = subkey('dp');
  const noisy = (name: string, n: number, sensitivity = 1) => {
    if (charging) counts++;
    return noisyCount(n, SCALE, sensitivity, prf(dpKey, `twokeys/v2/release|w${week}|${part}|${name}`));
  };
  const shown = (v: number) => (v < MIN_CELL ? { value: null, suppressed: true } : { value: v, suppressed: false });
  const inWeek = (t: number) => Math.floor(t / WEEK) === week;

  // Each person's first booking ever (marked when booked, for life), if it was made in this week.
  const cases = (await listCases()).filter((c) => c.firstEver && !c.person.id.startsWith('synthetic-') && inWeek(c.createdAt));
  const synth = syntheticMonth();
  const live = await teachBackWeek(week);
  const letters = (await store().list<{ read: number; booked: number; createdAt: number; counted?: boolean }>('letter:')).map((x) => x.value).filter((l) => l.counted !== false && inWeek(l.createdAt));

  const caseStats = (cs: CaseLike[]) => {
    const contacted = cs.filter((c) => c.firstContactAt);
    const hrs = contacted.map((c) => (c.firstContactAt! - c.createdAt) / 3_600_000).sort((a, b) => a - b);
    // Consistency after noising (free): no part exceeds its whole.
    const nb = noisy('booked', cs.length), nc = Math.min(nb, noisy('contacted', contacted.length));
    const within = Math.min(nc, noisy('within', contacted.filter((c) => c.firstContactAt! <= c.dueBy).length)), arabic = Math.min(nb, noisy('arabic', cs.filter((c) => c.language === 'ar').length));
    return {
      booked: shown(nb),
      contacted: shown(nc),
      overdue: shown(Math.min(nb - nc, noisy('overdue', cs.filter((c) => !c.firstContactAt && c.status !== 'withdrawn' && c.dueBy < Date.now()).length))),
      referred: shown(Math.min(nb, noisy('referred', cs.filter((c) => c.referral).length))),
      withdrawn: shown(Math.min(nb, noisy('withdrawn', cs.filter((c) => c.status === 'withdrawn').length))),
      // Medians can't be noised safely with this budget, so only the synthetic month shows one.
      medianHoursToFirstContact: charging ? null : hrs.length >= MIN_CELL ? Math.max(1, Math.round(hrs[Math.floor(hrs.length / 2)] / 4) * 4) : null,
      // Rates only beside a count that is shown, from the same noisy counts.
      withinTarget: nc >= MIN_CELL ? Math.min(1, within / nc) : null,
      arabicShare: nb >= MIN_CELL ? Math.min(1, arabic / nb) : null,
    };
  };
  const tb = (bucket: Bucket, name: string, key: (k: string) => boolean) => {
    const rows = Object.entries(bucket).filter(([k]) => key(k)).map(([, v]) => v);
    const n = noisy(`tb.${name}.n`, rows.reduce((a, x) => a + x.n, 0));
    const all3 = Math.min(n, noisy(`tb.${name}.all3`, rows.reduce((a, x) => a + x.all3, 0)));
    return n < MIN_CELL ? { people: null, allThreeRight: null } : { people: n, allThreeRight: all3 / n };
  };
  const views = (bucket: Bucket) => ({
    ar: tb(bucket, 'ar', (k) => k.startsWith('ar:')), en: tb(bucket, 'en', (k) => k.startsWith('en:')),
    simple: tb(bucket, 'simple', (k) => k.endsWith(':simple')), standard: tb(bucket, 'standard', (k) => k.endsWith(':standard')), detailed: tb(bucket, 'detailed', (k) => k.endsWith(':detailed')),
  });
  // Only a sender's first LETTER_CAP notes ever are counted, so note counts are noised for that many.
  const fam = (ls: { read: number; booked: number }[]) => {
    const notes = noisy('fam.notes', ls.length, LETTER_CAP);
    return {
      notes: shown(notes),
      readShared: shown(Math.min(notes, noisy('fam.readShared', ls.filter((l) => l.read > 0).length, LETTER_CAP))),
      booked: shown(Math.min(notes, noisy('fam.booked', ls.reduce((a, l) => a + Math.min(1, l.booked), 0), LETTER_CAP))),
    };
  };
  const liveCounselling = caseStats(cases), liveViews = views(live), liveFamily = fam(letters);
  charging = false;
  part = 'synthetic';
  if (counts > LIVE_COUNTS) throw new Error('Release would exceed its privacy budget.');
  const release = {
    week,
    counselling: { live: liveCounselling, seededSynthetic: caseStats(synth.cases) },
    understanding: { live: liveViews, seededSynthetic: views(syntheticTeachBack()) },
    family: { live: liveFamily, seededSynthetic: fam(synth.letters) },
    neverCounted: ['marriages', 'individual results', 'which couples are at increased chance'],
  };
  return {
    counts,
    release: {
      ...release,
      privacy: {
        // `epsilonPerPersonLifetime` keeps its name for older readers; it is now a per-person, per-year bound.
        epsilonPerCount: Number((1 / SCALE).toFixed(3)), epsilonThisRelease: Number((counts / SCALE).toFixed(2)), epsilonPerPersonLifetime: EPS_PERSON, epsilonPerPersonPerYear: EPS_PERSON,
        releases: 0, minimumCell: MIN_CELL, letterCap: LETTER_CAP, refreshed: REFRESHED,
      },
    },
  };
}
type Release = Awaited<ReturnType<typeof compute>>['release'];
/** One append-only ledger row per weekly release: what was released and what it spent. Never replaced or deleted. */
interface Ledger { week: number; at: number; counts: number; epsilon: number; release: Release }
const REFRESHED = 'weekly, covering the last complete week; each week is released once, into an append-only ledger, and every request returns that release';

export async function GET() {
  await connection();
  const week = Math.floor(Date.now() / WEEK) - 1; // the last complete week
  const key = `metrics:ledger:w${week}`;
  let entry = await store().get<Ledger>(key);
  if (!entry) {
    // A week already released before the ledger existed is adopted as it was, not noised again.
    const old = await store().get<Release>(`metrics:release:v2:w${week}`);
    const made = old ? { counts: Math.round(old.privacy.epsilonThisRelease * SCALE), release: old } : await compute(week);
    const row: Ledger = { week, at: dayStart(), counts: made.counts, epsilon: Number((made.counts / SCALE).toFixed(2)), release: made.release };
    await store().putNew(key, row, FOREVER); // whoever writes first wins; everyone serves that row
    entry = (await store().get<Ledger>(key)) ?? row;
  }
  const releases = (await store().list('metrics:ledger:')).length;
  const note = await ledgerNote(entry);
  return Response.json({ ...entry.release, privacy: { ...entry.release.privacy, epsilonPerPersonPerYear: EPS_PERSON, releases, refreshed: REFRESHED }, ...(note ? { note } : {}) }, { headers: { 'cache-control': 'no-store' } });
}

/** A part shown larger than its whole (only possible in rows released before consistency checks existed). */
function inconsistent(r: Release): boolean {
  const over = (part: { value: number | null }, whole: { value: number | null }) => part.value !== null && whole.value !== null && part.value > whole.value;
  const f = r.family?.live, c = r.counselling?.live;
  return !!((f && (over(f.readShared, f.notes) || over(f.booked, f.notes)))
    || (c && (over(c.contacted, c.booked) || over(c.referred, c.booked) || over(c.withdrawn, c.booked))));
}
/**
 * The ledger is never rewritten. When a released row is internally inconsistent, a write-once correction
 * note is added beside it (metrics:ledgernote:w<week>) and served with it, so readers are told rather
 * than shown a silently different number.
 */
async function ledgerNote(entry: Ledger): Promise<{ en: string; ar: string } | null> {
  const key = `metrics:ledgernote:w${entry.week}`;
  const have = await store().get<{ en: string; ar: string }>(key);
  if (have || !inconsistent(entry.release)) return have;
  const note = {
    en: 'This week’s figures were released before consistency checks existed, so a part may exceed its whole (for example, notes read above notes sent). The release is kept as published; later weeks are checked.',
    ar: 'نُشرت أرقام هذا الأسبوع قبل إضافة فحوص الاتساق، لذا قد يزيد جزء على مجموعه (مثل رسائل مقروءة أكثر من الرسائل المرسلة). ويبقى الإصدار كما نُشر، وتُفحص الأسابيع اللاحقة.',
  };
  await store().putNew(key, note, FOREVER);
  return (await store().get<{ en: string; ar: string }>(key)) ?? note;
}
