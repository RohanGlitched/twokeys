'use client';
// The person's app: their results card, the pairing with their partner, and the couple result.
// Arabic is written for the reader: `ar` addresses a man (whose partner is a woman) and `arF` a woman
// (whose partner is a man).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import type { Locale } from '@/i18n/locales';
import type { Finding, SharedGene } from '@/lib/lab';
import { checkWords, linkFragment, newLink, parseFragment, runInitiator, runResponder, sessionId, type Link, type PairResult, type Partner, type Step } from '@/lib/pairing';
import { conditionFor, type Level } from '@/lib/conditions';
import { F, type Relationship } from '@/lib/risk';
import { Diamond, Mark, Person } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';
import { Ask, Counsellor, Family, Options } from './Views';
import { TeachBack } from './TeachBack';
import { Listen } from './Listen';

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
}

type View = 'card' | 'mine' | 'pair' | 'running' | 'result' | 'options' | 'counsellor' | 'ask' | 'family';

/** The relationship, said to the couple: "You told us that …". */
export const REL: Record<Relationship, { en: string; ar: string }> = {
  unrelated: { en: 'you are not related', ar: 'لا قرابة بينكما' },
  'second-cousins': { en: 'you are second cousins', ar: 'أنكما قريبان من الدرجة الثانية' },
  'first-cousins-once-removed': { en: 'you are first cousins once removed', ar: 'أن أحدكما ابن عمّ أو خال لأحد والدَي الآخر' },
  'first-cousins': { en: 'you are first cousins', ar: 'أنكما ابنا عمّ أو خال من الدرجة الأولى' },
  'double-first-cousins': { en: 'you are double first cousins', ar: 'أنكما ابنا عمّ وابنا خالة في آن واحد' },
};
const told = (r: Relationship) => ({ en: `You told us ${REL[r].en}.`, ar: r === 'unrelated' ? 'أخبرتنا أنه لا قرابة بينكما.' : `أخبرتنا ${REL[r].ar}.` });

/** Genes where the exact pair of changes decides the chance, so a genetic counsellor confirms with a dedicated test. */
const CONFIRM: Record<string, L> = {
  CYP21A2: { en: 'For this gene the exact changes matter: many people carry a mild (non-classic) change, and a mild with a classic change rarely causes the classic form. A genetic counsellor will confirm with a dedicated test before you act on this.', ar: 'في هذا الجين تهم التغيّرات الدقيقة: كثيرون يحملون تغيّراً خفيفاً (غير تقليدي)، ونادراً ما يسبب التغيّر الخفيف مع التقليدي الشكلَ التقليدي. وسيؤكد المرشد الوراثي ذلك بفحص مخصص قبل أي قرار.' },
  HBB: { en: 'For this gene the exact changes matter (for example sickle with beta thalassaemia, or HbC). A genetic counsellor will confirm with a blood test before you act on this.', ar: 'في هذا الجين تهم التغيّرات الدقيقة (مثل المنجلي مع بيتا ثلاسيميا، أو HbC). وسيؤكد المرشد الوراثي ذلك بفحص دم قبل أي قرار.' },
  HBA1: { en: 'For alpha-globin, how the changes sit on each chromosome decides the chance. A genetic counsellor will confirm with a dedicated test before you act on this.', ar: 'في ألفا غلوبين يحدد موضع التغيّرات على كل كروموسوم الاحتمال. وسيؤكد المرشد الوراثي ذلك بفحص مخصص قبل أي قرار.' },
  HBA2: { en: 'For alpha-globin, how the changes sit on each chromosome decides the chance. A genetic counsellor will confirm with a dedicated test before you act on this.', ar: 'في ألفا غلوبين يحدد موضع التغيّرات على كل كروموسوم الاحتمال. وسيؤكد المرشد الوراثي ذلك بفحص مخصص قبل أي قرار.' },
  SMN1: { en: 'For this gene the number of copies matters, and some carriers are missed by standard tests. A genetic counsellor will confirm with a dedicated test.', ar: 'في هذا الجين يهم عدد النسخ، وقد لا تكشف الفحوص المعتادة بعض الحاملين. وسيؤكد المرشد الوراثي ذلك بفحص مخصص.' },
};

/** X-linked genes whose chances or carrier health differ from the usual pattern. */
const XL_NOTE: Record<string, L> = {
  FMR1: { en: 'For this gene the chance depends on the size of the change (repeat number), which can grow when passed on; carriers can have health effects of their own. A genetic counsellor will explain your exact result.', ar: 'في هذا الجين يعتمد الاحتمال على حجم التغيّر (عدد التكرارات)، وقد يكبر عند انتقاله، وقد تظهر لدى الحاملين آثار صحية خاصة بهم. وسيشرح المرشد الوراثي نتيجتك بدقة.' },
  GLA: { en: 'Women who carry this can have symptoms of their own, often later in life; it is worth telling your doctor.', ar: 'قد تظهر أعراض لدى النساء اللواتي يحملن هذا التغيّر، غالباً في سن متقدمة؛ ومن المفيد إخبار الطبيب.' },
  OTC: { en: 'Some women who carry this can become unwell with illness or a high-protein load; tell your doctor.', ar: 'قد تتعب بعض النساء اللواتي يحملن هذا التغيّر عند المرض أو تناول كثير من البروتين؛ أخبري طبيبك.' },
  ABCD1: { en: 'Many women who carry this develop symptoms of their own in adulthood; a genetic counsellor can advise on follow-up.', ar: 'تظهر أعراض لدى كثير من النساء الحاملات لهذا التغيّر في سن الرشد؛ ويمكن للمرشد الوراثي أن ينصح بالمتابعة.' },
};

