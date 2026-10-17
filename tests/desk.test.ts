// Counsellor clocks: pregnancy with unknown weeks is treated as late; a possible Hb Bart's or SMA match is never left two days.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { dueFor } from '../src/lib/desk';
import { daysTo120, oneIn } from '../src/lib/risk';

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
  it('counts days to day 120 from conception', () => {
    expect(daysTo120(10, MON_9AM, MON_9AM)).toBe(64);
  });
  it('writes "1 من N" in Arabic', () => expect(oneIn(1 / 165, 'ar')).toBe('1 من 165'));
});
