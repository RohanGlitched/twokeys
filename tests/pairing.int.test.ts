// End-to-end over HTTP: two "phones" sign in and pair through the real lab and relay routes.
// Runs only when BASE is set (e.g. BASE=http://localhost:3410 npx vitest run tests/pairing.int.test.ts).
import { describe, expect, it } from 'vitest';
import { checkWords, demoSignIn, linkFragment, newLink, parseFragment, runInitiator, runResponder, sessionId, type Step } from '../src/lib/pairing';

const BASE = process.env.BASE;
const as = (person: string) => demoSignIn(person, BASE);

describe.skipIf(!BASE)('pairing over the real routes', () => {
  it('Mariam and Saeed learn only CYP21A2, and the lab agrees', async () => {
    const link = newLink();
    const theirLink = parseFragment('#' + linkFragment(link))!;
    expect(checkWords(link, 'en')).toEqual(checkWords(theirLink, 'en'));
    const steps: Step[] = [];
    const [ia, ib] = await Promise.all([as('mariam'), as('saeed')]);
    const [a, b] = await Promise.all([
      runInitiator({ identity: ia, link, base: BASE, onStep: (s) => steps.push(s) }),
      runResponder({ identity: ib, link: theirLink, base: BASE }),
    ]);
    expect(a.genes).toEqual([{ gene: 'CYP21A2', inheritance: 'AR', strength: 2 }]);
    expect(b.genes).toEqual(a.genes);
    expect(a.agrees && b.agrees).toBe(true);
    expect(steps.filter((s) => s.kind === 'sent')).toHaveLength(2);
    expect(steps.some((s) => s.kind === 'proof')).toBe(true);
  }, 60_000);

  it('Hessa and Rashid: HBB severe x severe, GJB2 mild x severe, her G6PD stays personal', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('hessa'), as('rashid')]);
    const [a, b] = await Promise.all([
      runInitiator({ identity: ia, link, base: BASE }),
      runResponder({ identity: ib, link, base: BASE }),
    ]);
    expect(a.genes).toEqual([{ gene: 'GJB2', inheritance: 'AR', strength: 1 }, { gene: 'HBB', inheritance: 'AR', strength: 2 }]);
    expect(a.personal).toBe(1);
    expect(b.personal).toBe(0);
  }, 60_000);

  it('Latifa and Ahmed: two milder GJB2 changes are a low-concern match', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('latifa'), as('ahmed')]);
    const [a] = await Promise.all([
      runInitiator({ identity: ia, link, base: BASE }),
      runResponder({ identity: ib, link, base: BASE }),
    ]);
    expect(a.genes).toEqual([{ gene: 'GJB2', inheritance: 'AR', strength: 0 }]);
  }, 60_000);

  it('a third person cannot take a seat', async () => {
    const link = newLink();
    const [ia, ib, ic] = await Promise.all([as('noura'), as('khalid'), as('rashid')]);
    await Promise.all([
      runInitiator({ identity: ia, link, base: BASE }),
      runResponder({ identity: ib, link, base: BASE }),
    ]);
    await expect(runResponder({ identity: ic, link, base: BASE, timeoutMs: 2000 })).rejects.toThrow(/seat/);
  }, 60_000);

  it('full disclosure only when both partners choose it', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('noura'), as('khalid')]);
    await Promise.all([runInitiator({ identity: ia, link, base: BASE }), runResponder({ identity: ib, link, base: BASE })]);
    const share = (identity: string, role: 'A' | 'B') => fetch(`${BASE}/api/lab/share`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), role }) }).then((r) => r.json());
    expect(await share(ia, 'A')).toEqual({ waiting: true });
    const b = await share(ib, 'B');
    expect(b.waiting).toBe(false);
    expect(b.findings.map((f: { gene: string }) => f.gene)).toEqual(['ABCA4']);
    expect((await share(ia, 'A')).findings.map((f: { gene: string }) => f.gene)).toEqual(['USH2A', 'HBA2']);
  }, 60_000);

  it('two people racing for the same seat: exactly one gets it', async () => {
    const link = newLink();
    const [ia, ib, ic] = await Promise.all([as('mariam'), as('saeed'), as('rashid')]);
    const take = (identity: string) => fetch(`${BASE}/api/lab/tokens`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), role: 'B' }) }).then((r) => r.status);
    const statuses = await Promise.all([take(ib), take(ic)]);
    expect(statuses.sort()).toEqual([200, 409]);
    void ia;
  }, 60_000);

  it('nothing is named until both people confirm each other', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('mariam'), as('saeed')]);
    const post = (path: string, identity: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), ...body }) }).then((r) => r.json());
    await post('/api/lab/tokens', ia, { role: 'A' });
    await post('/api/lab/tokens', ib, { role: 'B' });
    // A seated person asking straight away, before any confirmation, learns nothing.
    expect(await post('/api/lab/reveal', ib, { role: 'B', matched: [] })).toEqual({ waiting: true });
    const who = await post('/api/lab/confirm', ib, { role: 'B' });
    expect(who.partner.name.en).toBe('Mariam');
    expect(await post('/api/lab/reveal', ib, { role: 'B', matched: [] })).toEqual({ waiting: true });
  }, 60_000);

  it('a person who doesn’t recognise who joined can stop', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('noura'), as('khalid')]);
    const results = await Promise.allSettled([
      runInitiator({ identity: ia, link, base: BASE, timeoutMs: 8000, confirmPartner: async () => false }),
      runResponder({ identity: ib, link, base: BASE, timeoutMs: 8000 }),
    ]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
  }, 60_000);

  it('the lab refuses tokens without a signed identity', async () => {
    const r = await fetch(`${BASE}/api/lab/tokens`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: 'a'.repeat(64), role: 'A' }) });
    expect(r.status).toBe(401);
  });
});