/** What relatedness adds for conditions this screening did not test, for the actual relationship (Bennett et al. 2002). */
const KIN: Partial<Record<Relationship, { en: string; ar: string }>> = {
  'first-cousins': { en: 'For first cousins that is about 2 to 3 more in every 100 pregnancies than for unrelated parents.', ar: 'وللقريبين من الدرجة الأولى يقارب ذلك 2 إلى 3 حالات إضافية في كل 100 حمل مقارنة بغير الأقارب.' },
  'double-first-cousins': { en: 'For double first cousins it is roughly twice the first-cousin figure: about 4 to 6 more in every 100 pregnancies.', ar: 'ولمن جمعتهما قرابة الأب والأم معاً يقارب ذلك ضعف رقم الدرجة الأولى: نحو 4 إلى 6 حالات إضافية في كل 100 حمل.' },
  'first-cousins-once-removed': { en: 'For first cousins once removed it is about half the first-cousin figure: roughly 1 more in every 100 pregnancies.', ar: 'وفي هذه القرابة يقارب ذلك نصف رقم الدرجة الأولى: نحو حالة إضافية واحدة في كل 100 حمل.' },
  'second-cousins': { en: 'For second cousins it is smaller: under 1 more in every 100 pregnancies.', ar: 'وللقريبين من الدرجة الثانية يكون أقل: أقل من حالة إضافية واحدة في كل 100 حمل.' },
};

