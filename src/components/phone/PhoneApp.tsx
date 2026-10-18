'use client';
// The person's app: their results card, the pairing with their partner, and the couple result.
// Arabic is written for the reader: `ar` addresses a man (whose partner is a woman) and `arF` a woman
// (whose partner is a man).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import type { Locale } from '@/i18n/locales';
import type { AlphaOutcome, Finding, SharedGene } from '@/lib/lab';
import { checkWords, linkFragment, newLink, parseFragment, runInitiator, runResponder, sessionId, type Link, type PairResult, type Partner, type Step } from '@/lib/pairing';
import { conditionFor, type Level } from '@/lib/conditions';
import { F, type Relationship } from '@/lib/risk';
import { Diamond, Mark, Person } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';
import { Ask, Counsellor, dueText, Family, Options, type Booking } from './Views';
import { TeachBack } from './TeachBack';
import { Listen } from './Listen';
import { codeOf, errorText } from './errors';

/** A string in both languages; `arF` is the Arabic addressed to a woman, where it differs. */
export type L = { en: string; ar: string; arF?: string };
export type T = (l: L) => string;
export interface PublicPerson { id: string; name: { en: string; ar: string }; sex: 'F' | 'M'; age: number }
export interface PhoneProps {
  lang: Locale;
  me: PublicPerson;
  relationship: Relationship;
  /** Fixed role for the side-by-side demo; otherwise read from the URL fragment or created on demand. */
  role?: 'A' | 'B';
  embedded?: boolean;
  /** The partner's demo id, so the invitation link can greet them by name on the demo's picker. */
  partner?: string;
}

type View = 'card' | 'mine' | 'pair' | 'running' | 'result' | 'options' | 'counsellor' | 'ask' | 'family';

/** The relationship, said to the couple: "You told us that …". */
export const REL: Record<Relationship, { en: string; ar: string }> = {
  unrelated: { en: 'you are not related', ar: 'لا قرابة بينكما' },
  'second-cousins': { en: 'you are second cousins', ar: 'أنكما أبناء عمومة أو خؤولة من الدرجة الثانية' },
  'first-cousins-once-removed': { en: 'you are first cousins once removed', ar: 'أن أحدكما من أبناء عمومة أو خؤولة أحد والدَي الآخر' },
  'first-cousins': { en: 'you are first cousins', ar: 'أنكما أبناء عمومة أو خؤولة من الدرجة الأولى' },
  'double-first-cousins': { en: 'you are double first cousins', ar: 'أنكما أبناء عمومة وخؤولة في آن واحد' },
};
const told = (r: Relationship) => ({ en: `You told us ${REL[r].en}.`, ar: r === 'unrelated' ? 'أخبرتنا أنه لا قرابة بينكما.' : `أخبرتنا ${REL[r].ar}.` });

/** Genes where the exact pair of changes decides the chance, so a genetic counsellor confirms with a dedicated test. */
const CONFIRM: Record<string, L> = {
  CYP21A2: { en: 'For this gene the exact changes matter: many people carry a mild (non-classic) change, and a mild with a classic change rarely causes the classic form. A genetic counsellor will confirm with a dedicated test before you act on this.', ar: 'في هذا الجين تهم التغيّرات الدقيقة: كثيرون يحملون تغيّراً خفيفاً (غير تقليدي)، ونادراً ما يسبب التغيّر الخفيف مع التقليدي الشكلَ التقليدي. وسيؤكد المرشد الوراثي ذلك بفحص مخصص قبل أي قرار.' },
  HBB: { en: 'In this gene only the exact pair of changes says how serious it is. Your premarital blood test (HPLC) already shows each of your exact changes; a genetic counsellor reads the pair with you before you act on this. Serious pairs include sickle with sickle, sickle or HbE with beta thalassaemia, beta thalassaemia with beta thalassaemia, and sickle with HbC, HbD-Punjab or HbO-Arab. Two HbE changes together are usually mild.', ar: 'في هذا الجين لا يحدد الخطورة إلا زوج التغيّرين بدقة. ويبيّن فحص الدم قبل الزواج (HPLC) التغيّر المحدد لدى كل منكما، ويقرأ المرشد الوراثي زوج التغيّرين معكما قبل أي قرار. ومن الأزواج الخطيرة: منجلي مع منجلي، ومنجلي أو HbE مع ثلاسيميا بيتا، وثلاسيميا بيتا مع ثلاسيميا بيتا، ومنجلي مع HbC أو HbD-Punjab أو HbO-Arab. أما تغيّرا HbE معاً فخفيفان عادة.' },
  HBA: { en: 'For alpha globin, how the lost genes sit on each chromosome decides the chance, and standard sequencing can miss it. A genetic counsellor will confirm with a dedicated test before you act on this.', ar: 'في ألفا غلوبين يحدد موضع الجينات المفقودة على كل كروموسوم الاحتمال، وقد لا يكشفه التسلسل المعتاد. وسيؤكد المرشد الوراثي ذلك بفحص مخصص قبل أي قرار.' },
  SMN1: { en: 'For this gene the number of copies matters, and some carriers are missed by standard tests. A genetic counsellor will confirm with a dedicated test.', ar: 'في هذا الجين يهم عدد النسخ، وقد لا تكشف الفحوص المعتادة بعض الحاملين. وسيؤكد المرشد الوراثي ذلك بفحص مخصص.' },
};

/** On every result screen: some results are for one partner alone, and reach that person privately. */
const ALONE: L = { en: 'Some results matter for one partner alone, such as changes on the X chromosome. They go to that person privately, whoever they marry, and are never shown here first.', ar: 'بعض النتائج تخص أحد الشريكين وحده، مثل التغيّرات على الكروموسوم X. تصل إلى صاحبها بخصوصية أياً كان من يتزوج، ولا تظهر هنا أولاً أبداً.' };

/** How likely a child is to inherit both changes; most pairs are 1 in 4, some alpha-globin pairs differ (see lab.ts). */
export type Chance = 'quarter' | 'half' | 'three-quarters' | 'all';
export const chanceOf = (g: SharedGene): Chance => {
  const c = (g as { chance?: string }).chance;
  return c === 'half' || c === 'three-quarters' || c === 'all' ? c : 'quarter';
};
/** "1 in 4" as a number phrase, for sentences that already say "a … chance". */
export const ONE_IN: Record<Chance, L> = { quarter: { en: '1 in 4', ar: '1 من 4' }, half: { en: '1 in 2', ar: '1 من 2' }, 'three-quarters': { en: '3 in 4', ar: '3 من 4' }, all: { en: 'every', ar: 'كل' } };

/** Each alpha-globin outcome as a noun phrase (en) and as "أن …" (ar), for "a 1 in 4 chance of …". */
const ALPHA_WHAT: Record<AlphaOutcome, L> = {
  bart: { en: 'Hb Bart’s hydrops, a very severe anaemia before birth that most babies don’t survive without treatment in the womb, and that can make the pregnancy dangerous for the mother (for example very high blood pressure)', ar: 'أن يصاب الجنين باستسقاء خضاب بارت، وهو فقر دم شديد جداً قبل الولادة لا ينجو منه معظم الأجنة دون علاج داخل الرحم، وقد يجعل الحمل خطراً على الأم (مثل ارتفاع شديد في ضغط الدم)' },
  'hbh-severe': { en: 'HbH disease that can be severe with your pair of changes, and that rarely causes hydrops (severe anaemia before birth)', ar: 'أن يصاب الطفل بمرض الهيموغلوبين H الذي قد يكون شديداً مع هذا الزوج من التغيّرات، ونادراً ما يسبب استسقاء (فقر دم شديد قبل الولادة)' },
  hbh: { en: 'HbH disease (lifelong anaemia, usually moderate, with some children needing regular blood transfusions)', ar: 'أن يصاب الطفل بمرض الهيموغلوبين H (فقر دم مدى الحياة، متوسط عادة، ويحتاج بعض الأطفال إلى نقل دم منتظم)' },
  trait: { en: 'alpha-thalassaemia trait (small red cells, like a carrier’s, but not an illness)', ar: 'أن تكون لدى الطفل سمة ألفا ثلاسيميا (خلايا دم حمراء صغيرة مثل حامل التغيّر، لكنها ليست مرضاً)' },
  carrier: { en: 'a healthy carrier', ar: 'أن يكون الطفل حاملاً سليماً للتغيّر' },
  unaffected: { en: 'no changed copy', ar: 'ألا يحمل الطفل أي نسخة متغيرة' },
};
const N_CHANCE: Record<number, Chance> = { 1: 'quarter', 2: 'half', 3: 'three-quarters', 4: 'all' };
/** Shown first when one partner's two alpha-plus changes could sit on one chromosome (lab.ts arrangementUnknown). */
const ALPHA_AS_READ: L = { en: 'These are your results as read, with each change on a different chromosome. A confirmatory test checks how the changes sit: two changes on the same chromosome act like a bigger change, and the chances below would differ. A genetic counsellor will arrange it before you act on this.', ar: 'هذه نتيجتكما كما قُرئت، على أن كل تغيّر على كروموسوم مختلف. ويتحقق فحص تأكيدي من موضع التغيّرات: فالتغيّران على الكروموسوم نفسه يعملان مثل تغيّر أكبر، وتختلف الاحتمالات أدناه حينها. وسيرتّب المرشد الوراثي ذلك قبل أي قرار.' };

/**
 * What a shared alpha-globin gene means: every outcome of the four combinations with its chance, from the
 * lab's outcomes (lab.ts). Older results without outcomes fall back to the most serious one.
 */
