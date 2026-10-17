// Programme metrics. Phones send only anonymous teach-back totals; everything else is counted from
// the desk and family-note records. The health system sees counts with small cells suppressed and
// Laplace noise added (differential privacy), never a person.
import { listCases } from '@/lib/desk';
import { store } from '@/lib/store';
import { seedDesk } from '@/lib/seed';

const TTL = 60 * 60 * 24 * 90;
interface TB { n: number; correct: number; all3: number }
type Bucket = Record<string, TB>; // key: `${lang}:${level}:${kind}`

export async function POST(req: Request) {
  let b: { kind?: string; lang?: string; level?: string; correct?: number };
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const lang = b.lang === 'ar' ? 'ar' : 'en';
  const level = ['simple', 'standard', 'detailed'].includes(b.level ?? '') ? b.level! : 'standard';
  const kind = b.kind === 'none' ? 'none' : 'shared';
  const correct = Math.max(0, Math.min(3, Math.round(Number(b.correct) || 0)));
  const db = store();
  const all = (await db.get<Bucket>('metrics:teachback')) ?? {};
  const k = `${lang}:${level}:${kind}`;
  const cur = all[k] ?? { n: 0, correct: 0, all3: 0 };
  all[k] = { n: cur.n + 1, correct: cur.correct + correct, all3: cur.all3 + (correct === 3 ? 1 : 0) };
  await db.put('metrics:teachback', all, TTL);
  return Response.json({ ok: true });
}

/** Laplace noise with scale 1/ε for counting queries (sensitivity 1). */
function laplace(epsilon: number) {
  const u = Math.random() - 0.5;
  return -(1 / epsilon) * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}
const EPS = 1;
const MIN_CELL = 5;
function release(n: number) {
  const noisy = Math.max(0, Math.round(n + laplace(EPS)));
  return noisy < MIN_CELL ? { value: null, suppressed: true } : { value: noisy, suppressed: false };
}

export async function GET() {
  await seedDesk();
  const cases = await listCases();
  const tb = (await store().get<Bucket>('metrics:teachback')) ?? {};
  const letters = await store().list<{ opened: number; booked: number }>('letter:');
  const contacted = cases.filter((c) => c.firstContactAt);
  const hoursToContact = contacted.map((c) => (c.firstContactAt! - c.createdAt) / 3_600_000).sort((a, b) => a - b);
  const median = hoursToContact.length ? hoursToContact[Math.floor(hoursToContact.length / 2)] : null;
  const referred = cases.filter((c) => c.referral);
  const daysToReferral = referred.map((c) => (c.referral!.at - c.createdAt) / 86_400_000).sort((a, b) => a - b);

  const byLang = (lang: 'en' | 'ar') => {
    const rows = Object.entries(tb).filter(([k]) => k.startsWith(`${lang}:`)).map(([, v]) => v);
    const n = rows.reduce((a, r) => a + r.n, 0), all3 = rows.reduce((a, r) => a + r.all3, 0), correct = rows.reduce((a, r) => a + r.correct, 0);
    return { people: release(n), allThreeRight: n >= MIN_CELL ? all3 / n : null, meanCorrect: n >= MIN_CELL ? correct / n : null };
  };
  const byLevel = (level: string) => {
    const rows = Object.entries(tb).filter(([k]) => k.split(':')[1] === level).map(([, v]) => v);
    const n = rows.reduce((a, r) => a + r.n, 0), all3 = rows.reduce((a, r) => a + r.all3, 0);
    return { people: release(n), allThreeRight: n >= MIN_CELL ? all3 / n : null };
  };

  return Response.json({
    privacy: { epsilon: EPS, minimumCell: MIN_CELL, note: 'Counts carry Laplace noise (ε = 1); cells under 5 are suppressed. Rates are shown only for cells of 5 or more.' },
    counselling: {
      booked: release(cases.length),
      contacted: release(contacted.length),
      overdue: release(cases.filter((c) => !c.firstContactAt && c.status !== 'withdrawn' && c.dueBy < Date.now()).length),
      withdrawn: release(cases.filter((c) => c.status === 'withdrawn').length),
      medianHoursToFirstContact: median,
      referred: release(referred.length),
      medianDaysToReferral: daysToReferral.length ? daysToReferral[Math.floor(daysToReferral.length / 2)] : null,
      arabicShare: cases.length >= MIN_CELL ? cases.filter((c) => c.language === 'ar').length / cases.length : null,
    },
    understanding: { en: byLang('en'), ar: byLang('ar'), simple: byLevel('simple'), standard: byLevel('standard'), detailed: byLevel('detailed') },
    family: {
      notes: release(letters.length),
      opened: release(letters.reduce((a, l) => a + (l.value.opened > 0 ? 1 : 0), 0)),
      booked: release(letters.reduce((a, l) => a + l.value.booked, 0)),
    },
    neverCounted: ['marriages', 'individual results', 'which couples are at risk'],
  }, { headers: { 'cache-control': 'no-store' } });
}