export function PhoneApp({ lang, me, relationship, role: fixedRole, embedded }: PhoneProps) {
  const t = useCallback<T>((l) => (lang === 'ar' ? (me.sex === 'F' && l.arF ? l.arF : l.ar) : l.en), [lang, me.sex]);
  const [view, setView] = useState<View>('card');
  const [level, setLevel] = useState<Level>('standard');
  const [identity, setIdentity] = useState<string | null>(null);
  const [personal, setPersonal] = useState(0);
  const [mine, setMine] = useState<Finding[] | null>(null);
  const [mineScope, setMineScope] = useState<'all' | 'personal'>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [role, setRole] = useState<'A' | 'B' | null>(fixedRole ?? null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [result, setResult] = useState<PairResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [joiner, setJoiner] = useState<{ partner: Partner; answer: (yes: boolean) => void } | null>(null);
  const started = useRef(false);
  const firstView = useRef(true);

  // Sign in. The demo's stand-in for UAE PASS: a signed token for this synthetic person, kept in memory only.
  useEffect(() => {
    let live = true;
    fetch('/api/demo/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person: me.id }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; })
      .then((j) => { if (live) { setIdentity(j.token); setPersonal(j.personal ?? 0); } })
      .catch((e) => live && setError(e instanceof Error && e.message ? e.message : 'Could not sign in. Reload the page.'));
    return () => { live = false; };
  }, [me.id]);

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

  // Each new screen announces itself: focus moves to its heading (not on first load).
  useEffect(() => {
    if (firstView.current) { firstView.current = false; return; }
    document.getElementById(`v-${me.id}`)?.focus();
  }, [view, me.id]);

  // In the side-by-side demo, tell the page what left this phone so it can show what the relay saw.
  const report = useCallback((s: Step) => {
    if (!embedded || window.parent === window) return;
    const step = s.kind === 'done' ? { kind: 'done', ms: s.result.ms } : s;
    window.parent.postMessage({ type: 'twokeys-step', person: me.id, step }, window.location.origin);
  }, [embedded, me.id]);

  const shareUrl = useMemo(() => {
    if (!link || typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    for (const k of ['as', 'role', 'embed']) u.searchParams.delete(k);
    u.hash = linkFragment(link);
    return u.toString();
  }, [link]);

  useEffect(() => {
    if (shareUrl && role === 'A') QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: '#22201E', light: '#FAF8F4' } }).then(setQr).catch(() => setQr(''));
  }, [shareUrl, role]);

  const startPairing = () => {
    if (!link) setLink(newLink());
    setRole('A');
    setView('pair');
  };

  // Shows who joined and waits for "yes, this is my partner".
  const confirmPartner = (partner: Partner) => new Promise<boolean>((resolve) => setJoiner({ partner, answer: (yes) => { setJoiner(null); resolve(yes); } }));

  const compare = async () => {
    if (!link || !role || !identity || started.current) return;
    started.current = true;
    setView('running');
    setSteps([]);
    setError(null);
    try {
      const onStep = (s: Step) => { setSteps((x) => [...x, s]); report(s); };
      const opts = { identity, link, onStep, confirmPartner };
      const r = role === 'A' ? await runInitiator(opts) : await runResponder(opts);
      setResult(r);
      setView('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      started.current = false;
    }
  };

  const openResults = async (scope: 'all' | 'personal') => {
    setConfirmOpen(false);
    if (!identity) return;
    const r = await fetch('/api/lab/results', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ confirm: true, scope }) });
    const j = await r.json();
    if (!r.ok) { setError(j.error); return; }
    setMine(j.findings);
    setMineScope(scope);
    setView('mine');
  };

  const book = (isUrgent: boolean) => { setUrgent(isUrgent); setView('counsellor'); };
  const home: View = result ? 'result' : 'card';
  const words = link ? checkWords(link, lang) : [];
  const genes = result?.genes ?? [];
  const arGenes = genes.filter((g) => g.inheritance === 'AR').sort((a, b) => b.strength - a.strength);
  const xlGenes = genes.filter((g) => g.inheritance === 'XL');
  const color = me.sex === 'F' ? 'var(--indigo)' : 'var(--camel)';
  const related = F[relationship] > 0;
  const sent = steps.find((s): s is Extract<Step, { kind: 'sent' }> => s.kind === 'sent');
  const vid = `v-${me.id}`;
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

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        {error && (
          <div role="alert" className="mb-4 border-s-4 border-madder bg-madder-2 px-4 py-3 text-[14px]">
            {error} <button className="ms-2 underline" onClick={() => { setError(null); setView('card'); }}>{t({ en: 'Start over', ar: 'ابدأ من جديد', arF: 'ابدئي من جديد' })}</button>
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
                  en: 'You chose to see your results only with your partner. When you pair, you both learn the genes you both carry, and nothing else. You can change this at any time.',
                  ar: 'اخترت ألا ترى نتائجك إلا مع شريكتك. عند الاقتران تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                  arF: 'اخترتِ ألا تري نتائجك إلا مع شريكك. عند الاقتران تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                })}
              </div>
            </div>
            {personal > 0 && <PersonalCallout t={t} sex={me.sex} onOpen={() => openResults('personal')} />}
            <button onClick={startPairing} disabled={!identity} className="mt-6 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {identity ? t({ en: 'Pair with your partner', ar: 'اقترن بشريكتك', arF: 'اقترني بشريكك' }) : t({ en: 'Signing in…', ar: 'جارٍ تسجيل الدخول…' })}
            </button>
            <div className="mt-6 border-t border-rule pt-4">
              <p className="text-[14px] text-ink-2">{t({ en: 'You also have the right to see your own full results at any time.', ar: 'ولك الحق في رؤية نتائجك الكاملة في أي وقت.' })}</p>
              <button onClick={() => setConfirmOpen(true)} disabled={!identity} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Open my own results', ar: 'افتح نتائجي الخاصة', arF: 'افتحي نتائجي الخاصة' })}</button>
            </div>
          </section>
        )}

        {view === 'mine' && mine && (
          <section>
            <BackLink lang={lang} onBack={() => setView(home)} />
            {h2(mineScope === 'personal' ? t({ en: 'A result that is yours alone', ar: 'نتيجة تخصّك وحدك' }) : t({ en: 'Your own results', ar: 'نتائجك الخاصة' }), 'mt-3 text-[24px]')}
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              {mineScope === 'personal'
                ? t({ en: 'This matters whatever your partner carries, so it doesn’t wait for a pairing. Nobody else sees it unless you share it.', ar: 'يهمّك هذا أياً كان ما تحمله شريكتك، لذلك لا ينتظر الاقتران. ولا يراه أحد غيرك إلا إذا شاركته.', arF: 'يهمّك هذا أياً كان ما يحمله شريكك، لذلك لا ينتظر الاقتران. ولا يراه أحد غيرك إلا إذا شاركتِه.' })
                : t({ en: 'You carry one changed copy of each gene below. Being a carrier is not an illness: it matters mainly if a partner carries the same gene.', ar: 'لديك نسخة واحدة متغيرة من كل جين أدناه. أن تكون حاملاً للتغيّر لا يعني أنك مريض، ويهم ذلك أساساً إذا كانت شريكتك تحمل الجين نفسه.', arF: 'لديكِ نسخة واحدة متغيرة من كل جين أدناه. أن تكوني حاملةً للتغيّر لا يعني أنك مريضة، ويهم ذلك أساساً إذا كان شريكك يحمل الجين نفسه.' })}
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
            <button onClick={() => { setMine(null); setView(home); }} className="mt-4 block text-[14px] font-medium underline underline-offset-4">{t({ en: 'Close my results', ar: 'أغلق نتائجي', arF: 'أغلقي نتائجي' })}</button>
          </section>
        )}

        {view === 'pair' && link && (
          <section>
            {h2(role === 'A' ? t({ en: 'Show this to your partner', ar: 'اعرض هذا على شريكتك', arF: 'اعرضي هذا على شريكك' }) : t({ en: 'Your partner invited you to compare', ar: 'دعتك شريكتك إلى المقارنة', arF: 'دعاكِ شريكك إلى المقارنة' }), 'text-[24px]')}
            {role === 'A' && !embedded && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[3px] border border-rule bg-paper p-4">
                {qr ? <img src={qr} alt={t({ en: 'QR code for your partner', ar: 'رمز QR لشريكتك', arF: 'رمز QR لشريكك' })} width={200} height={200} /> : <div className="h-[200px] w-[200px] animate-pulse bg-wool-2" />}
                <button className="text-[13px] text-indigo underline" onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
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
            <button onClick={compare} disabled={!identity} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {t({ en: 'The words match. Compare now', ar: 'الكلمات متطابقة. قارن الآن', arF: 'الكلمات متطابقة. قارني الآن' })}
            </button>
          </section>
        )}

        {view === 'running' && (
          <section aria-live="polite">
            {h2(t({ en: 'Comparing, privately', ar: 'تجري المقارنة بخصوصية' }), 'text-[24px]')}
            <ol className="mt-4 space-y-3 text-[14px]">
              {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-sage" aria-hidden>✓</span><StepLine s={s} t={t} lang={lang} /></li>)}
            </ol>
            <div className="mt-6 h-1 w-full overflow-hidden bg-wool-2"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-ink motion-reduce:animate-none" /></div>
          </section>
        )}

        {view === 'result' && result && (
          <section>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-ink-2">{t({ en: 'Your result together', ar: 'نتيجتكما معاً' })}</p>
              <LevelPicker lang={lang} level={level} setLevel={setLevel} />
            </div>
            {!result.agrees && (
              <p role="status" className="mt-3 border-s-4 border-camel bg-paper px-3 py-2 text-[13px]">
                {t({ en: 'The lab’s own check didn’t match this phone’s comparison, so you are seeing the lab-confirmed result. If this happens again, pair again.', ar: 'لم يتطابق فحص المختبر مع مقارنة هذا الهاتف، لذا تُعرض النتيجة التي أكدها المختبر. إن تكرر ذلك فأعيدا الاقتران.' })}
              </p>
            )}

            {genes.length === 0 ? (
              <>
                {h2(t({ en: 'You don’t share a change in any of the genes screened.', ar: 'لا تشتركان في تغيّر في أي من الجينات التي شملها الفحص.' }), 'mt-2 text-[26px] leading-tight')}
                <div className="mt-4 overflow-hidden rounded-[3px] border border-ink"><Sadu height={52} motifs={9} seed={7} /></div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{t({ en: 'This lowers the chance of the conditions tested, but no test can rule out every inherited condition. Some carriers are missed by standard tests (for example some SMA and alpha-thalassaemia carriers); a genetic counsellor can say whether extra tests make sense for you.', ar: 'هذا يخفض احتمال الحالات التي فُحصت، لكن لا يستطيع أي فحص استبعاد كل الحالات الوراثية. وقد لا تكشف الفحوص المعتادة بعض الحاملين (مثل بعض حاملي ضمور العضلات الشوكي وألفا ثلاسيميا)، ويمكن للمرشد الوراثي أن يوضح إن كانت فحوص إضافية مفيدة لكما.' })}</p>
              </>
            ) : (
              <>
                {h2(sharedHeadline(genes.length, lang), 'mt-2 text-[26px] leading-tight')}
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                  {xlGenes.length
                    ? t({ en: 'This is about the chance for a future child, not a diagnosis. A genetic counsellor will go through it with you both.', ar: 'هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً. وسيشرحه المرشد الوراثي لكما معاً.' })
                    : t({ en: 'You are both healthy carriers. This is about the chance for a future child, not a diagnosis.', ar: 'كلاكما حامل للتغيّر وبصحة جيدة. هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً.' })}
                </p>
                <div className="mt-3 text-[13px] text-ink-2"><DiamondKey lang={lang} /></div>
                {arGenes.map((g) => <SharedGeneCard key={g.gene} g={g} lang={lang} t={t} level={level} />)}
                {xlGenes.map((g) => <XlCoupleCard key={g.gene} g={g} t={t} level={level} />)}
              </>
            )}

            {personal > 0 && <PersonalCallout t={t} sex={me.sex} onOpen={() => openResults('personal')} />}

            {link && role && identity && <SeeEverything t={t} lang={lang} level={level} identity={identity} session={sessionId(link)} role={role} />}

            {related && (
              <div className="mt-6 border-s-2 border-ink ps-4 text-[14px] leading-relaxed text-ink-2">
                {t({
                  en: `${told(relationship).en} Related parents have a slightly higher chance of a child with a condition that this screening did not test. ${KIN[relationship]?.en ?? ''} The screening already removes part of that extra chance.${genes.length ? ' Being related does not change the chances for the genes above.' : ''}`,
                  ar: `${told(relationship).ar} الوالدان اللذان تجمعهما قرابة لديهما احتمال أعلى قليلاً لإنجاب طفل مصاب بحالة لم يشملها الفحص. ${KIN[relationship]?.ar ?? ''} ويزيل الفحص جزءاً من هذا الاحتمال الإضافي.${genes.length ? ' ولا تغيّر القرابة الاحتمالات الخاصة بالجينات أعلاه.' : ''}`,
                })}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2.5 text-[14px] font-medium">
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('options')}>{t({ en: 'Your options', ar: 'خياراتكما' })}</button>
              <button className="rounded-[2px] bg-ink px-3 py-3 text-wool" onClick={() => book(false)}>{t({ en: 'Talk to a genetic counsellor', ar: 'تحدّث إلى مرشد وراثي', arF: 'تحدّثي إلى مرشد وراثي' })}</button>
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('ask')}>{t({ en: 'Ask a question', ar: 'اطرح سؤالاً', arF: 'اطرحي سؤالاً' })}</button>
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('family')}>{t({ en: 'Tell relatives', ar: 'أخبر أقاربك', arF: 'أخبري أقاربك' })}</button>
            </div>

            <TeachBack lang={lang} t={t} level={level} kind={arGenes.length ? 'shared' : xlGenes.length ? 'xl' : 'none'} identity={identity} onCounsellor={() => book(false)} />

            <details className="mt-6 text-[13px] text-ink-2">
              <summary className="cursor-pointer font-medium text-ink">{t({ en: 'What left this phone, and how it was checked', ar: 'ما الذي خرج من هذا الهاتف، وكيف تم التحقق' })}</summary>
              <ul className="mt-2 list-disc space-y-1.5 ps-5">
                <li>{t({ en: 'Encrypted messages of random-looking numbers, through a relay that could not read them.', ar: 'رسائل مشفّرة من أرقام عشوائية المظهر، عبر وسيط لا يستطيع قراءتها.' })}</li>
                <li>{t({ en: 'Your partner’s phone proved, mathematically, that it locked the lists honestly. A tampered list would have stopped the comparison.', ar: 'أثبت هاتف شريكتك رياضياً أنه أقفل القوائم بأمانة، ولو عُبث بقائمة لتوقفت المقارنة.', arF: 'أثبت هاتف شريكك رياضياً أنه أقفل القوائم بأمانة، ولو عُبث بقائمة لتوقفت المقارنة.' })}</li>
                <li>{t({ en: 'You both confirmed who you were comparing with before anything was named.', ar: 'أكّد كلاكما هوية الآخر قبل أن يُسمّى أي شيء.' })}</li>
                <li>{result.agrees
                  ? t({ en: 'The lab named only the genes that matched, and confirmed the same result from its own records.', ar: 'سمّى المختبر الجينات المتطابقة فقط، وأكد النتيجة نفسها من سجلاته.' })
                  : t({ en: 'The lab’s check differed from this phone’s, so the lab-confirmed result is shown.', ar: 'اختلف فحص المختبر عن فحص هذا الهاتف، لذا تُعرض النتيجة التي أكدها المختبر.' })}</li>
              </ul>
              {sent && <code dir="ltr" className="mt-2 block break-all bg-wool-2 p-2 font-mono text-[11px]">{sent.cipher}…</code>}
            </details>
            <p className="mt-6 text-[12px] text-ink-2">{t({ en: `Synthetic person for the demo: ${me.name.en}, ${me.age}.`, ar: `شخص افتراضي للعرض: ${me.name.ar}، ${me.age}.` })}</p>
          </section>
        )}

        {view === 'options' && <Options lang={lang} t={t} onBack={() => setView('result')} onCounsellor={() => book(false)} headingId={vid} />}
        {view === 'counsellor' && identity && (
          <Counsellor lang={lang} t={t} identity={identity} urgent={urgent} onBack={() => setView(home)} pairing={link && result ? sessionId(link) : null} role={role}
            genes={genes.map((g) => g.gene)} personalGenes={mineScope === 'personal' && mine ? mine.map((f) => f.gene) : []} level={level} related={related} headingId={vid} />
        )}
        {view === 'ask' && (
          <Ask lang={lang} t={t} sex={me.sex} onBack={() => setView('result')} genes={arGenes.map((g) => ({ gene: g.gene, strength: g.strength }))} xl={xlGenes.map((g) => g.gene)} level={level} related={related}
            onCounsellor={() => book(false)} onUrgent={() => book(true)} headingId={vid} />
        )}
        {view === 'family' && (
          <Family lang={lang} t={t} onBack={() => setView(home)} headingId={vid}
            genes={[...new Map([...genes.map((g) => [g.gene, g.inheritance] as const), ...(mine ?? []).map((f) => [f.gene, f.inheritance] as const)]).entries()].map(([gene, inheritance]) => ({ gene, inheritance }))} />
        )}
      </div>

      {confirmOpen && <ConfirmSheet t={t} onCancel={() => setConfirmOpen(false)} onOpen={() => openResults('all')} />}
      {joiner && <JoinerSheet t={t} lang={lang} partner={joiner.partner} onAnswer={joiner.answer} />}
    </div>
  );
}