function alphaText(g: SharedGene): L | undefined {
  const kind = g.kind as AlphaOutcome | undefined;
  const outcomes = g.outcomes?.length ? g.outcomes : kind ? [{ kind, n: ({ quarter: 1, half: 2, 'three-quarters': 3, all: 4 } as const)[chanceOf(g)] }] : null;
  if (!outcomes) return undefined;
  const named = outcomes.filter((o) => o.n > 0 && o.kind !== 'carrier' && o.kind !== 'unaffected');
  const others = outcomes.filter((o) => o.n > 0 && (o.kind === 'carrier' || o.kind === 'unaffected'));
  const has = (k: AlphaOutcome) => named.some((o) => o.kind === k);
  const en: string[] = [], ar: string[] = [];
  if (has('bart')) { en.push('You both carry a change where both alpha-globin genes on one chromosome are lost.'); ar.push('كلاكما يحمل تغيّراً فُقد فيه جينا ألفا غلوبين على كروموسوم واحد.'); }
  if (named.length === 1 && named[0].n === 4) {
    en.push(`In every pregnancy the child is expected to have ${ALPHA_WHAT[named[0].kind].en}.`);
    ar.push(`في كل حمل يُتوقع ${ALPHA_WHAT[named[0].kind].ar}.`);
  } else {
    const pe = named.map((o) => `a ${ONE_IN[N_CHANCE[o.n]].en} chance of ${ALPHA_WHAT[o.kind].en}`);
    const pa = named.map((o) => `احتمال ${ONE_IN[N_CHANCE[o.n]].ar} ${ALPHA_WHAT[o.kind].ar}`);
    en.push(`In each pregnancy there is ${pe.length > 1 ? `${pe.slice(0, -1).join('; ')}; and ${pe.at(-1)}` : pe[0]}.`);
    ar.push(`في كل حمل ${pa.join('؛ و')}.`);
  }
  if (others.length) {
    const c = others.some((o) => o.kind === 'carrier'), u = others.some((o) => o.kind === 'unaffected');
    en.push(`Otherwise the child ${c && u ? 'is a healthy carrier or has no changed copy' : c ? 'is a healthy carrier' : 'has no changed copy'}.`);
    ar.push(`وفي غير ذلك يكون الطفل ${c && u ? 'حاملاً سليماً للتغيّر أو بلا نسخة متغيرة' : c ? 'حاملاً سليماً للتغيّر' : 'بلا نسخة متغيرة'}.`);
  }
  if (g.arrangementUnknown && !has('bart')) { en.push('Hb Bart’s is not expected from your results as read.'); ar.push('ولا يُتوقع خضاب بارت من نتيجتكما كما قُرئت.'); }
  if (has('bart')) { en.push('A genetic counsellor will talk with you both before any pregnancy.'); ar.push('وسيتحدث المرشد الوراثي معكما قبل أي حمل.'); }
  else if (has('hbh-severe')) { en.push('A genetic counsellor will talk with you both about fetal medicine care before any pregnancy.'); ar.push('وسيتحدث المرشد الوراثي معكما عن رعاية طب الأجنة قبل أي حمل.'); }
  return { en: en.join(' '), ar: ar.join(' ') };
}

/** For FMR1 the chance itself differs; carrier health is on the card (panelcards.ts carrierNote), shown once. */
const FMR1_CHANCE: L = { en: 'For this gene the chance depends on the size of the change (repeat number), which can grow when passed on. A genetic counsellor will explain your exact result.', ar: 'في هذا الجين يعتمد الاحتمال على حجم التغيّر (عدد التكرارات)، وقد يكبر عند انتقاله. وسيشرح المرشد الوراثي نتيجتك بدقة.' };

/** What relatedness adds for conditions this screening did not test, for the actual relationship (Bennett et al. 2002). */
const KIN: Partial<Record<Relationship, { en: string; ar: string }>> = {
  'first-cousins': { en: 'For first cousins that is about 2 to 3 more in every 100 pregnancies than for unrelated parents.', ar: 'ولأبناء العمومة أو الخؤولة من الدرجة الأولى يقارب ذلك 2 إلى 3 حالات إضافية في كل 100 حمل مقارنة بغير الأقارب.' },
  'double-first-cousins': { en: 'For double first cousins it is roughly twice the first-cousin figure: about 4 to 6 more in every 100 pregnancies.', ar: 'ولمن جمعتهما قرابة الأب والأم معاً يقارب ذلك ضعف رقم الدرجة الأولى: نحو 4 إلى 6 حالات إضافية في كل 100 حمل.' },
  'first-cousins-once-removed': { en: 'For first cousins once removed it is about half the first-cousin figure: roughly 1 more in every 100 pregnancies.', ar: 'وفي هذه القرابة يقارب ذلك نصف رقم الدرجة الأولى: نحو حالة إضافية واحدة في كل 100 حمل.' },
  'second-cousins': { en: 'For second cousins it is smaller: under 1 more in every 100 pregnancies.', ar: 'ولأبناء العمومة أو الخؤولة من الدرجة الثانية يكون أقل: أقل من حالة إضافية واحدة في كل 100 حمل.' },
};

/** The demo's sign-in is kept for the tab, so a reload, a reset or a switch doesn't sign in again. */
type Session = { token: string; expires: number; personal: number };
const sessionKey = (id: string) => `twokeys-session-${id}`;
function savedSession(id: string): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(sessionKey(id)) ?? 'null') as Session | null;
    return s && typeof s.token === 'string' && s.expires - Date.now() > 10 * 60_000 ? s : null;
  } catch { return null; }
}
const forgetSession = (id: string) => { try { sessionStorage.removeItem(sessionKey(id)); } catch { /* storage blocked */ } };

/** Arabic seconds: 1, 2 (dual), 3–10 (plural), 11+ (singular). */
const secondsAr = (n: number) => (n === 1 ? 'ثانية واحدة' : n === 2 ? 'ثانيتين' : n <= 10 ? `${n} ثوانٍ` : `${n} ثانية`);

