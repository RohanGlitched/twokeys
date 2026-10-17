// Synthetic desk history, so a judge opening the desk sees a working queue: cases of different ages
// and priorities, one overdue, one referred, one with the person's own results and relationship
// shared (so the counsellor-only estimates show). Re-seeded with fresh random ids whenever fewer than
// three seeded cases are still open, so nobody can empty the demo for everyone else.
import 'server-only';
import { audit, dueFor, listCases, saveCase, type DeskCase } from './desk';
import { store } from './store';
import { CONSENT_VERSION } from './desk';

const H = 3_600_000;
const rid = () => 's' + crypto.randomUUID().replace(/-/g, '').slice(0, 9);

function mk(hoursAgo: number, p: { id: string; name: string; sex: 'F' | 'M' }, genes: string[], extra: Partial<DeskCase>): DeskCase {
  const at = Date.now() - hoursAgo * H;
  const priority = extra.priority ?? 'routine';
  const c: DeskCase = {
    id: rid(), createdAt: at, pairing: null, person: p, language: 'ar', readingLevel: 'standard',
    consent: { sharedGenes: true, ownResults: false, relationship: true, version: CONSENT_VERSION }, sharedGenes: genes, ownFindings: null,
    relationship: 'first-cousins', priority, question: null, status: 'new', dueBy: dueFor(priority, at), firstContactAt: null, referral: null,
    notes: [], sealed: false, audit: [],
    ...extra,
  };
  audit(c, `person:${p.id}`, `booked (${priority}) (synthetic history)`, at);
  return c;
}

export async function seedDesk() {
  const open = (await listCases()).filter((c) => c.person.id.startsWith('synthetic-') && c.status !== 'withdrawn' && c.status !== 'closed');
  if (open.length >= 3) return;
  if (!(await store().putNew(`seeding:${Math.floor(Date.now() / 60_000)}`, true, 120))) return; // one seeder at a time
  const pair = 'synthpair' + crypto.randomUUID().replace(/-/g, '').slice(0, 7);
  const cases: DeskCase[] = [
    mk(2, { id: 'synthetic-amna', name: 'Amna (synthetic)', sex: 'F' }, ['HBB'], { pairing: pair, priority: 'pregnant', question: 'We found out today and I am 9 weeks pregnant. What can we do now?' }),
    mk(3, { id: 'synthetic-sultan', name: 'Sultan (synthetic)', sex: 'M' }, ['HBB'], { pairing: pair, language: 'en' }),
    mk(80, { id: 'synthetic-maitha', name: 'Maitha (synthetic)', sex: 'F' }, ['CYP21A2', 'ABCA4'], { relationship: 'double-first-cousins', readingLevel: 'simple',
      consent: { sharedGenes: true, ownResults: true, relationship: true, version: CONSENT_VERSION },
      ownFindings: [{ gene: 'CYP21A2', inheritance: 'AR', severity: 'severe' }, { gene: 'ABCA4', inheritance: 'AR', severity: 'severe' }, { gene: 'HBB', inheritance: 'AR', severity: 'severe' }] }),
    mk(30, { id: 'synthetic-obaid', name: 'Obaid (synthetic)', sex: 'M' }, ['MEFV'], { relationship: null, consent: { sharedGenes: true, ownResults: true, relationship: false, version: CONSENT_VERSION },
      ownFindings: [{ gene: 'MEFV', inheritance: 'AR', severity: 'severe' }, { gene: 'GJB2', inheritance: 'AR', severity: 'mild' }] }),
    mk(140, { id: 'synthetic-shamma', name: 'Shamma (synthetic)', sex: 'F' }, ['SMN1'], { relationship: 'unrelated', language: 'en' }),
  ];
  const referred = cases[4];
  referred.firstContactAt = referred.createdAt + 20 * H;
  referred.status = 'referred';
  referred.referral = { service: 'Reproductive genetics clinic (PGT-M)', at: referred.createdAt + 50 * H };
  referred.notes.push({ at: referred.createdAt + 21 * H, by: 'Dr. Fatima Al Hammadi (synthetic)', text: 'Explained SMN1 copy-number confirmation; couple wants to learn about PGT-M before deciding.' });
  audit(referred, 'counsellor:Dr. Fatima Al Hammadi (synthetic)', 'marked contacted', referred.firstContactAt);
  audit(referred, 'counsellor:Dr. Fatima Al Hammadi (synthetic)', 'added a note', referred.createdAt + 21 * H);
  audit(referred, 'counsellor:Dr. Fatima Al Hammadi (synthetic)', `referred to ${referred.referral.service}`, referred.referral.at);
  const contacted = cases[3];
  contacted.firstContactAt = contacted.createdAt + 6 * H;
  contacted.status = 'contacted';
  audit(contacted, 'counsellor:Dr. Yousef Al Marzouqi (synthetic)', 'marked contacted', contacted.firstContactAt);
  for (const c of cases) await saveCase(c);
}