/** Arabic counts need the dual (2) and plural (3–10) forms; English needs singular/plural. */
function sharedHeadline(n: number, lang: Locale) {
  if (lang === 'en') return n === 1 ? 'You both carry a change in one gene.' : `You both carry changes in ${n} genes.`;
  if (n === 1) return 'تحملان معاً تغيّراً في جين واحد.';
  if (n === 2) return 'تحملان معاً تغيّرات في جينين.';
  if (n <= 10) return `تحملان معاً تغيّرات في ${n} جينات.`;
  return `تحملان معاً تغيّرات في ${n} جيناً.`;
}

function BackLink({ lang, onBack }: { lang: Locale; onBack: () => void }) {
  return <button onClick={onBack} className="text-[14px] text-ink-2"><span aria-hidden>{lang === 'ar' ? '→ ' : '← '}</span>{lang === 'ar' ? 'رجوع' : 'Back'}</button>;
}

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onEscape();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onEscape]);
}

function ConfirmSheet({ t, onCancel, onOpen }: { t: T; onCancel: () => void; onOpen: () => void }) {
  useEscape(onCancel);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="absolute inset-0 z-10 flex items-end bg-ink/40" onClick={onCancel}>
      <div className="w-full rounded-t-[10px] bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" className="text-[18px] font-semibold">{t({ en: 'Open your own results?', ar: 'هل تريد فتح نتائجك الخاصة؟', arF: 'هل تريدين فتح نتائجك الخاصة؟' })}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          {t({
            en: 'You will see every gene you carry, not only the ones you share. You can close them again, but you can’t un-see them. Your partner is not told.',
            ar: 'سترى كل جين تحمله، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيت. ولا تُبلَّغ شريكتك بذلك.',
            arF: 'سترين كل جين تحملينه، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيتِ. ولا يُبلَّغ شريكك بذلك.',
          })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={onCancel} className="rounded-[2px] border border-ink px-3 py-3 text-[15px]" autoFocus>{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
          <button onClick={onOpen} className="rounded-[2px] bg-ink px-3 py-3 text-[15px] text-wool">{t({ en: 'Open them', ar: 'افتحها', arF: 'افتحيها' })}</button>
        </div>
      </div>
    </div>
  );
}

/** "Is this your partner?" Nothing is named until both people confirm each other. */
function JoinerSheet({ t, lang, partner, onAnswer }: { t: T; lang: Locale; partner: Partner; onAnswer: (yes: boolean) => void }) {
  useEscape(() => onAnswer(false));
  const name = partner.name[lang];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="joiner-title" className="absolute inset-0 z-20 flex items-end bg-ink/40">
      <div className="w-full rounded-t-[10px] bg-paper p-5">
        <h3 id="joiner-title" className="text-[18px] font-semibold">
          {lang === 'en' ? `${name} joined this pairing. Is this your partner?` : partner.sex === 'F' ? `انضمّت ${name} إلى هذا الاقتران. هل هي شريكتك؟` : `انضمّ ${name} إلى هذا الاقتران. هل هو شريكك؟`}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'The name comes from their signed-in identity. If it isn’t who you expected, stop: nothing about you is shown to them.', ar: 'يأتي الاسم من الهوية التي سجّل بها الدخول. إن لم يكن من تتوقعه فأوقف المقارنة، ولن يُعرض عنك شيء.', arF: 'يأتي الاسم من الهوية التي سجّل بها الدخول. إن لم يكن من تتوقعينه فأوقفي المقارنة، ولن يُعرض عنك شيء.' })}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={() => onAnswer(false)} className="rounded-[2px] border border-ink px-3 py-3 text-[15px]">{t({ en: 'No, stop', ar: 'لا، أوقف', arF: 'لا، أوقفي' })}</button>
          <button onClick={() => onAnswer(true)} className="rounded-[2px] bg-ink px-3 py-3 text-[15px] text-wool" autoFocus>{t({ en: 'Yes, continue', ar: 'نعم، تابع', arF: 'نعم، تابعي' })}</button>
        </div>
      </div>
    </div>
  );
}