export function PhoneApp({ lang, me, relationship, role: fixedRole, embedded, partner }: PhoneProps) {
  const t = useCallback<T>((l) => (lang === 'ar' ? (me.sex === 'F' && l.arF ? l.arF : l.ar) : l.en), [lang, me.sex]);
  const [view, setView] = useState<View>('card');
  const [level, setLevel] = useState<Level>('standard');
  const [identity, setIdentity] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [personal, setPersonal] = useState(0);
  // A result that is yours alone (X-linked) is read before any pairing, never first on a shared screen.
  const [seenPersonal, setSeenPersonal] = useState(false);
  const [mine, setMine] = useState<Finding[] | null>(null);
  const [mineScope, setMineScope] = useState<'all' | 'personal'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [role, setRole] = useState<'A' | 'B' | null>(fixedRole ?? null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [waitFrom, setWaitFrom] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<PairResult | null>(null);
  // What stopped: a stable code from the lab or relay, with the server's English for an unknown code.
  const [error, setError] = useState<{ code?: string; en?: string } | null>(null);
  // Set when this person answered "No, stop", so the screen says they stopped it, not that it failed.
  const stoppedByMe = useRef(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [urgent, setUrgent] = useState(false);
  // The explainer's signature on an urgent reply, so the desk can trust the same-day clock.
  const [urgentSig, setUrgentSig] = useState<string | undefined>(undefined);
  const [prefill, setPrefill] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [joiner, setJoiner] = useState<{ partner: Partner; answer: (yes: boolean) => void } | null>(null);
  const started = useRef(false);
  const run = useRef<AbortController | null>(null);
  // Focus follows the person's own taps only: a screen they opened announces its heading; a screen the
  // page opened for them (an invitation link) leaves focus, and the page's scroll, where they were.
  const moved = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const go = useCallback((v: View) => { moved.current = true; setView(v); }, []);

  // Sign in. The demo's stand-in for UAE PASS: a signed token for this synthetic person, kept for this
  // tab only. A busy demo answers 429; the phone waits and tries again by itself.
  useEffect(() => {
    let live = true;
    const saved = savedSession(me.id);
    if (saved) {
      setIdentity(saved.token);
      setPersonal(saved.personal);
      return;
    }
    fetch('/api/demo/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person: me.id }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.status === 429) { setRetryIn(Number(j.retryAfter) || 20); return; }
        if (!r.ok) throw Object.assign(new Error(j.error), { code: j.code });
        try { sessionStorage.setItem(sessionKey(me.id), JSON.stringify({ token: j.token, expires: j.expires, personal: j.personal ?? 0 })); } catch { /* storage blocked: sign in each load */ }
        setRetryIn(null);
        setIdentity(j.token);
        setPersonal(j.personal ?? 0);
      })
      .catch((e) => live && setError({ code: codeOf(e) ?? (e instanceof TypeError ? 'offline' : 'signed_out'), en: e instanceof Error && e.message ? e.message : 'Could not sign in.' }));
    return () => { live = false; };
  }, [me.id, attempt]);

  useEffect(() => {
    if (retryIn === null) return;
    const id = setTimeout(() => {
      if (retryIn <= 1) { setRetryIn(null); setAttempt((a) => a + 1); } else setRetryIn(retryIn - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [retryIn]);
  const retryNow = () => { setRetryIn(null); setAttempt((a) => a + 1); };

  // A link in the URL fragment means a partner shared a pairing with this phone. Read it, then take it
  // out of the address bar so it doesn't stay in the browser history.
  useEffect(() => {
    const l = parseFragment(window.location.hash);
    if (!l) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
    setLink(l);
    setRole(fixedRole ?? 'B');
    setView('pair');
    if (!embedded) history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [fixedRole, embedded]);

  const vid = `v-${me.id}`;
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    mainRef.current?.scrollTo({ top: 0 });
    document.getElementById(vid)?.focus({ preventScroll: true });
  }, [view, vid]);

  // In the side-by-side demo, tell the page what left this phone so it can show what the relay saw.
  const report = useCallback((s: Step) => {
    if (!embedded || window.parent === window) return;
    const step = s.kind === 'done' ? { kind: 'done', ms: s.result.ms, genes: s.result.genes.map((g) => g.gene) } : s;
    window.parent.postMessage({ type: 'twokeys-step', person: me.id, step }, window.location.origin);
  }, [embedded, me.id]);

  // And whether this phone is waiting for a tap, so a phone-sized page showing one phone at a time can
  // point to the other.
  // `confirm` marks the identity check, which the page scrolls into view (or switches to, on a phone).
  const needsTap = !!joiner || view === 'pair';
  const needsConfirm = !!joiner;
  useEffect(() => {
    if (!embedded || window.parent === window) return;
    window.parent.postMessage({ type: 'twokeys-attention', person: me.id, need: needsTap, confirm: needsConfirm }, window.location.origin);
  }, [embedded, me.id, needsTap, needsConfirm]);

  const shareUrl = useMemo(() => {
    if (!link || typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    for (const k of ['as', 'role', 'embed', 'for']) u.searchParams.delete(k);
    // The demo's picker greets the invited partner by name; with UAE PASS the invitation needs no name.
    if (partner) u.searchParams.set('for', partner);
    u.hash = linkFragment(link);
    return u.toString();
  }, [link, partner]);

  useEffect(() => {
    if (shareUrl && role === 'A') QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: '#22201E', light: '#FAF8F4' } }).then(setQr).catch(() => setQr(''));
  }, [shareUrl, role]);

  // While waiting on the partner, a clock so the screen can say so after two minutes.
  useEffect(() => {
    if (view !== 'running' || waitFrom === null) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [view, waitFrom]);

  const startPairing = () => {
    if (!link) setLink(newLink());
    setRole(fixedRole ?? 'A');
    go('pair');
  };
  const copyLink = () => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  // Shows who joined and waits for "yes, this is my partner".
  const confirmPartner = (p: Partner) => new Promise<boolean>((resolve) => setJoiner({ partner: p, answer: (yes) => { if (!yes) stoppedByMe.current = true; setJoiner(null); resolve(yes); } }));

  const compare = async () => {
    if (!link || !role || !identity || started.current) return;
    started.current = true;
    stoppedByMe.current = false;
    const ac = new AbortController();
    run.current = ac;
    go('running');
    setSteps([]);
    setWaitFrom(null);
    setError(null);
    try {
      const onStep = (s: Step) => {
        if (ac.signal.aborted) return;
        setSteps((x) => [...x, s]);
        setWaitFrom(s.kind === 'waiting' ? Date.now() : null);
        setNow(Date.now());
        report(s);
      };
      const opts = { identity, link, onStep, confirmPartner, signal: ac.signal };
      const r = role === 'A' ? await runInitiator(opts) : await runResponder(opts);
      if (ac.signal.aborted) return;
      setResult(r);
      go('result');
    } catch (e) {
      if (ac.signal.aborted) return;
      // Leave the comparing screen: no spinner or half-finished steps stay behind an error.
      setError({ code: stoppedByMe.current ? 'stopped_by_me' : codeOf(e) ?? (e instanceof TypeError ? 'offline' : undefined), en: e instanceof Error ? e.message : String(e) });
      started.current = false;
      setJoiner(null);
      setSteps([]);
      setWaitFrom(null);
      // A link that failed can't be used again; outside the demo, the next pairing makes a new one.
      if (!embedded) { setLink(null); setRole(fixedRole ?? null); }
      go(result ? 'result' : 'card');
    }
  };
  const cancelCompare = () => {
    run.current?.abort();
    joiner?.answer(false);
    started.current = false;
    setSteps([]);
    setWaitFrom(null);
    go('pair');
  };
  const leavePairing = () => {
    if (!embedded) { setLink(null); setRole(fixedRole ?? null); }
    go('card');
  };
  // Start over signs in again too: an expired or refused token is the usual reason to be here.
  const startOver = () => {
    run.current?.abort();
    started.current = false;
    setError(null);
    setSteps([]);
    setIdentity(null);
    forgetSession(me.id);
    setAttempt((a) => a + 1);
    go(result ? 'result' : 'card');
  };

  const openResults = async (scope: 'all' | 'personal') => {
    setConfirmOpen(false);
    if (!identity) return;
    const r = await fetch('/api/lab/results', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ confirm: true, scope }) }).catch(() => null);
    if (!r) { setError({ code: 'offline' }); return; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError({ code: j.code, en: j.error }); return; }
    setMine(j.findings);
    setMineScope(scope);
    setSeenPersonal(true);
    go('mine');
  };

  const book = (isUrgent: boolean, question = '', sig?: string) => { setUrgent(isUrgent); setUrgentSig(isUrgent ? sig : undefined); setPrefill(question); go('counsellor'); };
  const mustReadFirst = personal > 0 && !seenPersonal;
  // Back from a side screen: the result once there is one, else the pairing in progress, else the card.
  const home: View = result ? 'result' : link ? 'pair' : 'card';
  const words = link ? checkWords(link, lang) : [];
  const genes = result?.genes ?? [];
  const arGenes = genes.filter((g) => g.inheritance === 'AR').sort((a, b) => b.strength - a.strength);
  const xlGenes = genes.filter((g) => g.inheritance === 'XL');
  const color = me.sex === 'F' ? 'var(--indigo)' : 'var(--camel)';
  const related = F[relationship] > 0;
  const simple = level === 'simple';
  const sent = steps.find((s): s is Extract<Step, { kind: 'sent' }> => s.kind === 'sent');
  const lastWait = steps.at(-1)?.kind === 'waiting' ? (steps.at(-1) as Extract<Step, { kind: 'waiting' }>) : null;
  const slow = lastWait && waitFrom !== null && now - waitFrom > 120_000;
  const thal = arGenes.some((g) => g.gene === 'HBB' || g.gene === 'HBA');
  const h2 = (children: ReactNode, className = '') => <h2 id={vid} tabIndex={-1} className={`font-semibold tracking-tight outline-none ${className}`}>{children}</h2>;

  return (
    <div className={`relative flex h-full flex-col bg-wool text-ink ${embedded ? '' : 'min-h-dvh'}`}>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
        <div className="flex items-center gap-2.5" style={{ color }}>
          <Person sex={me.sex} color={color} size={22} />
          <h1 className="text-[15px] font-medium text-ink">{lang === 'ar' ? `هاتف ${me.name.ar}` : `${me.name.en}’s phone`}</h1>
        </div>
        <span className="flex items-center gap-1.5 text-ink-3" aria-hidden><Mark size={20} /></span>
      </header>

      <main id="main" ref={mainRef} className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        {retryIn !== null && (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-rule bg-paper px-4 py-3 text-[14px]">
            <span>
              <span aria-hidden>{t({ en: `The demo is busy. Retrying in ${retryIn} ${retryIn === 1 ? 'second' : 'seconds'}.`, ar: `العرض مشغول. ستُعاد المحاولة خلال ${secondsAr(retryIn)}.` })}</span>
              <span className="sr-only">{t({ en: 'The demo is busy. Retrying shortly.', ar: 'العرض مشغول. ستُعاد المحاولة قريباً.' })}</span>
            </span>
            <button onClick={retryNow} className="min-h-11 rounded-[2px] border border-ink px-3 font-medium">{t({ en: 'Retry now', ar: 'أعد المحاولة الآن', arF: 'أعيدي المحاولة الآن' })}</button>
          </div>
        )}
        {error && (
          <div role="alert" className={`mb-4 border-s-4 px-4 py-3 text-[14px] leading-relaxed ${error.code === 'stopped_by_me' || error.code === 'stopped' ? 'border-ink-3 bg-paper' : 'border-alert bg-alert-2'}`}>
            <p dir="auto">{errorText(t, lang, error.code, error.en)}</p>
            {embedded && error.code !== 'rate_limited' && <p className="mt-1 text-ink-2">{t({ en: 'To try again, use “Reset both phones” above the phones.', ar: 'للمحاولة مجدداً، اضغط «أعد ضبط الهاتفين» فوق الهاتفين.', arF: 'للمحاولة مجدداً، اضغطي «أعد ضبط الهاتفين» فوق الهاتفين.' })}</p>}
            <button className="mt-2 min-h-11 rounded-[2px] border border-ink bg-paper px-3 font-medium" onClick={error.code === 'stopped_by_me' || error.code === 'stopped' ? () => setError(null) : startOver}>{error.code === 'stopped_by_me' || error.code === 'stopped' ? t({ en: 'Close', ar: 'إغلاق' }) : t({ en: 'Start over', ar: 'ابدأ من جديد', arF: 'ابدئي من جديد' })}</button>
          </div>
        )}

        {view === 'card' && (
          <section>
            <p className="text-[13px] text-ink-2">{t({ en: 'Results card, premarital screening, Abu Dhabi', ar: 'بطاقة نتائج الفحص الجيني قبل الزواج، أبوظبي' })}</p>
            {h2(t({ en: 'Your results are sealed on this phone.', ar: 'نتائجك مختومة على هذا الهاتف.' }), 'mt-1 text-[26px] leading-tight')}
            <div className="mt-5 overflow-hidden rounded-[3px] border border-ink">
              <Sadu height={64} motifs={9} seed={me.id.length} />
              <div className="bg-paper px-4 py-3.5 text-[14px] leading-relaxed text-ink-2">
                {t({
                  en: 'You chose to see your results only with your partner. When you compare, you both learn the genes you both carry, and nothing else. You can change this at any time.',
                  ar: 'اخترت ألا ترى نتائجك إلا مع شريكتك. عند المقارنة تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                  arF: 'اخترتِ ألا تري نتائجك إلا مع شريكك. عند المقارنة تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                })}
              </div>
            </div>
            {booking && <CounsellorStatus t={t} booking={booking} onOpen={() => book(false)} />}
            {personal > 0 && <PersonalCallout t={t} sex={me.sex} required={mustReadFirst} read={seenPersonal} onOpen={() => openResults('personal')} />}
            <button onClick={startPairing} disabled={!identity || mustReadFirst} className="mt-6 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {identity ? t({ en: 'Pair with your partner', ar: 'اربط هاتفك بهاتف شريكتك', arF: 'اربطي هاتفك بهاتف شريكك' }) : retryIn !== null ? t({ en: 'Waiting to sign in…', ar: 'بانتظار تسجيل الدخول…' }) : t({ en: 'Signing in…', ar: 'جارٍ تسجيل الدخول…' })}
            </button>
            {mustReadFirst && identity && <p className="mt-2 text-[13px] text-ink-2">{t({ en: 'Open your personal result above first.', ar: 'افتح نتيجتك الخاصة أعلاه أولاً.', arF: 'افتحي نتيجتك الخاصة أعلاه أولاً.' })}</p>}
            <div className="mt-6 border-t border-rule pt-4">
              <p className="text-[14px] text-ink-2">{t({ en: 'You also have the right to see your own full results at any time.', ar: 'ولك الحق في رؤية نتائجك الكاملة في أي وقت.' })}</p>
              <button onClick={() => setConfirmOpen(true)} disabled={!identity} className="mt-3 min-h-11 rounded-[2px] border border-indigo px-4 text-[14px] font-medium text-indigo disabled:opacity-50">{t({ en: 'Open my own results', ar: 'افتح نتائجي الخاصة', arF: 'افتحي نتائجي الخاصة' })}</button>
            </div>
          </section>
        )}

        {view === 'mine' && mine && (
          <section className="flex flex-col">
            <BackLink lang={lang} onBack={() => go(home)} />
            {h2(mineScope === 'personal' ? t({ en: 'A result that is yours alone', ar: 'نتيجة تخصّك وحدك' }) : t({ en: 'Your own results', ar: 'نتائجك الخاصة' }), 'mt-3 text-[24px]')}
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {mineScope === 'personal'
                ? t({ en: 'This matters whatever your partner carries, so it doesn’t wait for a comparison. Nobody else sees it unless you share it.', ar: 'يهمّك هذا أياً كان ما تحمله شريكتك، لذلك لا ينتظر المقارنة. ولا يراه أحد غيرك إلا إذا شاركته.', arF: 'يهمّك هذا أياً كان ما يحمله شريكك، لذلك لا ينتظر المقارنة. ولا يراه أحد غيرك إلا إذا شاركتِه.' })
                : t({ en: 'For most genes below you carry one changed copy. Being a carrier is not an illness: it matters mainly if a partner carries the same gene. A gene marked X is different, and its card says how.', ar: 'في معظم الجينات أدناه لديك نسخة واحدة متغيرة. أن تكون حاملاً للتغيّر لا يعني أنك مريض، ويهم ذلك أساساً إذا كانت شريكتك تحمل الجين نفسه. أما الجين المعلَّم بـ X فمختلف، وتوضح بطاقته كيف.', arF: 'في معظم الجينات أدناه لديكِ نسخة واحدة متغيرة. أن تكوني حاملةً للتغيّر لا يعني أنك مريضة، ويهم ذلك أساساً إذا كان شريكك يحمل الجين نفسه. أما الجين المعلَّم بـ X فمختلف، وتوضح بطاقته كيف.' })}
            </p>
            {mine.length === 0 && <p className="mt-4 text-[15px]">{t({ en: 'No changes were found among the genes screened.', ar: 'لم تُكتشف أي تغيّرات ضمن الجينات التي شملها الفحص.' })}</p>}
            <ul className="mt-4 space-y-3">
              {mine.map((f) => <FindingCard key={f.gene} f={f} t={t} sex={me.sex} level={level} />)}
            </ul>
            {mineScope === 'personal' && (
              <button onClick={() => book(false)} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">
                {t({ en: 'Talk to a genetic counsellor about this', ar: 'تحدّث إلى مرشد وراثي بشأن هذا', arF: 'تحدّثي إلى مرشد وراثي بشأن هذا' })}
              </button>
            )}
            <button onClick={() => { setMine(null); go(home); }} className="mt-3 min-h-11 w-full rounded-[2px] border border-ink px-4 text-[15px] font-medium">
              {home === 'pair' ? t({ en: 'Close and go back to comparing', ar: 'أغلق وعُد إلى المقارنة', arF: 'أغلقي وعودي إلى المقارنة' }) : t({ en: 'Close my results', ar: 'أغلق نتائجي', arF: 'أغلقي نتائجي' })}
            </button>
          </section>
        )}

        {view === 'pair' && link && (
          <section>
            {h2(role === 'A' ? t({ en: 'Show this to your partner', ar: 'اعرض هذا على شريكتك', arF: 'اعرضي هذا على شريكك' }) : t({ en: 'Your partner invited you to compare', ar: 'دعتك شريكتك إلى المقارنة', arF: 'دعاكِ شريكك إلى المقارنة' }), 'text-[24px]')}
            {role === 'A' && !embedded && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[3px] border border-rule bg-paper p-4">
                {qr ? <img src={qr} alt={t({ en: 'QR code for your partner', ar: 'رمز QR لشريكتك', arF: 'رمز QR لشريكك' })} width={200} height={200} /> : <div className="h-[200px] w-[200px] animate-pulse bg-wool-2" />}
                <button className="min-h-11 px-2 text-[14px] text-indigo underline underline-offset-4" onClick={copyLink}>
                  {copied ? t({ en: 'Copied', ar: 'نُسخ الرابط' }) : t({ en: 'Copy the link instead', ar: 'انسخ الرابط بدلاً من ذلك', arF: 'انسخي الرابط بدلاً من ذلك' })}
                </button>
              </div>
            )}
            <div className="mt-5">
              <p className="text-[14px] text-ink-2">{t({ en: 'Both screens should show the same three words. Read them to each other.', ar: 'يجب أن تظهر الكلمات الثلاث نفسها على الشاشتين. اقرآها لبعضكما.' })}</p>
              <p className="mt-2 flex flex-wrap gap-2" aria-live="polite">
                {words.map((w) => <span key={w} className="rounded-[2px] border border-ink px-3 py-1.5 text-[17px] font-medium">{w}</span>)}
              </p>
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-ink-2">{t(told(relationship))}</p>
            {personal > 0 && (mustReadFirst || seenPersonal) && <PersonalCallout t={t} sex={me.sex} required={mustReadFirst} read={seenPersonal} onOpen={() => openResults('personal')} />}
            <button onClick={compare} disabled={!identity || mustReadFirst} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {t({ en: 'The words match. Compare now', ar: 'الكلمات متطابقة. قارن الآن', arF: 'الكلمات متطابقة. قارني الآن' })}
            </button>
            {mustReadFirst && <p className="mt-2 text-[13px] text-ink-2">{t({ en: 'Open your personal result above first.', ar: 'افتح نتيجتك الخاصة أعلاه أولاً.', arF: 'افتحي نتيجتك الخاصة أعلاه أولاً.' })}</p>}
            <button onClick={leavePairing} className="mt-2 min-h-11 w-full rounded-[2px] text-[15px] text-ink-2 underline underline-offset-4">{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
          </section>
        )}

        {view === 'running' && (
          <section>
            {h2(t({ en: 'Comparing, privately', ar: 'تجري المقارنة بخصوصية' }), 'text-[24px]')}
            <ol className="mt-4 space-y-3 text-[14px]" aria-live="polite">
              {steps.map((s, i) => {
                const pending = s.kind === 'waiting' && i === steps.length - 1;
                // Once the partner is here, the wait is over: say who, and point to the check below.
                const joined = pending && joiner && (s.for === 'partner-join' || s.for === 'creator-confirm') ? joiner.partner : null;
                return (
                  <li key={i} className="flex gap-2.5">
                    {joined
                      ? <span className="w-3.5 shrink-0 text-indigo" aria-hidden>↓</span>
                      : pending
                        ? <span className="mt-[3px] inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-ink-3 border-t-transparent motion-reduce:animate-none motion-reduce:border-t-ink-3" aria-hidden />
                        : <span className="w-3.5 shrink-0 text-sage" aria-hidden>✓</span>}
                    {joined ? <span className="font-medium">{joinedLine(joined, s.kind === 'waiting' ? s.for : '', lang, t)}</span> : <StepLine s={s} t={t} lang={lang} />}
                  </li>
                );
              })}
            </ol>
            {slow && lastWait ? (
              <div role="status" className="mt-6 rounded-[3px] border border-rule bg-paper px-4 py-3.5 text-[14px] leading-relaxed">
                <p className="font-medium">
                  {lastWait.for === 'partner-join'
                    ? t({ en: 'Your partner hasn’t opened the link yet.', ar: 'لم تفتح شريكتك الرابط بعد.', arF: 'لم يفتح شريكك الرابط بعد.' })
                    : lastWait.for === 'creator-confirm'
                      ? t({ en: 'The person who shared the link hasn’t confirmed you yet.', ar: 'لم يؤكدك من شارك الرابط بعد.' })
                      : t({ en: 'Your partner’s phone hasn’t answered yet.', ar: 'لم يردّ هاتف شريكتك بعد.', arF: 'لم يردّ هاتف شريكك بعد.' })}
                </p>
                <p className="mt-1 text-ink-2">{t({ en: 'You can keep this screen open, or stop and try again later. The link works for 10 minutes.', ar: 'يمكنك إبقاء هذه الشاشة مفتوحة، أو التوقف والمحاولة لاحقاً. يعمل الرابط 10 دقائق.' })}</p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {role === 'A' && !embedded
                    ? <button onClick={copyLink} className="min-h-11 rounded-[2px] border border-ink px-3 font-medium">{copied ? t({ en: 'Copied', ar: 'نُسخ الرابط' }) : t({ en: 'Copy the link again', ar: 'انسخ الرابط مجدداً', arF: 'انسخي الرابط مجدداً' })}</button>
                    : <span />}
                  <button onClick={cancelCompare} className="min-h-11 rounded-[2px] border border-ink px-3 font-medium">{t({ en: 'Cancel', ar: 'إلغاء' })}</button>
                </div>
              </div>
            ) : (
              <>
                {!joiner && <div className="mt-6 h-1 w-full overflow-hidden bg-wool-2"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-ink motion-reduce:animate-none" /></div>}
                <button onClick={cancelCompare} className="mt-4 min-h-11 w-full rounded-[2px] border border-ink px-4 text-[15px] font-medium">{t({ en: 'Cancel', ar: 'إلغاء' })}</button>
              </>
            )}
          </section>
        )}

        {view === 'result' && result && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
              <p className="text-[13px] text-ink-2">{t({ en: 'Your result together', ar: 'نتيجتكما معاً' })}</p>
              <LevelPicker lang={lang} level={level} setLevel={setLevel} />
            </div>

            {genes.length === 0 ? (
              <>
                {h2(t({ en: 'You don’t share a change in any of the genes screened.', ar: 'لا تشتركان في تغيّر في أي من الجينات التي شملها الفحص.' }), 'mt-2 text-[26px] leading-tight')}
                <div className="mt-4 overflow-hidden rounded-[3px] border border-ink"><Sadu height={52} motifs={9} seed={7} /></div>
                {simple
                  ? <p className="mt-4 text-[15px] leading-relaxed text-ink">{t({ en: 'This lowers the chance of the conditions tested. No test can rule out everything. A counsellor will explain the details.', ar: 'هذا يخفض احتمال الحالات التي فُحصت. ولا يستطيع أي فحص استبعاد كل شيء. وسيشرح المرشد الوراثي التفاصيل.' })}</p>
                  : <p className="mt-4 text-[15px] leading-relaxed text-ink">{t({ en: 'This lowers the chance of the conditions tested, but no test can rule out every inherited condition. Some carriers are missed by standard tests (for example some SMA and alpha-thalassaemia carriers); a genetic counsellor can say whether extra tests make sense for you.', ar: 'هذا يخفض احتمال الحالات التي فُحصت، لكن لا يستطيع أي فحص استبعاد كل الحالات الوراثية. وقد لا تكشف الفحوص المعتادة بعض الحاملين (مثل بعض حاملي ضمور العضلات الشوكي وألفا ثلاسيميا)، ويمكن للمرشد الوراثي أن يوضح إن كانت فحوص إضافية مفيدة لكما.' })}</p>}
              </>
            ) : (
              <>
                {h2(sharedHeadline(genes, lang), 'mt-2 text-[26px] leading-tight')}
                <p className="mt-2 text-[15px] leading-relaxed text-ink">
                  {xlGenes.length
                    ? t({ en: 'This is about the chance for a future child, not a diagnosis. A genetic counsellor will go through it with you both.', ar: 'هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً. وسيشرحه المرشد الوراثي لكما معاً.' })
                    : t({ en: 'You are both healthy carriers. This is about the chance for a future child, not a diagnosis.', ar: 'كلاكما حامل للتغيّر وبصحة جيدة. هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً.' })}
                </p>
                {arGenes.map((g) => <SharedGeneCard key={g.gene} g={g} lang={lang} t={t} level={level} />)}
                {xlGenes.map((g) => <XlCoupleCard key={g.gene} g={g} t={t} level={level} />)}
              </>
            )}

            <MoreDetail when={simple} t={t}>
              {simple && arGenes.map((g) => <SharedGeneCard key={g.gene} g={g} lang={lang} t={t} level={level} part="detail" />)}
              <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{t(ALONE)}</p>
              {related && (
                <div className="mt-5 border-s-2 border-ink ps-4 text-[14px] leading-relaxed text-ink-2">
                  {t({
                    en: `${told(relationship).en} Related parents have a slightly higher chance of a child with a condition that this screening did not test. ${KIN[relationship]?.en ?? ''} The screening already removes part of that extra chance.${genes.length ? ' Being related does not change the chances for the genes above.' : ''}`,
                    ar: `${told(relationship).ar} الوالدان اللذان تجمعهما قرابة لديهما احتمال أعلى قليلاً لإنجاب طفل مصاب بحالة لم يشملها الفحص. ${KIN[relationship]?.ar ?? ''} ويزيل الفحص جزءاً من هذا الاحتمال الإضافي.${genes.length ? ' ولا تغيّر القرابة الاحتمالات الخاصة بالجينات أعلاه.' : ''}`,
                  })}
                </div>
              )}
            </MoreDetail>

            {personal > 0 && <PersonalCallout t={t} sex={me.sex} read={seenPersonal} onOpen={() => openResults('personal')} />}
            {booking && <CounsellorStatus t={t} booking={booking} onOpen={() => book(false)} />}

            <div className="mt-6 grid grid-cols-2 gap-2.5 text-[14px] font-medium">
              <button className="min-h-12 rounded-[2px] border border-ink px-3 py-3" onClick={() => go('options')}>{t({ en: 'Your options', ar: 'خياراتكما' })}</button>
              <button className="min-h-12 rounded-[2px] bg-ink px-3 py-3 text-wool" onClick={() => book(false)}>{t({ en: 'Talk to a genetic counsellor', ar: 'تحدّث إلى مرشد وراثي', arF: 'تحدّثي إلى مرشد وراثي' })}</button>
              <button className="min-h-12 rounded-[2px] border border-ink px-3 py-3" onClick={() => go('ask')}>{t({ en: 'Ask a question', ar: 'اطرح سؤالاً', arF: 'اطرحي سؤالاً' })}</button>
              <button className="min-h-12 rounded-[2px] border border-ink px-3 py-3" onClick={() => go('family')}>{t({ en: 'Tell relatives', ar: 'أخبر أقاربك', arF: 'أخبري أقاربك' })}</button>
            </div>

            <TeachBack lang={lang} t={t} level={level} thal={thal} seed={`${me.id}:${link ? sessionId(link) : ''}`} kind={xlGenes.length && !arGenes.some((g) => g.strength === 2) ? 'xl' : arGenes.length ? (['low', 'milder', 'shared'] as const)[Math.max(...arGenes.map((g) => g.strength))] : 'none'} chance={arGenes.length ? chanceOf(arGenes[0]) : 'quarter'} outcomes={arGenes[0]?.gene === 'HBA' ? arGenes[0].outcomes : undefined} identity={identity} onCounsellor={() => book(false)} />

            {link && role && identity && (
              <details className="mt-6 text-[13px] text-ink-2">
                <summary className="cursor-pointer py-2.5 font-medium text-ink">{t({ en: 'Other choices about sharing', ar: 'خيارات أخرى للمشاركة' })}</summary>
                <SeeEverything t={t} lang={lang} level={level} identity={identity} session={sessionId(link)} role={role} />
              </details>
            )}

            <details className="mt-2 text-[13px] text-ink-2">
              <summary className="cursor-pointer py-2.5 font-medium text-ink">{t({ en: 'What left this phone, and how it was checked', ar: 'ما الذي خرج من هذا الهاتف، وكيف تم التحقق' })}</summary>
              <ul className="mt-2 list-disc space-y-1.5 ps-5">
                <li>{t({ en: 'Encrypted messages of random-looking numbers, through a relay that could not read them.', ar: 'رسائل مشفّرة من أرقام عشوائية المظهر، عبر وسيط لا يستطيع قراءتها.' })}</li>
                <li>{t({ en: 'Your partner’s phone proved, mathematically, that it locked the lists honestly. A tampered list would have stopped the comparison.', ar: 'أثبت هاتف شريكتك رياضياً أنه أقفل القوائم بأمانة، ولو عُبث بقائمة لتوقفت المقارنة.', arF: 'أثبت هاتف شريكك رياضياً أنه أقفل القوائم بأمانة، ولو عُبث بقائمة لتوقفت المقارنة.' })}</li>
                <li>{t({ en: 'You both confirmed who you were comparing with before the lab issued anything.', ar: 'أكّد كلاكما هوية الآخر قبل أن يصدر المختبر أي شيء.' })}</li>
                <li>{t({ en: 'The lab named a gene only because both phones’ comparisons found it and its own records agreed. Had either phone reported something else, nothing would have been named.', ar: 'سمّى المختبر الجين فقط لأن مقارنتي الهاتفين وجدتاه ووافقت سجلاته على ذلك. ولو أبلغ أي هاتف بغير ذلك لما سُمّي شيء.' })}</li>
              </ul>
              {sent && <code dir="ltr" className="mt-2 block break-all bg-wool-2 p-2 font-mono text-[11px]">{sent.cipher}…</code>}
            </details>
            <p className="mt-6 text-[12px] text-ink-2">{t({ en: `Synthetic person for the demo: ${me.name.en}, ${me.age}.`, ar: `شخص افتراضي للعرض: ${me.name.ar}، ${me.age}.` })}</p>
          </section>
        )}

        {view === 'options' && <Options lang={lang} t={t} onBack={() => go('result')} onCounsellor={() => book(false)} headingId={vid} />}
        {view === 'counsellor' && identity && (
          <Counsellor lang={lang} t={t} identity={identity} urgent={urgent} urgentSig={urgentSig} onBack={() => go(home)} pairing={link && result ? sessionId(link) : null} role={role}
            genes={genes.map((g) => g.gene)} personalGenes={mineScope === 'personal' && mine ? mine.map((f) => f.gene) : []} level={level} related={related} headingId={vid}
            booking={booking} onBooking={setBooking} initialQuestion={prefill} />
        )}
        {view === 'ask' && (
          <Ask lang={lang} t={t} sex={me.sex} identity={identity ?? undefined} onBack={() => go('result')} genes={arGenes.map((g) => ({ gene: g.gene, strength: g.strength, kind: g.kind as string | undefined, chance: (g as { chance?: Chance }).chance, outcomes: g.outcomes, arrangementUnknown: g.arrangementUnknown }))} xl={xlGenes.map((g) => g.gene)} level={level} related={related}
            onCounsellor={() => book(false)} onUrgent={(sig) => book(true, '', sig)} headingId={vid} />
        )}
        {view === 'family' && (
          <Family lang={lang} t={t} identity={identity ?? ''} pairing={link && result ? sessionId(link) : null} role={role} onBack={() => go(home)} headingId={vid} onCounsellor={(q) => book(false, q)}
            genes={[...new Map([...genes.map((g) => [g.gene, g.inheritance] as const), ...(mine ?? []).map((f) => [f.gene, f.inheritance] as const)]).entries()].map(([gene, inheritance]) => ({ gene, inheritance }))} />
        )}
      </main>

      {confirmOpen && <ConfirmSheet t={t} onCancel={() => setConfirmOpen(false)} onOpen={() => openResults('all')} />}
      {joiner && <JoinerSheet t={t} lang={lang} partner={joiner.partner} onAnswer={joiner.answer} />}
    </div>
  );
}

