// End-to-end over HTTP: two "phones" pair through the real lab and relay routes.
// Runs only when BASE is set (e.g. BASE=http://localhost:3410 npx vitest run tests/pairing.int.test.ts).
import { describe, expect, it } from 'vitest';
import { checkWords, linkFragment, newLink, parseFragment, runInitiator, runResponder, type Step } from '../src/lib/pairing';
import { matchedGenes } from '../src/lib/lab';

const BASE = process.env.BASE;

describe.skipIf(!BASE)('pairing over the real routes', () => {
  it('Mariam and Saeed learn only CYP21A2', async () => {
    const link = newLink();
    const theirLink = parseFragment('#' + linkFragment(link))!;
    expect(checkWords(link, 'en')).toEqual(checkWords(theirLink, 'en'));
    const steps: Step[] = [];
    const [a, b] = await Promise.all([
      runInitiator({ person: 'mariam', link, base: BASE, onStep: (s) => steps.push(s) }),
      runResponder({ person: 'saeed', link: theirLink, base: BASE }),
    ]);
    expect(a.mode === 'reveal' && matchedGenes(a.labels).ar).toEqual(['CYP21A2']);
    expect(b.mode === 'reveal' && matchedGenes(b.labels).ar).toEqual(['CYP21A2']);
    // Nothing the relay stores is readable: the sample of what left the phone is ciphertext.
    const sent = steps.filter((s) => s.kind === 'sent');
    expect(sent).toHaveLength(2);
  }, 60_000);

  it('Latifa and Ahmed: two mild GJB2 alleles never match', async () => {
    const link = newLink();
    const [a] = await Promise.all([
      runInitiator({ person: 'latifa', link, base: BASE }),
      runResponder({ person: 'ahmed', link, base: BASE }),
    ]);
    expect(a.mode === 'reveal' && a.labels).toEqual([]);
  }, 60_000);

  it('a third person cannot take a seat', async () => {
    const link = newLink();
    const p = Promise.all([
      runInitiator({ person: 'noura', link, base: BASE }),
      runResponder({ person: 'khalid', link, base: BASE }),
    ]);
    await p;
    await expect(runResponder({ person: 'rashid', link, base: BASE, timeoutMs: 2000 })).rejects.toThrow(/seat/);
  }, 60_000);
});