function LevelPicker({ lang, level, setLevel }: { lang: Locale; level: Level; setLevel: (l: Level) => void }) {
  const names: Record<Level, { en: string; ar: string }> = { simple: { en: 'Simple', ar: 'مبسّط' }, standard: { en: 'Standard', ar: 'متوسط' }, detailed: { en: 'Detailed', ar: 'مفصّل' } };
  return (
    <div className="flex gap-1 text-[14px]" role="group" aria-label={lang === 'ar' ? 'مستوى القراءة' : 'Reading level'}>
      {(['simple', 'standard', 'detailed'] as Level[]).map((l) => (
        <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`rounded-[2px] border px-2.5 py-2 ${level === l ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2'}`}>{names[l][lang]}</button>
      ))}
    </div>
  );
}

function DiamondKey({ lang }: { lang: Locale }) {
  const items: { f: 'affected' | 'carrier' | 'clear'; l: { en: string; ar: string } }[] = [
    { f: 'affected', l: { en: 'has the condition', ar: 'مصاب بالحالة' } },
    { f: 'carrier', l: { en: 'healthy carrier', ar: 'حامل للتغيّر وبصحة جيدة' } },
    { f: 'clear', l: { en: 'no changed copy', ar: 'بلا نسخة متغيرة' } },
  ];
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => <span key={i.f} className="inline-flex items-center gap-1.5"><Diamond fill={i.f} size={14} />{i.l[lang]}</span>)}
    </span>
  );
}