/** Arabic counts need the dual (2) and plural (3–10) forms; English needs singular/plural. */
function sharedHeadline(genes: SharedGene[], lang: Locale) {
  const n = genes.length;
  // Only milder changes on both sides: say so in the headline, not only on the card.
  if (genes.every((g) => g.inheritance === 'AR' && g.strength === 0)) {
    if (lang === 'en') return n === 1 ? 'You share a milder change: low concern.' : 'You share milder changes: low concern.';
    return n === 1 ? 'تشتركان في تغيّر أخف: احتمال منخفض الأثر.' : 'تشتركان في تغيّرات أخف: احتمال منخفض الأثر.';
  }
  if (lang === 'en') return n === 1 ? 'You both carry a change in one gene.' : `You both carry changes in ${n} genes.`;
  if (n === 1) return 'تحملان معاً تغيّراً في جين واحد.';
  if (n === 2) return 'تحملان معاً تغيّرات في جينين.';
  if (n <= 10) return `تحملان معاً تغيّرات في ${n} جينات.`;
  return `تحملان معاً تغيّرات في ${n} جيناً.`;
}

function BackLink({ lang, onBack }: { lang: Locale; onBack: () => void }) {
  return <button onClick={onBack} className="-ms-2 inline-flex min-h-11 items-center self-start px-2 text-[14px] text-ink-2"><span aria-hidden>{lang === 'ar' ? '→ ' : '← '}</span>{lang === 'ar' ? 'رجوع' : 'Back'}</button>;
}

