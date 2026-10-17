// Synthetic desk history, so a judge opening the desk sees a working queue: cases of different
// ages, one overdue, one referred, one withdrawn. Created once per store; clearly marked synthetic.
import 'server-only';
import { audit, saveCase, twoWorkingDaysFrom, type DeskCase } from './desk';
import { store } from './store';

const H = 3_600_000;

function mk(id: string, hoursAgo: number, p: { id: string; name: string; sex: 'F' | 'M' }, genes: string[], extra: Partial<DeskCase>): DeskCase {
  const at = Date.now() - hoursAgo * H;
  const c: DeskCase = {
    id, createdAt: at, pairing: null, person: p, language: 'ar', readingLevel: 'standard',
    consent: { sharedGenes: true, ownResults: false, relationship: true }, sharedGenes: genes, ownFindings: null,
    relationship: 'first-cousins', status: 'new', dueBy: twoWorkingDaysFrom(at), firstContactAt: null, referral: null, notes: [], audit: [],
    ...extra,
  };
  audit(c, `person:${p.id}`, 'booked (synthetic history)', at);
  return c;
}

export async function seedDesk() {
  if (!(await store().putNew('seeded:desk:v1', true, 60 * 60 * 24 * 60))) return;
  const cases: DeskCase[] = [
    mk('s1a2b3c4', 2, { id: 'synthetic-amna', name: 'Amna (synthetic)', sex: 'F' }, ['HBB'], { relationship: 'first-cousins', pairing: 'synthpair0000001' }),
    mk('s5d6e7f8', 3, { id: 'synthetic-sultan', name: 'Sultan (synthetic)', sex: 'M' }, ['HBB'], { relationship: 'first-cousins', pairing: 'synthpair0000001', language: 'en' }),
    mk('s9a8b7c6', 80, { id: 'synthetic-maitha', name: 'Maitha (synthetic)', sex: 'F' }, ['CYP21A2', 'ABCA4'], { relationship: 'double-first-cousins', readingLevel: 'simple' }),
    mk('s1f2e3d4', 30, { id: 'synthetic-obaid', name: 'Obaid (synthetic)', sex: 'M' }, ['MEFV'], { relationship: null, consent: { sharedGenes: true, ownResults: true, relationship: false },
      ownFindings: [{ gene: 'MEFV', inheritance: 'AR', severity: 'severe' }, { gene: 'GJB2', inheritance: 'AR', severity: 'mild' }] }),
    mk('s7c7c7c7', 140, { id: 'synthetic-shamma', name: 'Shamma (synthetic)', sex: 'F' }, ['SMN1'], { relationship: 'unrelated', language: 'en' }),
  ];
  // Give the older cases a history.
  const referred = cases[4];
  referred.firstContactAt = referred.createdAt + 20 * H;
  referred.status = 'referred';
  referred.referral = { service: 'Reproductive genetics clinic (PGT-M), Thiqa-covered', at: referred.createdAt + 50 * H };
  audit(referred, 'counsellor:Dr. Fatima (synthetic)', 'marked contacted', referred.firstContactAt);
  audit(referred, 'counsellor:Dr. Fatima (synthetic)', `referred to ${referred.referral.service}`, referred.referral.at);
  referred.notes.push({ at: referred.createdAt + 21 * H, by: 'Dr. Fatima (synthetic)', text: 'Explained SMN1 copy-number testing; couple wants to learn about PGT-M before deciding.' });
  const contacted = cases[3];
  contacted.firstContactAt = contacted.createdAt + 6 * H;
  contacted.status = 'contacted';
  audit(contacted, 'counsellor:Dr. Yousef (synthetic)', 'marked contacted', contacted.firstContactAt);
  for (const c of cases) await saveCase(c);
}