function StepLine({ s, t, lang }: { s: Step; t: T; lang: Locale }) {
  const n = (x: number) => x.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB');
  switch (s.kind) {
    case 'tokens': return <span>{t({ en: `The lab gave this phone ${s.count} one-time tokens for this pairing only, with no gene names.`, ar: `أعطى المختبرُ هذا الهاتفَ ${n(s.count)} رمزاً لمرة واحدة لهذا الاقتران فقط، دون أسماء جينات.` })}</span>;
    case 'sent': return <span>{t({ en: `Sent this phone’s locked list to the relay, encrypted (${n(s.bytes)} characters).`, ar: `أُرسلت القائمة المقفلة إلى الوسيط مشفّرة (${n(s.bytes)} حرفاً).` })}</span>;
    case 'received': return <span>{t({ en: 'Received your partner’s locked list.', ar: 'وصلت قائمة شريكتك المقفلة.', arF: 'وصلت قائمة شريكك المقفلة.' })}</span>;
    case 'waiting': return <span className="text-ink-2">{s.for === 'partner-confirm'
      ? t({ en: 'Waiting for your partner to confirm…', ar: 'بانتظار أن تؤكد شريكتك…', arF: 'بانتظار أن يؤكد شريكك…' })
      : t({ en: 'Waiting for your partner’s phone…', ar: 'بانتظار هاتف شريكتك…', arF: 'بانتظار هاتف شريكك…' })}</span>;
    case 'proof': return <span>{t({ en: 'Checked the proof that the lists were locked honestly.', ar: 'تحقق الهاتف من الإثبات أن القوائم أُقفلت بأمانة.' })}</span>;
    case 'confirmed': return <span>{t({ en: 'You confirmed who you are comparing with.', ar: 'أكّدت هوية من تقارن معه.', arF: 'أكّدتِ هوية من تقارنين معه.' })}</span>;
    case 'done': return <span>{t({ en: `Compared, and confirmed by the lab, in ${(s.result.ms / 1000).toFixed(1)} s.`, ar: `تمت المقارنة وأكدها المختبر في ${n(Number((s.result.ms / 1000).toFixed(1)))} ث.` })}</span>;
  }
}

/** An X-linked result matters whoever the partner is, so it never waits for a pairing. */
function PersonalCallout({ t, sex, onOpen }: { t: T; sex: 'F' | 'M'; onOpen: () => void }) {
  return (
    <div className="mt-5 rounded-[3px] border border-indigo bg-paper px-4 py-3.5">
      <p className="text-[15px] font-medium text-indigo">{t({ en: 'You have a result that is yours alone.', ar: 'لديك نتيجة تخصّك وحدك.', arF: 'لديكِ نتيجة تخصّك وحدك.' })}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
        {sex === 'F'
          ? t({ en: 'It matters for any future sons whatever your partner carries, so you may want to see it now. Only you can open it.', ar: '', arF: 'تهم أي أبناء ذكور في المستقبل أياً كان ما يحمله شريكك، فقد ترغبين في رؤيتها الآن. لا يستطيع أحد غيرك فتحها.' })
          : t({ en: 'It is about your own health, and any daughters you have will carry it. Only you can open it.', ar: 'تخص صحتك أنت، وستكون أي بنات لك حاملاتٍ لهذا التغيّر. لا يستطيع أحد غيرك فتحها.' })}
      </p>
      <button onClick={onOpen} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Open my personal result', ar: 'افتح نتيجتي الخاصة', arF: 'افتحي نتيجتي الخاصة' })}</button>
    </div>
  );
}