/** On the Simple reading level the extra explanations wait behind one disclosure. */
function MoreDetail({ when, t, children }: { when: boolean; t: T; children: ReactNode }) {
  if (!when) return <>{children}</>;
  return (
    <details className="mt-4">
      <summary className="cursor-pointer py-2.5 text-[14px] font-medium">{t({ en: 'More detail', ar: 'تفاصيل أكثر' })}</summary>
      {children}
    </details>
  );
}

/**
 * A bottom sheet on the native modal dialog: the page behind is inert, Tab stays inside, Escape is the
 * sheet's own cancel, and focus goes back to whatever opened it.
 */
function Sheet({ labelledBy, onCancel, dismissOnBackdrop, children }: { labelledBy: string; onCancel: () => void; dismissOnBackdrop?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (d.open) d.close();
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={labelledBy} onCancel={(e) => { e.preventDefault(); onCancel(); }}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/40">
      <div className="flex h-full items-end" onClick={(e) => { if (dismissOnBackdrop && e.target === e.currentTarget) onCancel(); }}>
        <div className="mx-auto w-full max-w-[520px] rounded-t-[10px] bg-paper p-5">{children}</div>
      </div>
    </dialog>
  );
}

function ConfirmSheet({ t, onCancel, onOpen }: { t: T; onCancel: () => void; onOpen: () => void }) {
  return (
    <Sheet labelledBy="confirm-title" onCancel={onCancel} dismissOnBackdrop>
      <h3 id="confirm-title" className="text-[18px] font-semibold">{t({ en: 'Open your own results?', ar: 'هل تريد فتح نتائجك الخاصة؟', arF: 'هل تريدين فتح نتائجك الخاصة؟' })}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
        {t({
          en: 'You will see every gene you carry, not only the ones you share. You can close them again, but you can’t un-see them. Your partner is not told.',
          ar: 'سترى كل جين تحمله، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيت. ولا تُبلَّغ شريكتك بذلك.',
          arF: 'سترين كل جين تحملينه، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيتِ. ولا يُبلَّغ شريكك بذلك.',
        })}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button onClick={onCancel} className="min-h-12 rounded-[2px] border border-ink px-3 py-3 text-[15px]" data-autofocus>{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
        <button onClick={onOpen} className="min-h-12 rounded-[2px] bg-ink px-3 py-3 text-[15px] text-wool">{t({ en: 'Open them', ar: 'افتحها', arF: 'افتحيها' })}</button>
      </div>
    </Sheet>
  );
}

/** "Is this your partner?" Nothing is named until both people confirm each other. */
function JoinerSheet({ t, lang, partner, onAnswer }: { t: T; lang: Locale; partner: Partner; onAnswer: (yes: boolean) => void }) {
  const name = partner.name[lang];
  return (
    <Sheet labelledBy="joiner-title" onCancel={() => onAnswer(false)}>
      <h3 id="joiner-title" tabIndex={-1} data-autofocus className="text-[18px] font-semibold outline-none">
        {lang === 'en' ? `${name} is on the other phone. Is this your partner?` : partner.sex === 'F' ? `${name} على الهاتف الآخر. هل هي شريكتك؟` : `${name} على الهاتف الآخر. هل هو شريكك؟`}
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'The name comes from their signed-in identity. If it isn’t who you expected, stop: no result is shown to either of you.', ar: 'يأتي الاسم من الهوية التي سجّل بها الدخول. إن لم يكن من تتوقعه فأوقف المقارنة، ولن تُعرض أي نتيجة لأيّ منكما.', arF: 'يأتي الاسم من الهوية التي سجّل بها الدخول. إن لم يكن من تتوقعينه فأوقفي المقارنة، ولن تُعرض أي نتيجة لأيّ منكما.' })}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button onClick={() => onAnswer(false)} className="min-h-12 rounded-[2px] border border-ink px-3 py-3 text-[15px]">{t({ en: 'No, stop', ar: 'لا، أوقف', arF: 'لا، أوقفي' })}</button>
        <button onClick={() => onAnswer(true)} className="min-h-12 rounded-[2px] bg-ink px-3 py-3 text-[15px] text-wool">{t({ en: 'Yes, continue', ar: 'نعم، تابع', arF: 'نعم، تابعي' })}</button>
      </div>
    </Sheet>
  );
}

