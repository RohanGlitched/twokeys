// End-to-end over HTTP: two "phones" sign in and pair through the real lab and relay routes.
// Runs only when BASE is set (e.g. BASE=http://localhost:3410 npx vitest run tests/pairing.int.test.ts).
import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { labTagged, noteDigest } from '../src/lib/letters';
import { checkWords, demoSignIn, linkFragment, newLink, parseFragment, runInitiator, runResponder, sessionId, type Step } from '../src/lib/pairing';

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));

const BASE = process.env.BASE;
const as = (person: string) => demoSignIn(person, BASE);

// Node's fetch reuses keep-alive sockets the server may already have closed; a browser retries those by
// itself, Node doesn't. Retry once, only for a socket that was reset before any response (the request
// never reached the server), so the tests measure the app, not the test client's connection pool.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  try {
    return await realFetch(input, init);
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return realFetch(input, init);
    throw e;
  }
}) as typeof fetch;

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
    expect(a.genes).toEqual([{ gene: 'GJB2', inheritance: 'AR', strength: 1 }, { gene: 'HBB', inheritance: 'AR', strength: 2, kind: 'hplc' }]);
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
    await expect(runResponder({ identity: ic, link, base: BASE, timeoutMs: 2000 })).rejects.toMatchObject({ code: 'seat_taken', message: expect.stringMatching(/seat/) });
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

  it('no tokens, and no name for the joiner, until both people confirm each other', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('mariam'), as('saeed')]);
    const post = (path: string, identity: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), ...body }) }).then((r) => r.json());
    expect(await post('/api/lab/tokens', ia, { role: 'A' })).toEqual({ waiting: true });
    expect(await post('/api/lab/tokens', ib, { role: 'B' })).toEqual({ waiting: true });
    // Whoever holds the joiner's seat (perhaps someone who photographed the link) learns no name yet.
    expect(await post('/api/lab/confirm', ib, { role: 'B' })).toEqual({ waiting: true });
    // The link's creator sees the joiner and confirms.
    expect((await post('/api/lab/confirm', ia, { role: 'A', ok: true })).partner.name.en).toBe('Saeed');
    expect((await post('/api/lab/confirm', ib, { role: 'B' })).partner.name.en).toBe('Mariam');
    // Still nothing issued until the joiner confirms too.
    expect(await post('/api/lab/tokens', ia, { role: 'A' })).toEqual({ waiting: true });
    await post('/api/lab/confirm', ib, { role: 'B', ok: true });
    const t = await post('/api/lab/tokens', ib, { role: 'B' });
    expect(t.tokens).toHaveLength(64);
    // Asking again gives the identical list.
    expect((await post('/api/lab/tokens', ib, { role: 'B' })).tokens).toEqual(t.tokens);
  }, 60_000);

  it('a phone that skips the comparison gets nothing named', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('mariam'), as('saeed')]);
    const post = (path: string, identity: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), ...body }) }).then((r) => r.json());
    await post('/api/lab/tokens', ia, { role: 'A' });
    await post('/api/lab/tokens', ib, { role: 'B' });
    await post('/api/lab/confirm', ia, { role: 'A', ok: true });
    await post('/api/lab/confirm', ib, { role: 'B', ok: true });
    await post('/api/lab/reveal', ia, { role: 'A', matched: [] });
    const r = await post('/api/lab/reveal', ib, { role: 'B', matched: [] });
    expect(r.agrees).toBe(false);
    expect(r.genes).toEqual([]);
  }, 60_000);

  it('booking before reveal names nothing; after an agreed reveal the case gets the lab’s genes', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('mariam'), as('saeed')]);
    const post = (path: string, identity: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), ...body }) }).then((r) => r.json());
    const book = (identity: string, role: 'A' | 'B') => fetch(`${BASE}/api/desk/cases`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ pairing: sessionId(link), role }) });
    // The desk passcode is "counsellor" on a local server without DESK_PASSCODE; pass DESK_PASSCODE otherwise.
    const desk = (id: string) => fetch(`${BASE}/api/desk/cases/${id}`, { headers: { 'x-desk': process.env.DESK_PASSCODE ?? 'counsellor', 'x-desk-user': encodeURIComponent('Judge (demo)') } }).then((r) => r.json());
    const withdraw = (id: string, identity: string) => fetch(`${BASE}/api/desk/cases/${id}`, { method: 'DELETE', headers: { 'x-person': identity } });
    // One open case per person: clear anything a demo visitor left open for these two first.
    await Promise.all([[ia, 'A'], [ib, 'B']].map(async ([identity, role]) => {
      const j = await (await book(identity, role as 'A' | 'B')).json(); // a new case, or the 409 naming the open one
      if (j.id) await withdraw(j.id, identity);
    }));
    await post('/api/lab/tokens', ia, { role: 'A' });
    await post('/api/lab/tokens', ib, { role: 'B' });
    await post('/api/lab/confirm', ia, { role: 'A', ok: true });
    await post('/api/lab/confirm', ib, { role: 'B', ok: true });
    // Seated and confirmed, but no comparison yet: the booking names nothing, and the receipt never names genes.
    const early = await book(ia, 'A');
    expect(early.status).toBe(200);
    const e = await early.json();
    expect(e).not.toHaveProperty('sharedGenes');
    const seenEarly = await desk(e.id);
    expect(seenEarly.case.sharedGenes).toEqual([]);
    expect(seenEarly.case.pairing).toBeNull();
    // One open request per person, and the refusal says which case is open.
    const again = await book(ia, 'A');
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'open_case', id: e.id });
    // The phones compare, the lab agrees, and only then does a booking carry the genes it released.
    await Promise.all([runInitiator({ identity: ia, link, base: BASE }), runResponder({ identity: ib, link, base: BASE })]);
    const late = await (await book(ib, 'B')).json();
    expect(late).not.toHaveProperty('sharedGenes');
    const seenLate = await desk(late.id);
    expect(seenLate.case.sharedGenes).toEqual(['CYP21A2']);
    expect(seenLate.case.partnerBooked).toBe(true);
    await Promise.all([withdraw(e.id, ia), withdraw(late.id, ib)]);
  }, 60_000);

  it('a person who doesn’t recognise who joined can stop', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('noura'), as('khalid')]);
    const results = await Promise.allSettled([
      runInitiator({ identity: ia, link, base: BASE, timeoutMs: 8000, confirmPartner: async () => false }),
      runResponder({ identity: ib, link, base: BASE, timeoutMs: 8000 }),
    ]);
    expect(results[0]).toMatchObject({ status: 'rejected', reason: { code: 'declined' } });
    // The joiner is told at once that the comparison was stopped, rather than waiting for a timeout.
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'stopped' } });
  }, 60_000);

  it('a creator’s no frees the seat: the rejected person can’t sit again, the right partner can', async () => {
    const link = newLink();
    const [ia, ix, ib] = await Promise.all([as('noura'), as('rashid'), as('khalid')]);
    const post = (path: string, identity: string, body: object) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session: sessionId(link), ...body }) });
    await post('/api/lab/tokens', ia, { role: 'A' });
    await post('/api/lab/tokens', ix, { role: 'B' });
    expect((await post('/api/lab/confirm', ia, { role: 'A', ok: false })).status).toBe(200);
    expect(await (await post('/api/lab/confirm', ix, { role: 'B' })).json()).toMatchObject({ code: 'stopped' });
    expect(await (await post('/api/lab/tokens', ix, { role: 'B' })).json()).toMatchObject({ code: 'stopped' });
    expect(await (await post('/api/lab/tokens', ib, { role: 'B' })).json()).toEqual({ waiting: true });
    expect((await (await post('/api/lab/confirm', ia, { role: 'A', ok: true })).json()).partner.name.en).toBe('Khalid');
  }, 60_000);

  it('a cancel mid-way tells the other phone through the relay', async () => {
    const link = newLink();
    const [ia, ib] = await Promise.all([as('noura'), as('khalid')]);
    const ac = new AbortController();
    const steps: Step[] = [];
    const a = runInitiator({ identity: ia, link, base: BASE, signal: ac.signal, onStep: (s) => { if (s.kind === 'waiting' && s.for === 'm2') ac.abort(); } });
    const b = runResponder({ identity: ib, link, base: BASE, timeoutMs: 20_000, onStep: (s) => steps.push(s) });
    // B may finish m2 before A notices the abort; either way B never gets a result and is told it was stopped.
    const [ra, rb] = await Promise.allSettled([a, b]);
    expect(ra).toMatchObject({ status: 'rejected', reason: { code: 'cancelled' } });
    expect(rb).toMatchObject({ status: 'rejected', reason: { code: 'stopped' } });
    expect(steps.some((s) => s.kind === 'stopped' && s.by === 'partner')).toBe(true);
  }, 60_000);

  it('the relay refuses writes without the link’s write key', async () => {
    const link = newLink();
    const put = (body: object) => fetch(`${BASE}/api/relay/${link.box}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot: 'm1', c: 'AAAA', ...body }) });
    const r = await put({});
    expect(r.status).toBe(403);
    expect(await r.json()).toMatchObject({ code: 'write_denied' });
    expect((await put({ w: 'ab'.repeat(32) })).status).toBe(403);
    expect((await fetch(`${BASE}/api/relay/${link.box}?slot=hello`)).status).toBe(400);
  });

  it('a self-declared same-day booking counts once a day; more fall back to the normal clock', async () => {
    const ih = await as('hessa');
    const book = () => fetch(`${BASE}/api/desk/cases`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': ih }, body: JSON.stringify({ priority: 'urgent', urgentSig: '0'.repeat(64) }) });
    const withdraw = (id: string) => fetch(`${BASE}/api/desk/cases/${id}`, { method: 'DELETE', headers: { 'x-person': ih } });
    // A case a demo visitor left open is withdrawn first (one open case per person).
    const fresh = async () => { let r = await book(); if (r.status === 409) { await withdraw((await r.json()).id); r = await book(); } return r.json(); };
    const f = await fresh();
    await withdraw(f.id);
    const second = await fresh();
    expect(second.priority).toBe('routine');
    await withdraw(second.id);
  }, 60_000);

  it('a new family note needs its acknowledgement hash, and no response is cached', async () => {
    const ih = await as('hessa');
    const nonce = hexOf(crypto.getRandomValues(new Uint8Array(16)));
    const send = (body: object) => fetch(`${BASE}/api/family`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': ih }, body: JSON.stringify({ c: 'AAAA', gene: 'HBB', relation: 'sibling', nonce, ...body }) });
    const bare = await send({});
    expect(bare.status).toBe(400);
    expect(bare.headers.get('cache-control')).toBe('no-store');
    const ok = await send({ ack: 'ab'.repeat(32) });
    expect(ok.status).toBe(200); // a fresh visitor id each sign-in: no cap shared with other visitors
    expect(ok.headers.get('cache-control')).toBe('no-store');
    const { id, manage } = await ok.json();
    expect((await fetch(`${BASE}/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'read' }) })).status).toBe(403);
    await fetch(`${BASE}/api/family/${id}`, { method: 'DELETE', headers: { 'x-manage': manage } });
  }, 60_000);

  it('a family note only for a gene the lab found in the sender, signed over its checked facts', async () => {
    const iN = await as('noura'); // carries ABCA4 only
    const nonce = hexOf(crypto.getRandomValues(new Uint8Array(16)));
    const token = hexOf(crypto.getRandomValues(new Uint8Array(32)));
    const ack = hexOf(sha256(new TextEncoder().encode(token)));
    const send = (gene: string) => fetch(`${BASE}/api/family`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': iN }, body: JSON.stringify({ c: 'AAAA', ack, gene, relation: 'first-cousin', nonce }) });
    const forged = await send('DMD');
    expect(forged.status).toBe(403);
    expect(await forged.json()).toMatchObject({ reason: 'not_your_gene' });
    const ok = await send('ABCA4');
    expect(ok.status).toBe(200);
    const { id, manage } = await ok.json();
    const got = await (await fetch(`${BASE}/api/family/${id}`)).json();
    const { publicKey } = await (await fetch(`${BASE}/api/lab/key`)).json();
    const msg = (gene: string) => labTagged('family-note', noteDigest({ gene, relation: 'first-cousin', inheritance: gene === 'DMD' ? 'XL' : 'AR', nonce, day: got.day }));
    expect(ed25519.verify(unhex(got.sig), msg('ABCA4'), unhex(publicKey))).toBe(true);
    // The same signature says nothing for another gene, relation or nonce.
    expect(ed25519.verify(unhex(got.sig), msg('DMD'), unhex(publicKey))).toBe(false);
    // A relative can report it with the link's token; the sender never sees reports.
    const report = await fetch(`${BASE}/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'report', token }) });
    expect(report.status).toBe(200);
    expect(await (await fetch(`${BASE}/api/family/${id}`, { headers: { 'x-manage': manage } })).json()).toEqual({ read: 0, booked: 0 });
    await fetch(`${BASE}/api/family/${id}`, { method: 'DELETE', headers: { 'x-manage': manage } });
  }, 60_000);

  it('two visitors signed in as the same person each have their own open request, and can withdraw it', async () => {
    const [v1, v2] = await Promise.all([as('latifa'), as('latifa')]);
    const book = (identity: string) => fetch(`${BASE}/api/desk/cases`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({}) });
    const withdraw = (id: string, identity: string) => fetch(`${BASE}/api/desk/cases/${id}`, { method: 'DELETE', headers: { 'x-person': identity } });
    const [a, b] = await Promise.all([book(v1), book(v2)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const [ja, jb] = await Promise.all([a.json(), b.json()]);
    const again = await book(v1);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'open_case', id: ja.id, error: expect.stringMatching(/withdraw it below/) });
    // Another visitor can't withdraw it; its own visitor can.
    expect((await withdraw(ja.id, v2)).ok).toBe(false);
    expect((await withdraw(ja.id, v1)).ok).toBe(true);
    const fresh = await book(v1);
    expect(fresh.status).toBe(200);
    const jf = await fresh.json();
    await Promise.all([withdraw(jf.id, v1), withdraw(jb.id, v2)]);
  }, 60_000);

  it('the lab refuses tokens without a signed identity', async () => {
    const r = await fetch(`${BASE}/api/lab/tokens`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: 'a'.repeat(64), role: 'A' }) });
    expect(r.status).toBe(401);
  });
});