function FindingCard({ f, t, sex, level, partner }: { f: Finding; t: T; sex: 'F' | 'M'; level: Level; partner?: boolean }) {
  const c = conditionFor(f.gene);
  return (
    <li className="rounded-[3px] border border-rule bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">{c ? t(c.name) : f.gene}</span>
        <span dir="ltr" className="font-mono text-[12px] text-ink-2">{f.gene}</span>
      </div>
      {c && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t(c.what[level])}</p>}
      {f.inheritance === 'XL' && partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome, so it matters for this person’s own children whoever their partner is. A genetic counsellor can explain what it means for you both.', ar: 'يقع هذا الجين على الكروموسوم X، لذا يهم أطفال هذا الشخص أياً كان شريكه. ويمكن للمرشد الوراثي شرح ما يعنيه لكما.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'F' && !partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t(XL_NOTE[f.gene] && f.gene === 'FMR1' ? XL_NOTE.FMR1 : { en: 'This gene is on the X chromosome. For each son: a 1 in 2 chance of having the condition. For each daughter: a 1 in 2 chance of carrying it, as you do. This does not depend on your partner.', ar: 'يقع هذا الجين على الكروموسوم X. لكل ابن: احتمال 1 من 2 أن يصاب بالحالة. ولكل ابنة: احتمال 1 من 2 أن تكون حاملةً للتغيّر مثلك. ولا يعتمد ذلك على شريكك.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'M' && !partner && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome, and men have one X, so this result is about your own health. All your daughters will carry it; your sons will not inherit it from you.', ar: 'يقع هذا الجين على الكروموسوم X، وللرجل نسخة واحدة منه، لذا تخص هذه النتيجة صحتك أنت. ستكون بناتك جميعاً حاملاتٍ للتغيّر، ولن يرثه أبناؤك الذكور منك.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'F' && !partner && XL_NOTE[f.gene] && f.gene !== 'FMR1' && <p className="mt-1 text-[13px] text-ink-2">{t(XL_NOTE[f.gene])}</p>}
      {f.severity === 'mild' && <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'A milder change: with a partner’s more serious change in the same gene it can cause a milder form; with another milder change, at most a mild form.', ar: 'تغيّر أخف: مع تغيّر أشد في الجين نفسه لدى الشريك قد يسبب شكلاً أخف من الحالة، ومع تغيّر أخف آخر يسبب شكلاً خفيفاً على الأكثر.' })}</p>}
      {c?.carrierNote && (f.inheritance === 'AR' || sex === 'F') && <p className="mt-1 text-[13px] text-ink-2">{t(c.carrierNote)}</p>}
    </li>
  );
}