function LevelPicker({ lang, level, setLevel }: { lang: Locale; level: Level; setLevel: (l: Level) => void }) {
  const names: Record<Level, { en: string; ar: string }> = { simple: { en: 'Simple', ar: 'مبسّط' }, standard: { en: 'Standard', ar: 'متوسط' }, detailed: { en: 'Detailed', ar: 'مفصّل' } };
  return (
    <div className="flex shrink-0 gap-1 text-[14px]" role="group" aria-label={lang === 'ar' ? 'مستوى القراءة' : 'Reading level'}>
      {(['simple', 'standard', 'detailed'] as Level[]).map((l) => (
        <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`min-h-11 rounded-[2px] border px-2 ${level === l ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2'}`}>{names[l][lang]}</button>
      ))}
    </div>
  );
}

/** "Saeed joined. Confirm below." The partner's verb follows their sex; the instruction follows the reader's. */
function joinedLine(p: Partner, waitedFor: string, lang: Locale, t: T) {
  const name = p.name[lang];
  const she = p.sex === 'F';
  if (waitedFor === 'creator-confirm') {
    return t({ en: `${name} confirmed you. Confirm below.`, ar: `${she ? 'أكّدتك' : 'أكّدك'} ${name}. أكّد أدناه.`, arF: `${she ? 'أكّدتكِ' : 'أكّدكِ'} ${name}. أكّدي أدناه.` });
  }
  return t({ en: `${name} joined. Confirm below.`, ar: `${she ? 'انضمّت' : 'انضمّ'} ${name}. أكّد أدناه.`, arF: `${she ? 'انضمّت' : 'انضمّ'} ${name}. أكّدي أدناه.` });
}

function StepLine({ s, t, lang }: { s: Step; t: T; lang: Locale }) {
  const n = (x: number) => x.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB');
  switch (s.kind) {
    case 'tokens': return <span>{t({ en: `Once you both confirmed, the lab gave this phone ${s.count} tokens for this comparison only, with no gene names.`, ar: `بعد أن أكّد كلاكما، أعطى المختبرُ هذا الهاتفَ ${n(s.count)} رمزاً لهذه المقارنة فقط، دون أسماء جينات.` })}</span>;
    case 'sent': return <span>{t({ en: `Sent this phone’s locked list to the relay, encrypted (${n(s.bytes)} characters).`, ar: `أُرسلت القائمة المقفلة إلى الوسيط مشفّرة (${n(s.bytes)} حرفاً).` })}</span>;
    case 'received': return <span>{t({ en: 'Received your partner’s locked list.', ar: 'وصلت قائمة شريكتك المقفلة.', arF: 'وصلت قائمة شريكك المقفلة.' })}</span>;
    case 'waiting': return <span className="text-ink-2">{s.for === 'partner-confirm'
      ? t({ en: 'Waiting for your partner to confirm…', ar: 'بانتظار أن تؤكد شريكتك…', arF: 'بانتظار أن يؤكد شريكك…' })
      : s.for === 'partner-join' ? t({ en: 'Waiting for your partner to open the link…', ar: 'بانتظار أن تفتح شريكتك الرابط…', arF: 'بانتظار أن يفتح شريكك الرابط…' })
      : s.for === 'creator-confirm' ? t({ en: 'Waiting for the person who shared the link to confirm you…', ar: 'بانتظار أن يؤكدك من شارك الرابط…' })
      : t({ en: 'Waiting for your partner’s phone…', ar: 'بانتظار هاتف شريكتك…', arF: 'بانتظار هاتف شريكك…' })}</span>;
    case 'proof': return <span>{t({ en: 'Checked the lab’s signature on your partner’s first lock, and the proof that the lists were re-locked honestly.', ar: 'تحقق الهاتف من توقيع المختبر على القفل الأول لقائمة الشريك، ومن الإثبات أن القوائم أُعيد قفلها بأمانة.' })}</span>;
    case 'confirmed': return <span>{t({ en: 'You confirmed who you are comparing with.', ar: 'أكّدت هوية من تقارن معه.', arF: 'أكّدتِ هوية من تقارنين معه.' })}</span>;
    case 'done': return <span>{t({ en: `Compared, and confirmed by the lab, in ${(s.result.ms / 1000).toFixed(1)} s.`, ar: `تمت المقارنة وأكدها المختبر في ${n(Number((s.result.ms / 1000).toFixed(1)))} ث.` })}</span>;
  }
}

/** The booked counsellor call, one row on the card and the result: status at a glance. */
function CounsellorStatus({ t, booking, onOpen }: { t: T; booking: Booking; onOpen: () => void }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-[3px] border border-rule bg-paper px-4 py-3">
      <div className="text-[14px] leading-snug">
        <p className="font-medium">{t({ en: 'Your counsellor', ar: 'مرشدك الوراثي' })}</p>
        <p className="text-ink-2">
          {booking.withdrawn
            ? t({ en: 'Consent withdrawn; what you shared was erased.', ar: 'سُحبت الموافقة، ومُسح ما شاركته.', arF: 'سُحبت الموافقة، ومُسح ما شاركتِه.' })
            : t({ en: `Call booked. They will contact you ${dueText(booking.dueBy, 'en')}.`, ar: `تم حجز مكالمة. سيتواصل معك ${dueText(booking.dueBy, 'ar')}.` })}
        </p>
      </div>
      <button onClick={onOpen} className="min-h-11 shrink-0 rounded-[2px] border border-ink px-3 text-[14px] font-medium">{t({ en: 'View', ar: 'عرض' })}</button>
    </div>
  );
}

/** An X-linked result matters whoever the partner is, so it never waits for a pairing. */
function PersonalCallout({ t, sex, onOpen, required, read }: { t: T; sex: 'F' | 'M'; onOpen: () => void; required?: boolean; read?: boolean }) {
  if (read) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-[3px] border border-rule bg-paper px-4 py-3">
        <p className="text-[14px] font-medium">{t({ en: 'You’ve read your personal result.', ar: 'قرأت نتيجتك الخاصة.', arF: 'قرأتِ نتيجتك الخاصة.' })}</p>
        <button onClick={onOpen} className="min-h-11 shrink-0 rounded-[2px] border border-indigo px-3 text-[14px] font-medium text-indigo">{t({ en: 'Open it again', ar: 'افتحها مجدداً', arF: 'افتحيها مجدداً' })}</button>
      </div>
    );
  }
  return (
    <div className="mt-5 rounded-[3px] border border-indigo bg-paper px-4 py-3.5">
      <p className="text-[15px] font-medium text-indigo">{t({ en: 'You have a result that is yours alone.', ar: 'لديك نتيجة تخصّك وحدك.', arF: 'لديكِ نتيجة تخصّك وحدك.' })}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
        {sex === 'F'
          ? t({ en: 'It matters for any future sons whatever your partner carries. Only you can open it.', ar: '', arF: 'تهم أي أبناء ذكور في المستقبل أياً كان ما يحمله شريكك. لا يستطيع أحد غيرك فتحها.' })
          : t({ en: 'It is about your own health, and any daughters you have will carry it. Only you can open it.', ar: 'تخص صحتك أنت، وستكون أي بنات لك حاملاتٍ لهذا التغيّر. لا يستطيع أحد غيرك فتحها.' })}
        {required && ' ' + t({ en: 'Please read it before you compare with your partner, so you never first meet it on a shared screen.', ar: 'اقرأها قبل المقارنة مع شريكتك، كي لا تراها أول مرة على شاشة مشتركة.', arF: 'اقرئيها قبل المقارنة مع شريكك، كي لا تريها أول مرة على شاشة مشتركة.' })}
      </p>
      <button onClick={onOpen} className="mt-3 min-h-11 w-full rounded-[2px] bg-indigo px-4 text-[15px] font-medium text-wool">{t({ en: 'Open my personal result', ar: 'افتح نتيجتي الخاصة', arF: 'افتحي نتيجتي الخاصة' })}</button>
    </div>
  );
}

