// Counsellor clocks: pregnancy with unknown weeks is treated as late; a possible Hb Bart's, severe HbH or SMA match is never left two days.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dueFor, queue, signUrgent, verifyUrgent, type DeskCase } from '../src/lib/desk';
import { checkLetter, letterFor, naturalFrequency } from '../src/lib/letters';
import { daysTo120, daysTo120Lmp, oneIn } from '../src/lib/risk';

const MON_9AM = Date.UTC(2026, 9, 19, 5, 0); // Monday 19 Oct 2026, 09:00 Gulf time
const H = 3_600_000;

describe('desk clocks', () => {
  it('pregnancy: 4 hours when weeks are unknown or from week 9; otherwise 1 working day', () => {
    expect(dueFor('pregnant', MON_9AM, null)).toBe(MON_9AM + 4 * H);
    expect(dueFor('pregnant', MON_9AM, 12)).toBe(MON_9AM + 4 * H);
    expect(dueFor('pregnant', MON_9AM, 6)).toBeGreaterThan(MON_9AM + 4 * H);
  });
  it('a serious match shortens the routine clock to 1 working day', () => {
    expect(dueFor('routine', MON_9AM, null, true)).toBe(dueFor('pregnant', MON_9AM, 6));
    expect(dueFor('routine', MON_9AM, null, true)).toBeLessThan(dueFor('routine', MON_9AM, null));
  });
  it('possible Bart’s or severe HbH: 1 working day without a pregnancy, same day in any pregnancy', () => {
    expect(dueFor('routine', MON_9AM, null, 'hydrops')).toBe(dueFor('routine', MON_9AM, null, true));
    expect(dueFor('pregnant', MON_9AM, 6, 'hydrops')).toBe(MON_9AM + 4 * H);
  });
  it('counts days to day 120 from conception, and from the last period two weeks sooner', () => {
    expect(daysTo120(10, MON_9AM, MON_9AM)).toBe(64);
    expect(daysTo120Lmp(10, MON_9AM, MON_9AM)).toBe(50);
  });
  it('writes "1 من N" in Arabic', () => expect(oneIn(1 / 165, 'ar')).toBe('1 من 165'));
});

const mk = (id: string, extra: Partial<DeskCase>): DeskCase => ({
  id, createdAt: MON_9AM, pairing: null, person: { id, name: id, sex: 'F' }, language: 'en', readingLevel: 'standard',
  consent: { sharedGenes: true, ownResults: false, relationship: false, version: 'v' }, sharedGenes: [], ownFindings: null, relationship: null,
  priority: 'routine', question: null, status: 'new', dueBy: dueFor('routine', MON_9AM), firstContactAt: null, referral: null, notes: [], sealed: false, audit: [], ...extra,
});

describe('desk queue', () => {
  it('never shows the exact due time, only overdue / due today / later, and pins synthetic history first', () => {
    const items = queue([
      mk('routine', {}),
      mk('preg', { priority: 'pregnant', pregnancyWeeks: 6, dueBy: dueFor('pregnant', MON_9AM, 6) }),
      mk('late', { dueBy: MON_9AM - H }),
      mk('synthetic-amna', {}),
    ], MON_9AM + H);
    for (const x of items) expect(x).not.toHaveProperty('dueBy');
    expect(items[0].id).toBe('synthetic-amna');
    expect(items[0].pinned).toBe(true);
    const by = Object.fromEntries(items.map((x) => [x.id, x]));
    expect(by.late.due).toBe('overdue');
    expect(by.late.overdue).toBe(true);
    expect(by.preg.due).toBe('later');
    expect(by.routine.due).toBe('later');
    expect(items.map((x) => x.rank)).toEqual([0, 1, 2, 3]);
  });
});

describe('the same-day flag from the explainer', () => {
  it('verifies for that person only', () => {
    const sig = signUrgent('mariam');
    expect(verifyUrgent('mariam', sig)).toBe(true);
    expect(verifyUrgent('saeed', sig)).toBe(false);
    expect(verifyUrgent('mariam', '0'.repeat(64))).toBe(false);
    expect(verifyUrgent('mariam', undefined)).toBe(false);
  });
});

describe('family letters', () => {
  it('rebuilds a letter from its facts and ignores the numbers inside it', () => {
    const forged = { ...letterFor('HBB', 'sibling', 'en'), chance: 0.01, population: 0.9 };
    const shown = checkLetter(forged)!;
    expect(shown.chance).toBe(letterFor('HBB', 'sibling', 'en').chance);
    expect(shown.population).toBe(letterFor('HBB', 'sibling', 'en').population);
  });
  it('refuses a note that isn’t version 2, names no panel gene, or gets the inheritance or relation wrong', () => {
    expect(checkLetter({ ...letterFor('HBB', 'sibling', 'en'), v: 1 })).toBeNull();
    expect(checkLetter({ ...letterFor('HBB', 'sibling', 'en'), gene: 'NOTAGENE' })).toBeNull();
    expect(checkLetter({ ...letterFor('G6PD', 'sibling', 'en', 'XL'), inheritance: 'AR' })).toBeNull();
    expect(checkLetter({ ...letterFor('HBB', 'sibling', 'en'), relation: 'spouse' })).toBeNull();
    expect(checkLetter({ ...letterFor('HBB', 'sibling', 'en'), lang: 'fr' })).toBeNull();
    expect(checkLetter('not a letter')).toBeNull();
  });
  it('says the chance the way the sender’s preview does', () => {
    expect(naturalFrequency(letterFor('HBB', 'sibling', 'en').chance!, 'en')).toBe('about 1 in 2');
    expect(naturalFrequency(1 / 8.2, 'ar')).toBe('نحو 1 من كل 8');
  });
});