function SharedGeneCard({ g, lang, t, level }: { g: SharedGene; lang: Locale; t: T; level: Level }) {
  const c = conditionFor(g.gene);
  const tone = g.strength === 2 ? 'madder' : g.strength === 1 ? 'camel' : 'sage';
  const odds: L = g.strength === 0
    ? { en: 'You both carry a milder change. In each pregnancy there is a 1 in 4 chance the child inherits both, which can cause a mild form of the condition. Counselling is available but often not needed.', ar: 'كلاكما يحمل تغيّراً أخف. في كل حمل احتمال 1 من 4 أن يرث الطفل التغيّرين معاً، وقد يسبب ذلك شكلاً خفيفاً من الحالة. الإرشاد الوراثي متاح، لكنه غالباً غير ضروري.' }
    : g.strength === 1
      ? { en: 'One of you carries a milder change. In each pregnancy there is a 1 in 4 chance the child inherits both changes, which usually causes a milder form of the condition. A genetic counsellor will explain what that means for this gene.', ar: 'أحدكما يحمل تغيّراً أخف. في كل حمل احتمال 1 من 4 أن يرث الطفل التغيّرين معاً، وهذا يسبب عادة شكلاً أخف من الحالة. وسيشرح المرشد الوراثي ما يعنيه ذلك لهذا الجين.' }
      : level === 'simple'
        ? { en: 'If you had four children, on average one might have the condition, two would carry it and be healthy like you, and one would not carry it. The chance is the same in every pregnancy.', ar: 'إذا رُزقتما بأربعة أطفال، فقد يُصاب واحد منهم في المتوسط، ويحمل اثنان التغيّر وهما بصحة جيدة مثلكما، ولا يحمله واحد. ويبقى الاحتمال نفسه في كل حمل.' }
        : { en: 'In each pregnancy: a 1 in 4 chance the child has the condition, 2 in 4 that the child is a healthy carrier like you, and 1 in 4 that the child has no changed copy.', ar: 'في كل حمل: احتمال 1 من 4 أن يصاب الطفل بالحالة، و2 من 4 أن يكون حاملاً للتغيّر وبصحة جيدة مثلكما، و1 من 4 ألا يحمل أي نسخة متغيرة.' };
  const title = g.strength === 0 ? { en: 'Low concern', ar: 'احتمال منخفض الأثر' } : g.strength === 1 ? { en: 'Milder form possible', ar: 'شكل أخف محتمل' } : null;
  return (
    <article className={`mt-5 rounded-[3px] border bg-paper ${tone === 'madder' ? 'border-madder' : tone === 'camel' ? 'border-camel' : 'border-sage'}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <h3 className={`text-[17px] font-semibold ${tone === 'madder' ? 'text-madder' : tone === 'camel' ? 'text-camel' : 'text-sage'}`}>{c ? t(c.name) : g.gene}{title && <span className="ms-2 text-[13px] font-medium">· {t(title)}</span>}</h3>
        <span className="flex items-center gap-2">
          <Listen lang={lang} text={[c ? t(c.name) : g.gene, t(odds), c ? t(c.what[level]) : '', c ? t(c.care) : ''].filter(Boolean).join(' ')} />
          <span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene}</span>
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-center gap-3" role="img" aria-label={t(odds)}>
          {(['affected', 'carrier', 'carrier', 'clear'] as const).map((k, i) => <Diamond key={i} fill={k} size={40} color={`var(--${tone})`} />)}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">{t(odds)}</p>
        {level !== 'simple' && <p className="mt-1.5 text-[13px] text-ink-2">{t({ en: 'What happened before doesn’t change it: it is 1 in 4 in every pregnancy.', ar: 'لا يتأثر الاحتمال بما سبق: يبقى 1 من 4 في كل حمل.' })}</p>}
        {c && (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">{t(c.what[level])}</p>
            <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>
            {c.carrierNote && <p className="mt-1.5 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'For you as carriers: ', ar: 'لكما كحاملين للتغيّر: ' })}</span>{t(c.carrierNote)}</p>}
            {CONFIRM[g.gene] && <p className="mt-3 border-s-2 border-camel ps-3 text-[13px] leading-relaxed text-ink">{t(CONFIRM[g.gene])}</p>}
            <a className="mt-2 inline-block text-[12px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>
          </>
        )}
      </div>
    </article>
  );
}

/** X-linked match: she carries it and he has it. Every daughter is affected or a carrier. */
function XlCoupleCard({ g, t, level }: { g: SharedGene; t: T; level: Level }) {
  const c = conditionFor(g.gene);
  return (
    <article className="mt-5 rounded-[3px] border border-madder bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-3">
        <h3 className="text-[17px] font-semibold text-madder">{c ? t(c.name) : g.gene}</h3>
        <span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene} · X</span>
      </div>
      <div className="px-4 py-4 text-[15px] leading-relaxed">
        <p>{t({ en: 'This gene is on the X chromosome. The woman carries a change in it, and the man’s result means he has the condition himself.', ar: 'يقع هذا الجين على الكروموسوم X. تحمل المرأة تغيّراً فيه، وتعني نتيجة الرجل أنه مصاب بالحالة نفسها.' })}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{t({ en: 'Each son: a 1 in 2 chance of having the condition.', ar: 'لكل ابن: احتمال 1 من 2 أن يصاب بالحالة.' })}</li>
          <li>{t({ en: 'Each daughter: a 1 in 2 chance of having it; otherwise she carries it. No daughter would be free of it.', ar: 'لكل ابنة: احتمال 1 من 2 أن تصاب بها، وإلا فهي حاملة للتغيّر. ولن تخلو منه أي ابنة.' })}</li>
        </ul>
        {c && <p className="mt-3 text-ink">{t(c.what[level])}</p>}
        {c && <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>}
        {c && <a className="mt-2 inline-block text-[12px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>}
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
    <section className="mt-6 rounded-[3px] border border-rule bg-paper px-4 py-4">
      <h3 className="text-[16px] font-semibold">{t({ en: 'Would you rather see everything, together?', ar: 'هل تفضّلان رؤية كل شيء معاً؟' })}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t({ en: 'Some couples prefer full openness. If you both choose it, each of you sees all of the other’s results. Nothing is shown until both have chosen, and choosing can’t be undone.', ar: 'يفضّل بعض الأزواج الانفتاح الكامل. إن اخترتما ذلك معاً يرى كل منكما كل نتائج الآخر. ولا يُعرض شيء حتى يختار الاثنان، ولا يمكن التراجع عن الاختيار.' })}</p>
      {state === 'idle' && <button onClick={() => setState('confirm')} className="mt-3 rounded-[2px] border border-ink px-4 py-2.5 text-[14px] font-medium">{t({ en: 'I’d like us to see everything', ar: 'أودّ أن نرى كل شيء' })}</button>}
      {state === 'confirm' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setState('idle')} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px]">{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
          <button onClick={() => { void ask(); }} className="rounded-[2px] bg-ink px-4 py-2.5 text-[14px] font-medium text-wool">{t({ en: 'Yes, if my partner chooses it too', ar: 'نعم، إن اختارت شريكتي ذلك أيضاً', arF: 'نعم، إن اختار شريكي ذلك أيضاً' })}</button>
        </div>
      )}
      {state === 'waiting' && <p role="status" className="mt-3 text-[14px]">{t({ en: 'You chose this. Waiting for your partner to choose the same; until then, nothing is shown to either of you.', ar: 'اخترت ذلك. بانتظار أن تختار شريكتك الأمر نفسه، ولا يُعرض شيء لأي منكما حتى ذلك الحين.', arF: 'اخترتِ ذلك. بانتظار أن يختار شريكك الأمر نفسه، ولا يُعرض شيء لأي منكما حتى ذلك الحين.' })}</p>}
      {state === 'error' && <p role="alert" className="mt-3 text-[14px] text-madder">{t({ en: 'This isn’t available for this pairing. Pair again to try.', ar: 'هذا غير متاح لهذا الاقتران. أعيدا الاقتران للمحاولة.' })}</p>}
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