function FindingCard({ f, t, sex, level, partner }: { f: Finding; t: T; sex: 'F' | 'M'; level: Level; partner?: boolean }) {
  const c = conditionFor(f.gene);
  const maleNote = (c as { maleNote?: L } | null | undefined)?.maleNote;
  return (
    <li className="rounded-[3px] border border-rule bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">{c ? t(c.name) : f.gene}</span>
        <span dir="ltr" className="font-mono text-[12px] text-ink-2">{f.gene}</span>
      </div>
      {c && <p className="mt-1 text-[14px] leading-relaxed text-ink">{t(c.what[level])}</p>}
      {f.inheritance === 'XL' && partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome, so it matters for this person’s own children whoever their partner is. A genetic counsellor can explain what it means for you both.', ar: 'يقع هذا الجين على الكروموسوم X، لذا يهم أطفال هذا الشخص أياً كان شريكه. ويمكن للمرشد الوراثي شرح ما يعنيه لكما.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'F' && !partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t(f.gene === 'FMR1' ? FMR1_CHANCE : { en: 'This gene is on the X chromosome. For each son: a 1 in 2 chance of having the condition, whoever your partner is. For each daughter it depends on your partner: if he doesn’t have the condition, a 1 in 2 chance of carrying it, as you do; if he has it, a 1 in 2 chance of having it, and otherwise she carries it.', ar: 'يقع هذا الجين على الكروموسوم X. لكل ابن: احتمال 1 من 2 أن يصاب بالحالة، أياً كان شريكك. أما البنات فيعتمد الأمر على شريكك: إن لم يكن مصاباً بالحالة فلكل ابنة احتمال 1 من 2 أن تكون حاملةً للتغيّر مثلك، وإن كان مصاباً فلكل ابنة احتمال 1 من 2 أن تصاب بها، وإلا فهي حاملة له.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'M' && !partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome, and men have one X, so this result is about your own health. All your daughters will carry it; your sons will not inherit it from you.', ar: 'يقع هذا الجين على الكروموسوم X، وللرجل نسخة واحدة منه، لذا تخص هذه النتيجة صحتك أنت. ستكون بناتك جميعاً حاملاتٍ للتغيّر، ولن يرثه أبناؤك الذكور منك.' })}</p>
      )}
      {f.severity === 'mild' && <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'A milder change: with a partner’s more serious change in the same gene it can cause a milder form; with another milder change, at most a mild form.', ar: 'تغيّر أخف: مع تغيّر أشد في الجين نفسه لدى الشريك قد يسبب شكلاً أخف من الحالة، ومع تغيّر أخف آخر يسبب شكلاً خفيفاً على الأكثر.' })}</p>}
      {c?.carrierNote && (f.inheritance === 'AR' || sex === 'F') && <p className="mt-1 text-[13px] text-ink-2">{t(c.carrierNote)}</p>}
      {/* A man's own X-linked result: what it can mean for his health, where the card says so. */}
      {f.inheritance === 'XL' && sex === 'M' && !partner && maleNote && <p className="mt-1 text-[14px] leading-relaxed text-ink">{t(maleNote)}</p>}
    </li>
  );
}

/** The "shared" tag: the one place madder appears on a result. */
function SharedTag({ t }: { t: T }) {
  return <span className="rounded-[2px] bg-madder px-1.5 py-0.5 text-[12px] font-medium leading-none text-wool">{t({ en: 'Shared', ar: 'مشترك' })}</span>;
}

/** First sentence, and the rest, for the Simple level's one-line summary of a condition. */
const split = (s: string) => {
  const [first, ...rest] = s.split(/(?<=[.!?؟])\s+/);
  return { first, rest: rest.join(' ') };
};
/** "Congenital adrenal hyperplasia (CAH)" → "congenital adrenal hyperplasia (CAH)", leaving acronyms alone. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
/** Arabic "with": joined to an Arabic word, with a tatweel before Latin. */
const biAr = (s: string) => (/^[؀-ۿ]/.test(s) ? `ب${s}` : `بـ${s}`);

/** At the Simple level, whether a condition's first sentence already says how it is treated. */
const SAYS_CARE = /treat|medicine|transfusion|cure|therap|علاج|يعالج|دواء|نقل دم|الشفاء/i;
/** "MedlinePlus Genetics: …" sources are in English; Arabic readers are told before they tap. */
function SourceLink({ c, t }: { c: NonNullable<ReturnType<typeof conditionFor>>; t: T }) {
  return (
    <a className="mt-2 inline-block py-1 text-[13px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">
      <bdi lang="en" dir="ltr">{c.source.label}</bdi>{t({ en: '', ar: ' (بالإنجليزية)' })}
    </a>
  );
}

/**
 * A shared gene's card. At the Simple level the card keeps to the short version; its longer text goes
 * into the result screen's one "More detail" (part="detail"), so the screen never has two disclosures.
 */
function SharedGeneCard({ g, lang, t, level, part = 'card' }: { g: SharedGene; lang: Locale; t: T; level: Level; part?: 'card' | 'detail' }) {
  const c = conditionFor(g.gene);
  const simple = level === 'simple';
  const name: L = c ? c.name : { en: g.gene, ar: g.gene };
  const kind = g.kind as string | undefined;
  const chance = chanceOf(g);
  // Ink for a full match; the milder tones stay as the card's own signal. Madder is only the tag.
  const tone = g.strength === 2 ? 'ink' : g.strength === 1 ? 'camel' : 'sage';
  const alpha = g.gene === 'HBA' && kind !== undefined;
  const globin = alpha ? alphaText(g) : undefined;
  const asRead = alpha && !!g.arrangementUnknown;
  const odds: L = globin ? globin : g.strength === 0
    ? { en: 'You both carry a milder change. In each pregnancy there is a 1 in 4 chance the child inherits both, which can cause a mild form of the condition. Counselling is available but often not needed.', ar: 'كلاكما يحمل تغيّراً أخف. في كل حمل احتمال 1 من 4 أن يرث الطفل التغيّرين معاً، وقد يسبب ذلك شكلاً خفيفاً من الحالة. الإرشاد الوراثي متاح، لكنه غالباً غير ضروري.' }
    : g.strength === 1
      ? { en: 'One of you carries a milder change. In each pregnancy there is a 1 in 4 chance the child inherits both changes, which usually causes a milder form of the condition. A genetic counsellor will explain what that means for this gene.', ar: 'أحدكما يحمل تغيّراً أخف. في كل حمل احتمال 1 من 4 أن يرث الطفل التغيّرين معاً، وهذا يسبب عادة شكلاً أخف من الحالة. وسيشرح المرشد الوراثي ما يعنيه ذلك لهذا الجين.' }
      : level === 'simple'
        ? { en: 'If you had four children, on average one might have the condition, two would carry it and be healthy like you, and one would not carry it. The chance is the same in every pregnancy.', ar: 'إذا رُزقتما بأربعة أطفال، فقد يُصاب واحد منهم في المتوسط، ويحمل اثنان التغيّر وهما بصحة جيدة مثلكما، ولا يحمله واحد. ويبقى الاحتمال نفسه في كل حمل.' }
        : { en: 'In each pregnancy: a 1 in 4 chance the child has the condition, 2 in 4 that the child is a healthy carrier like you, and 1 in 4 that the child has no changed copy.', ar: 'في كل حمل: احتمال 1 من 4 أن يصاب الطفل بالحالة، و2 من 4 أن يكون حاملاً للتغيّر وبصحة جيدة مثلكما، و1 من 4 ألا يحمل أي نسخة متغيرة.' };
  // The most likely outcome first. Only for a plain recessive full match is it "3 in 4 won't have it":
  // globin pairs and milder matches differ, and their own text leads instead.
  const plain = g.strength === 2 && !kind;
  const lead: L | null = !plain ? null : simple
    ? { en: '3 in 4 children won’t have it.', ar: '3 من كل 4 أطفال لن يُصابوا بها.' }
    : { en: `3 in 4 children will not have ${lowerFirst(name.en)}.`, ar: `3 من كل 4 أطفال لن يُصابوا ${biAr(name.ar)}.` };
  const title = asRead ? { en: 'Results as read: confirm first', ar: 'النتيجة كما قُرئت: يلزم التأكيد أولاً' } : kind === 'trait' ? { en: 'Not an illness', ar: 'ليست مرضاً' } : g.strength === 0 ? { en: 'Low concern', ar: 'احتمال منخفض الأثر' } : g.strength === 1 ? { en: 'Milder form possible', ar: 'شكل أخف محتمل' } : null;
  const first = kind === 'trait' ? 'carrier' : g.strength === 0 ? 'mild' : 'affected';
  const firstLabel: L = kind === 'trait' ? { en: 'trait, not an illness', ar: 'سمة، ليست مرضاً' }
    : kind === 'bart' ? { en: 'Hb Bart’s hydrops', ar: 'استسقاء بخضاب بارت' }
    : kind === 'hbh-severe' ? { en: 'severe HbH possible', ar: 'مرض H شديد محتمل' }
    : kind === 'hbh' ? { en: 'HbH disease', ar: 'مرض الهيموغلوبين H' }
    : g.strength === 0 ? { en: 'a mild form at most', ar: 'شكل خفيف على الأكثر' }
    : g.strength === 1 ? { en: 'usually a milder form', ar: 'شكل أخف عادة' }
    : { en: 'has the condition', ar: 'مصاب بالحالة' };
  // Clear, carrier, carrier, then the one in four: read from the likeliest outcome to the least.
  // For a 1 in 2, 3 in 4 or every-pregnancy pair the four children change with it.
  const clear: L = simple ? { en: 'not a carrier', ar: 'غير حامل للتغيّر' } : { en: 'no changed copy', ar: 'بلا نسخة متغيرة' };
  const carrier: L = { en: 'healthy carrier', ar: 'حامل سليم' };
  type Kid = { fill: 'affected' | 'mild' | 'carrier' | 'clear'; label: L };
  // Alpha globin: the four children are the lab's four combinations, each labelled with its outcome.
  const ALPHA_KID: Record<AlphaOutcome, Kid> = {
    unaffected: { fill: 'clear', label: clear }, carrier: { fill: 'carrier', label: carrier },
    trait: { fill: 'carrier', label: { en: 'trait, not an illness', ar: 'سمة، ليست مرضاً' } },
    hbh: { fill: 'affected', label: { en: 'HbH disease', ar: 'مرض الهيموغلوبين H' } },
    'hbh-severe': { fill: 'affected', label: { en: 'HbH, can be severe', ar: 'مرض H، قد يكون شديداً' } },
    bart: { fill: 'affected', label: { en: 'Hb Bart’s hydrops', ar: 'استسقاء بخضاب بارت' } },
  };
  const alphaKids = alpha && g.outcomes?.length ? [...g.outcomes].reverse().flatMap((o) => Array.from({ length: o.n }, () => ALPHA_KID[o.kind])) : null;
  const kids: Kid[] = alphaKids?.length === 4 ? alphaKids : chance === 'all'
    ? [0, 1, 2, 3].map(() => ({ fill: first, label: firstLabel }))
    : chance === 'half'
      ? [{ fill: 'carrier', label: carrier }, { fill: 'carrier', label: carrier }, { fill: first, label: firstLabel }, { fill: first, label: firstLabel }]
      : chance === 'three-quarters'
        ? [{ fill: 'carrier', label: carrier }, { fill: first, label: firstLabel }, { fill: first, label: firstLabel }, { fill: first, label: firstLabel }]
        : [{ fill: 'clear', label: clear }, { fill: 'carrier', label: carrier }, { fill: 'carrier', label: carrier }, { fill: first, label: firstLabel }];
  const same: L = alphaKids && new Set(g.outcomes!.map((o) => o.kind)).size > 1
    ? { en: 'What happened before doesn’t change it: the chances are the same in every pregnancy.', ar: 'لا يتأثر الاحتمال بما سبق: تبقى الاحتمالات نفسها في كل حمل.' }
    : chance === 'all'
    ? { en: 'It is the same in every pregnancy.', ar: 'ويبقى ذلك في كل حمل.' }
    : { en: `What happened before doesn’t change it: it is ${ONE_IN[chance].en} in every pregnancy.`, ar: `لا يتأثر الاحتمال بما سبق: يبقى ${ONE_IN[chance].ar} في كل حمل.` };
  const what = c ? split(t(c.what[level])) : null;
  // Simple: one plain line on care, unless the first sentence already says how it is treated.
  const careUp = !!c && simple && !SAYS_CARE.test(what?.first ?? '');
  const rest = (
    <>
      {(!simple || plain) && <p className="mt-3 text-[15px] leading-relaxed">{t(odds)}</p>}
      <p className="mt-1.5 text-[13px] text-ink-2">{t(same)}</p>
      {c && (
        <>
          {!simple && <p className="mt-4 text-[15px] leading-relaxed text-ink">{t(c.what[level])}</p>}
          {simple && what?.rest && <p className="mt-3 text-[15px] leading-relaxed text-ink">{what.rest}</p>}
          {!careUp && <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>}
          {c.carrierNote && <p className="mt-1.5 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'For you as carriers: ', ar: 'لكما كحاملين للتغيّر: ' })}</span>{t(c.carrierNote)}</p>}
          {CONFIRM[g.gene] && !asRead && <p className="mt-3 border-s-2 border-camel ps-3 text-[13px] leading-relaxed text-ink">{t(CONFIRM[g.gene])}</p>}
          <SourceLink c={c} t={t} />
        </>
      )}
    </>
  );
  if (part === 'detail') {
    return (
      <div className="mt-4 border-s-2 border-rule ps-4">
        <p className="text-[14px] font-semibold">{t(name)}</p>
        {rest}
      </div>
    );
  }
  const listen = simple
    ? [t(name), asRead ? t(ALPHA_AS_READ) : '', lead ? t(lead) : t(odds), what?.first ?? '', careUp && c ? t(c.care) : ''].filter(Boolean).join(' ')
    : [t(name), asRead ? t(ALPHA_AS_READ) : '', lead ? t(lead) : '', t(odds), c ? t(c.what[level]) : '', c ? t(c.care) : ''].filter(Boolean).join(' ');
  return (
    <article className={`mt-5 rounded-[3px] border bg-paper ${tone === 'ink' ? 'border-ink' : tone === 'camel' ? 'border-camel' : 'border-sage'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div>
          <p className="flex items-center gap-2"><SharedTag t={t} /><span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene}</span></p>
          <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{t(name)}</h3>
          {title && <p className={`text-[13px] font-medium ${tone === 'camel' || asRead ? 'text-camel' : 'text-sage'}`}>{t(title)}</p>}
        </div>
        <Listen lang={lang} text={listen} />
      </div>
      <div className="px-4 py-4">
        {/* The confirm note comes first: everything below is the result as read. */}
        {asRead && <p className="mb-3 border-s-2 border-camel ps-3 text-[14px] leading-relaxed text-ink">{t(ALPHA_AS_READ)}</p>}
        {lead ? <p className="text-[17px] font-semibold leading-snug">{t(lead)}</p> : simple && <p className="text-[15px] leading-relaxed">{t(odds)}</p>}
        <ul className={`grid grid-cols-4 gap-1.5 ${lead || simple ? 'mt-3' : ''}`} role="img" aria-label={t(odds)}>
          {kids.map((k, i) => (
            <li key={i} className="flex flex-col items-center gap-1 text-center">
              <Diamond fill={k.fill} size={40} color={`var(--${tone})`} />
              <span className="text-[12px] leading-tight text-ink-2">{t(k.label)}</span>
            </li>
          ))}
        </ul>
        {simple ? (
          <>
            {what && <p className="mt-4 text-[15px] leading-relaxed">{what.first}</p>}
            {careUp && c && <p className="mt-2 text-[15px] leading-relaxed">{t(c.care)}</p>}
            <p className="mt-2 text-[15px] leading-relaxed">{t({ en: 'A counsellor will explain the details.', ar: 'سيشرح لكما المرشد الوراثي التفاصيل.' })}</p>
          </>
        ) : rest}
      </div>
    </article>
  );
}

/** X-linked match: she carries it and he has it. Every daughter is affected or a carrier. */
function XlCoupleCard({ g, t, level }: { g: SharedGene; t: T; level: Level }) {
  const c = conditionFor(g.gene);
  return (
    <article className="mt-5 rounded-[3px] border border-ink bg-paper">
      <div className="border-b border-rule px-4 py-3">
        <p className="flex items-center gap-2"><SharedTag t={t} /><span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene} · X</span></p>
        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug">{c ? t(c.name) : g.gene}</h3>
      </div>
      <div className="px-4 py-4 text-[15px] leading-relaxed">
        <p>{t({ en: 'This gene is on the X chromosome. The woman carries a change in it, and the man’s result means he has the condition himself.', ar: 'يقع هذا الجين على الكروموسوم X. تحمل المرأة تغيّراً فيه، وتعني نتيجة الرجل أنه مصاب بالحالة نفسها.' })}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{t({ en: 'Each son: a 1 in 2 chance of having the condition.', ar: 'لكل ابن: احتمال 1 من 2 أن يصاب بالحالة.' })}</li>
          <li>{t({ en: 'Each daughter: a 1 in 2 chance of having it; otherwise she carries it. No daughter would be free of it.', ar: 'لكل ابنة: احتمال 1 من 2 أن تصاب بها، وإلا فهي حاملة للتغيّر. ولن تخلو منه أي ابنة.' })}</li>
        </ul>
        {c && <p className="mt-3 text-ink">{t(c.what[level])}</p>}
        {c && <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>}
        {c && <SourceLink c={c} t={t} />}
      </div>
    </article>
  );
}

/** Full mutual disclosure, as a choice: the lab shows each partner's full results only once both ask. */
function SeeEverything({ t, lang, level, identity, session, role }: { t: T; lang: Locale; level: Level; identity: string; session: string; role: 'A' | 'B' }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'waiting' | 'done' | 'error'>('idle');
  const [theirs, setTheirs] = useState<{ findings: Finding[]; sex: 'F' | 'M' } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Ask once, then keep asking every few seconds until the partner has chosen too (up to 10 minutes).
  const ask = async () => {
    for (let i = 0; i < 200 && alive.current; i++) {
      const r = await fetch('/api/lab/share', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ session, role }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setState('error'); return; }
      if (!j.waiting) { setTheirs({ findings: j.findings, sex: j.sex }); setState('done'); return; }
      setState('waiting');
      await new Promise((res) => setTimeout(res, 3000));
    }
  };
  return (
    <section className="mt-2 rounded-[3px] border border-rule bg-paper px-4 py-4">
      <h3 className="text-[16px] font-semibold">{t({ en: 'Would you rather see everything, together?', ar: 'هل تفضّلان رؤية كل شيء معاً؟' })}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t({ en: 'Some couples prefer full openness. If you both choose it, each of you sees all of the other’s results. Nothing is shown until both have chosen, and choosing can’t be undone.', ar: 'يفضّل بعض الأزواج الانفتاح الكامل. إن اخترتما ذلك معاً يرى كل منكما كل نتائج الآخر. ولا يُعرض شيء حتى يختار الاثنان، ولا يمكن التراجع عن الاختيار.' })}</p>
      {state === 'idle' && <button onClick={() => setState('confirm')} className="mt-3 min-h-11 rounded-[2px] border border-ink px-4 text-[14px] font-medium">{t({ en: 'I’d like us to see everything', ar: 'أودّ أن نرى كل شيء' })}</button>}
      {state === 'confirm' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setState('idle')} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px]">{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
          <button onClick={() => { void ask(); }} className="rounded-[2px] bg-ink px-4 py-2.5 text-[14px] font-medium text-wool">{t({ en: 'Yes, if my partner chooses it too', ar: 'نعم، إن اختارت شريكتي ذلك أيضاً', arF: 'نعم، إن اختار شريكي ذلك أيضاً' })}</button>
        </div>
      )}
      {state === 'waiting' && <p role="status" className="mt-3 text-[14px]">{t({ en: 'You chose this. Waiting for your partner to choose the same; until then, nothing is shown to either of you.', ar: 'اخترت ذلك. بانتظار أن تختار شريكتك الأمر نفسه، ولا يُعرض شيء لأي منكما حتى ذلك الحين.', arF: 'اخترتِ ذلك. بانتظار أن يختار شريكك الأمر نفسه، ولا يُعرض شيء لأي منكما حتى ذلك الحين.' })}</p>}
      {state === 'error' && <p role="alert" className="mt-3 text-[14px] text-alert">{t({ en: 'This isn’t available for this comparison. Compare again to try.', ar: 'هذا غير متاح لهذه المقارنة. أعيدا المقارنة للمحاولة.' })}</p>}
      {state === 'done' && theirs && (
        <div className="mt-3">
          <p className="text-[14px] font-medium">{t({ en: 'You both chose this. Your partner’s full results:', ar: 'اخترتما ذلك معاً. نتائج شريكتك الكاملة:', arF: 'اخترتما ذلك معاً. نتائج شريكك الكاملة:' })}</p>
          {theirs.findings.length === 0 ? <p className="mt-2 text-[14px]">{t({ en: 'No changes found among the genes screened.', ar: 'لم تُكتشف أي تغيّرات ضمن الجينات التي شملها الفحص.' })}</p> : (
            <ul className="mt-2 space-y-3">{theirs.findings.map((f) => <FindingCard key={f.gene} f={f} t={t} sex={theirs.sex} level={level} partner />)}</ul>
          )}
          <p className="mt-2 text-[12px] text-ink-2">{lang === 'ar' ? 'أطلق المختبر هذه النتائج من سجلاته.' : 'The lab released these from its own records.'}</p>
        </div>
      )}
    </section>
  );
}
