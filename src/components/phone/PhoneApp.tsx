'use client';
// The person's app: their results card, the pairing with their partner, and the couple result.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Locale } from '@/i18n/locales';
import type { Finding, SharedGene } from '@/lib/lab';
import { checkWords, linkFragment, newLink, parseFragment, runInitiator, runResponder, sessionId, type Link, type PairResult, type Step } from '@/lib/pairing';
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

export const REL: Record<Relationship, { en: string; ar: string }> = {
  unrelated: { en: 'not related', ar: 'لا قرابة بينكما' },
  'second-cousins': { en: 'second cousins', ar: 'أبناء عمومة من الدرجة الثانية' },
  'first-cousins-once-removed': { en: 'first cousins once removed', ar: 'أقارب من الدرجة الأولى بفارق جيل' },
  'first-cousins': { en: 'first cousins', ar: 'أبناء عمومة من الدرجة الأولى' },
  'double-first-cousins': { en: 'double first cousins', ar: 'أبناء عمومة وخؤولة معاً' },
};

/** What relatedness adds for conditions this panel did not test, for the actual relationship (Bennett et al. 2002). */
const KIN: Partial<Record<Relationship, { en: string; ar: string }>> = {
  'first-cousins': { en: 'For first cousins that is about 2 to 3 more in every 100 pregnancies than for unrelated parents.', ar: 'لأبناء العمومة من الدرجة الأولى يقارب ذلك 2 إلى 3 حالات إضافية في كل 100 حمل مقارنة بغير الأقارب.' },
  'double-first-cousins': { en: 'For double first cousins it is roughly twice the first-cousin figure: about 4 to 6 more in every 100 pregnancies.', ar: 'لأبناء العمومة والخؤولة معاً يقارب ذلك ضعف رقم أبناء العمومة من الدرجة الأولى: نحو 4 إلى 6 حالات إضافية في كل 100 حمل.' },
  'first-cousins-once-removed': { en: 'For first cousins once removed it is about half the first-cousin figure: roughly 1 more in every 100 pregnancies.', ar: 'للأقارب من الدرجة الأولى بفارق جيل يقارب ذلك نصف رقم أبناء العمومة من الدرجة الأولى: نحو حالة إضافية واحدة في كل 100 حمل.' },
  'second-cousins': { en: 'For second cousins it is smaller: under 1 more in every 100 pregnancies.', ar: 'لأبناء العمومة من الدرجة الثانية يكون أقل: أقل من حالة إضافية واحدة في كل 100 حمل.' },
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
  const started = useRef(false);

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

  const compare = async () => {
    if (!link || !role || !identity || started.current) return;
    started.current = true;
    setView('running');
    setSteps([]);
    setError(null);
    try {
      const onStep = (s: Step) => { setSteps((x) => [...x, s]); report(s); };
      const r = role === 'A' ? await runInitiator({ identity, link, onStep }) : await runResponder({ identity, link, onStep });
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

  return (
    <div className={`relative flex h-full flex-col bg-wool text-ink ${embedded ? '' : 'min-h-dvh'}`}>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
        <div className="flex items-center gap-2.5" style={{ color }}>
          <Person sex={me.sex} color={color} size={22} />
          <span className="text-[15px] font-medium text-ink">{lang === 'ar' ? `هاتف ${me.name.ar}` : `${me.name.en}’s phone`}</span>
        </div>
        <span className="flex items-center gap-1.5 text-ink-3"><Mark size={20} /></span>
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
            <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{t({ en: 'Your results are sealed on this phone.', ar: 'نتائجك مختومة على هذا الهاتف.' })}</h2>
            <div className="mt-5 overflow-hidden rounded-[3px] border border-ink">
              <Sadu height={64} motifs={9} seed={me.id.length} />
              <div className="bg-paper px-4 py-3.5 text-[14px] leading-relaxed text-ink-2">
                {t({
                  en: 'You chose to see your results only as a couple. When you pair with your partner, you both learn the genes you both carry, and nothing else. You can change this at any time.',
                  ar: 'اخترت أن ترى نتائجك كزوجين فقط. عند الاقتران بشريكك تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                  arF: 'اخترتِ أن تري نتائجك كزوجين فقط. عند الاقتران بشريكك تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها. ويمكنك تغيير ذلك في أي وقت.',
                })}
              </div>
            </div>
            {personal > 0 && <PersonalCallout t={t} onOpen={() => openResults('personal')} />}
            <button onClick={startPairing} disabled={!identity} className="mt-6 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {identity ? t({ en: 'Pair with your partner', ar: 'اقترن بشريكك', arF: 'اقترني بشريكك' }) : t({ en: 'Signing in…', ar: 'جارٍ تسجيل الدخول…' })}
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
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight">
              {mineScope === 'personal' ? t({ en: 'A result that is yours alone', ar: 'نتيجة تخصّك وحدك' }) : t({ en: 'Your own results', ar: 'نتائجك الخاصة' })}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              {mineScope === 'personal'
                ? t({ en: 'This matters for your future children whatever your partner carries, so it doesn’t wait for a pairing. Nobody else sees it unless you share it.', ar: 'يهم هذا أطفالك في المستقبل أياً كان ما يحمله شريكك، لذلك لا ينتظر الاقتران. ولا يراه أحد غيرك إلا إذا شاركته.', arF: 'يهم هذا أطفالك في المستقبل أياً كان ما يحمله شريكك، لذلك لا ينتظر الاقتران. ولا يراه أحد غيرك إلا إذا شاركتِه.' })
                : t({ en: 'You carry one changed copy of each gene below. Being a carrier is not an illness: it matters mainly if a partner carries the same gene.', ar: 'تحمل نسخة واحدة متغيرة من كل جين أدناه. حمل التغيّر ليس مرضاً، ويهم أساساً إذا حمل الشريك الجين نفسه.', arF: 'تحملين نسخة واحدة متغيرة من كل جين أدناه. حمل التغيّر ليس مرضاً، ويهم أساساً إذا حمل الشريك الجين نفسه.' })}
            </p>
            {mine.length === 0 && <p className="mt-4 text-[15px]">{t({ en: 'No changes were found on this panel.', ar: 'لم تُكتشف أي تغيّرات في هذه اللوحة.' })}</p>}
            <ul className="mt-4 space-y-3">
              {mine.map((f) => <FindingCard key={f.gene} f={f} t={t} sex={me.sex} level={level} />)}
            </ul>
            {mineScope === 'personal' && (
              <button onClick={() => book(false)} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">
                {t({ en: 'Talk to a counsellor about this', ar: 'تحدّث إلى مستشار بشأن هذا', arF: 'تحدّثي إلى مستشار بشأن هذا' })}
              </button>
            )}
            <button onClick={() => { setMine(null); setView(home); }} className="mt-4 block text-[14px] font-medium underline underline-offset-4">{t({ en: 'Close my results', ar: 'أغلق نتائجي', arF: 'أغلقي نتائجي' })}</button>
          </section>
        )}

        {view === 'pair' && link && (
          <section>
            <h2 className="text-[24px] font-semibold tracking-tight">
              {role === 'A' ? t({ en: 'Show this to your partner', ar: 'اعرض هذا على شريكك', arF: 'اعرضي هذا على شريكك' }) : t({ en: 'Your partner invited you to compare', ar: 'دعاك شريكك إلى المقارنة', arF: 'دعاكِ شريكك إلى المقارنة' })}
            </h2>
            {role === 'A' && !embedded && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[3px] border border-rule bg-paper p-4">
                {qr ? <img src={qr} alt={t({ en: 'QR code for your partner', ar: 'رمز QR لشريكك' })} width={200} height={200} /> : <div className="h-[200px] w-[200px] animate-pulse bg-wool-2" />}
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
            <p className="mt-5 text-[13px] leading-relaxed text-ink-2">{t({ en: `You told us you are ${REL[relationship].en}.`, ar: `أخبرتنا أنكما ${REL[relationship].ar}.` })}</p>
            <button onClick={compare} disabled={!identity} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
              {t({ en: 'The words match. Compare now', ar: 'الكلمات متطابقة. قارن الآن', arF: 'الكلمات متطابقة. قارني الآن' })}
            </button>
          </section>
        )}

        {view === 'running' && (
          <section aria-live="polite">
            <h2 className="text-[24px] font-semibold tracking-tight">{t({ en: 'Comparing, privately', ar: 'تجري المقارنة بخصوصية' })}</h2>
            <ol className="mt-4 space-y-3 text-[14px]">
              {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-sage" aria-hidden>✓</span><StepLine s={s} lang={lang} /></li>)}
            </ol>
            <div className="mt-6 h-1 w-full overflow-hidden bg-wool-2"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-ink motion-reduce:animate-none" /></div>
          </section>
        )}

        {view === 'result' && result && (
          <section>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-ink-2">{t({ en: 'Your couple result', ar: 'نتيجتكما كزوجين' })}</p>
              <LevelPicker lang={lang} level={level} setLevel={setLevel} />
            </div>
            {!result.agrees && (
              <p role="status" className="mt-3 border-s-4 border-camel bg-paper px-3 py-2 text-[13px]">
                {t({ en: 'The lab’s own check didn’t match this phone’s comparison, so you are seeing the lab-confirmed result. If this happens again, pair again.', ar: 'لم يتطابق فحص المختبر مع مقارنة هذا الهاتف، لذا تُعرض النتيجة التي أكدها المختبر. إن تكرر ذلك فأعيدا الاقتران.' })}
              </p>
            )}

            {genes.length === 0 ? (
              <>
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{t({ en: 'You don’t share a change on this panel that is expected to cause illness.', ar: 'لا تتشاركان في هذه اللوحة تغيّراً يُتوقع أن يسبب مرضاً.' })}</h2>
                <div className="mt-4 overflow-hidden rounded-[3px] border border-ink"><Sadu height={52} motifs={9} seed={7} /></div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{t({ en: 'This lowers the chance of the conditions tested, but no test can rule out every inherited condition.', ar: 'هذا يخفض احتمال الحالات التي فُحصت، لكن لا يستطيع أي فحص استبعاد كل الحالات الوراثية.' })}</p>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{sharedHeadline(genes.length, lang)}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                  {xlGenes.length
                    ? t({ en: 'This is about the chance for a future child, not a diagnosis. A counsellor will go through it with you both.', ar: 'هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً. وسيشرحه المستشار لكما معاً.' })
                    : t({ en: 'You are both healthy carriers. This is about the chance for a future child, not a diagnosis.', ar: 'كلاكما يحمل التغيّر وهو سليم. هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً.' })}
                </p>
                <div className="mt-3 text-[13px] text-ink-2"><DiamondKey lang={lang} /></div>
                {arGenes.map((g) => <SharedGeneCard key={g.gene} g={g} lang={lang} t={t} level={level} />)}
                {xlGenes.map((g) => <XlCoupleCard key={g.gene} g={g} t={t} level={level} />)}
              </>
            )}

            {personal > 0 && <PersonalCallout t={t} onOpen={() => openResults('personal')} />}

            {related && (
              <div className="mt-6 border-s-2 border-ink ps-4 text-[14px] leading-relaxed text-ink-2">
                {t({
                  en: `You told us you are ${REL[relationship].en}. Related parents have a slightly higher chance of a child with a condition that this panel did not test. ${KIN[relationship]?.en ?? ''} Screening on this panel already removes part of that extra chance.${genes.length ? ' It does not change the chances for the genes above.' : ''}`,
                  ar: `أخبرتنا أنكما ${REL[relationship].ar}. لدى الوالدين الأقارب احتمال أعلى قليلاً لطفل بحالة لم تفحصها هذه اللوحة. ${KIN[relationship]?.ar ?? ''} ويزيل الفحص على هذه اللوحة جزءاً من هذا الاحتمال الإضافي.${genes.length ? ' ولا تغيّر القرابة الاحتمالات الخاصة بالجينات أعلاه.' : ''}`,
                })}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2.5 text-[14px] font-medium">
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('options')}>{t({ en: 'Your options', ar: 'خياراتكما' })}</button>
              <button className="rounded-[2px] bg-ink px-3 py-3 text-wool" onClick={() => book(false)}>{t({ en: 'Talk to a counsellor', ar: 'تحدّث إلى مستشار', arF: 'تحدّثي إلى مستشار' })}</button>
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('ask')}>{t({ en: 'Ask a question', ar: 'اطرح سؤالاً', arF: 'اطرحي سؤالاً' })}</button>
              <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => setView('family')}>{t({ en: 'Tell relatives', ar: 'أخبر أقاربك', arF: 'أخبري أقاربك' })}</button>
            </div>

            <TeachBack lang={lang} t={t} level={level} kind={genes.length ? 'shared' : 'none'} identity={identity} onCounsellor={() => book(false)} />

            <details className="mt-6 text-[13px] text-ink-2">
              <summary className="cursor-pointer font-medium text-ink">{t({ en: 'What left this phone, and how it was checked', ar: 'ما الذي خرج من هذا الهاتف، وكيف تم التحقق' })}</summary>
              <ul className="mt-2 list-disc space-y-1.5 ps-5">
                <li>{t({ en: 'Two encrypted messages of random-looking numbers, through a relay that could not read them.', ar: 'رسالتان مشفّرتان من أرقام عشوائية المظهر، عبر وسيط لا يستطيع قراءتهما.' })}</li>
                <li>{t({ en: 'Your partner’s phone proved, mathematically, that it locked both lists honestly. A tampered list would have stopped the comparison.', ar: 'أثبت هاتف شريكك رياضياً أنه أقفل القائمتين بأمانة، ولو عُبث بقائمة لتوقفت المقارنة.' })}</li>
                <li>{result.agrees
                  ? t({ en: 'The lab named only the genes that matched, and confirmed the same result from its own records.', ar: 'سمّى المختبر الجينات المتطابقة فقط، وأكد النتيجة نفسها من سجلاته.' })
                  : t({ en: 'The lab’s check differed from this phone’s, so the lab-confirmed result is shown.', ar: 'اختلف فحص المختبر عن فحص هذا الهاتف، لذا تُعرض النتيجة التي أكدها المختبر.' })}</li>
              </ul>
              {sent && <code dir="ltr" className="mt-2 block break-all bg-wool-2 p-2 font-mono text-[11px]">{sent.cipher}…</code>}
            </details>
            <p className="mt-6 text-[12px] text-ink-2">{t({ en: `Synthetic person for the demo: ${me.name.en}, ${me.age}.`, ar: `شخص افتراضي للعرض: ${me.name.ar}، ${me.age}.` })}</p>
          </section>
        )}

        {view === 'options' && <Options lang={lang} t={t} onBack={() => setView('result')} onCounsellor={() => book(false)} />}
        {view === 'counsellor' && identity && (
          <Counsellor lang={lang} t={t} identity={identity} urgent={urgent} onBack={() => setView(home)} pairing={link && result ? sessionId(link) : null}
            genes={genes.map((g) => g.gene)} personalGenes={mineScope === 'personal' && mine ? mine.map((f) => f.gene) : []} level={level} related={related} />
        )}
        {view === 'ask' && (
          <Ask lang={lang} t={t} onBack={() => setView('result')} genes={arGenes.map((g) => g.gene)} xl={xlGenes.map((g) => g.gene)} level={level} related={related}
            onCounsellor={() => book(false)} onUrgent={() => book(true)} />
        )}
        {view === 'family' && (
          <Family lang={lang} t={t} onBack={() => setView(home)}
            genes={[...new Set([...arGenes.map((g) => g.gene), ...(mine ?? []).filter((f) => f.inheritance === 'AR').map((f) => f.gene)])]} />
        )}
      </div>

      {confirmOpen && <ConfirmSheet t={t} onCancel={() => setConfirmOpen(false)} onOpen={() => openResults('all')} />}
    </div>
  );
}

/** Arabic counts need the dual (2) and plural (3–10) forms; English needs singular/plural. */
function sharedHeadline(n: number, lang: Locale) {
  if (lang === 'en') return n === 1 ? 'You both carry one gene in common.' : `You both carry ${n} genes in common.`;
  if (n === 1) return 'تحملان معاً جيناً واحداً مشتركاً.';
  if (n === 2) return 'تحملان معاً جينين مشتركين.';
  if (n <= 10) return `تحملان معاً ${n} جينات مشتركة.`;
  return `تحملان معاً ${n} جيناً مشتركاً.`;
}

function BackLink({ lang, onBack }: { lang: Locale; onBack: () => void }) {
  return <button onClick={onBack} className="text-[14px] text-ink-2">{lang === 'ar' ? '→ رجوع' : '← Back'}</button>;
}

function ConfirmSheet({ t, onCancel, onOpen }: { t: T; onCancel: () => void; onOpen: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="absolute inset-0 z-10 flex items-end bg-ink/40" onClick={onCancel}>
      <div className="w-full rounded-t-[10px] bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title" className="text-[18px] font-semibold">{t({ en: 'Open your own results?', ar: 'هل تريد فتح نتائجك الخاصة؟', arF: 'هل تريدين فتح نتائجك الخاصة؟' })}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          {t({
            en: 'You will see every gene you carry, not only the ones you share. You can close them again, but you can’t un-see them. Your partner is not told.',
            ar: 'سترى كل جين تحمله، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيت. ولا يُبلَّغ شريكك بذلك.',
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

function LevelPicker({ lang, level, setLevel }: { lang: Locale; level: Level; setLevel: (l: Level) => void }) {
  const names: Record<Level, { en: string; ar: string }> = { simple: { en: 'Simple', ar: 'مبسّط' }, standard: { en: 'Standard', ar: 'عادي' }, detailed: { en: 'Detailed', ar: 'مفصّل' } };
  return (
    <div className="flex gap-1 text-[12px]" role="group" aria-label={lang === 'ar' ? 'مستوى القراءة' : 'Reading level'}>
      {(['simple', 'standard', 'detailed'] as Level[]).map((l) => (
        <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`rounded-[2px] border px-2 py-1 ${level === l ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2'}`}>{names[l][lang]}</button>
      ))}
    </div>
  );
}

function DiamondKey({ lang }: { lang: Locale }) {
  const items: { f: 'affected' | 'carrier' | 'clear'; l: { en: string; ar: string } }[] = [
    { f: 'affected', l: { en: 'has the condition', ar: 'مصاب بالحالة' } },
    { f: 'carrier', l: { en: 'healthy carrier', ar: 'سليم يحمل التغيّر' } },
    { f: 'clear', l: { en: 'no changed copy', ar: 'بلا نسخة متغيرة' } },
  ];
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => <span key={i.f} className="inline-flex items-center gap-1.5"><Diamond fill={i.f} size={14} />{i.l[lang]}</span>)}
    </span>
  );
}

function StepLine({ s, lang }: { s: Step; lang: Locale }) {
  const t = (l: { en: string; ar: string }) => l[lang];
  const n = (x: number) => x.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB');
  switch (s.kind) {
    case 'tokens': return <span>{t({ en: `The lab gave this phone ${s.count} one-time tokens for this pairing only, with no gene names.`, ar: `أعطى المختبرُ هذا الهاتفَ ${n(s.count)} رمزاً لمرة واحدة لهذا الاقتران فقط، دون أسماء جينات.` })}</span>;
    case 'sent': return <span>{t({ en: `Sent this phone’s locked list to the relay, encrypted (${n(s.bytes)} characters).`, ar: `أُرسلت القائمة المقفلة إلى الوسيط مشفّرة (${n(s.bytes)} حرفاً).` })}</span>;
    case 'received': return <span>{t({ en: 'Received your partner’s locked list.', ar: 'وصلت قائمة شريكك المقفلة.' })}</span>;
    case 'waiting': return <span className="text-ink-2">{t({ en: 'Waiting for your partner’s phone…', ar: 'بانتظار هاتف شريكك…' })}</span>;
    case 'proof': return <span>{t({ en: 'Checked the proof that both lists were locked honestly.', ar: 'تحقق الهاتف من الإثبات أن القائمتين أُقفلتا بأمانة.' })}</span>;
    case 'done': return <span>{t({ en: `Compared, and confirmed by the lab, in ${(s.result.ms / 1000).toFixed(1)} s.`, ar: `تمت المقارنة وأكدها المختبر في ${n(Number((s.result.ms / 1000).toFixed(1)))} ث.` })}</span>;
  }
}

/** For a woman with an X-linked carrier result: it matters whoever her partner is, so it never waits for a pairing. */
function PersonalCallout({ t, onOpen }: { t: T; onOpen: () => void }) {
  return (
    <div className="mt-5 rounded-[3px] border border-indigo bg-paper px-4 py-3.5">
      <p className="text-[15px] font-medium text-indigo">{t({ en: 'You have a result that is yours alone.', ar: 'لديكِ نتيجة تخصّك وحدك.' })}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t({ en: 'It matters for any future sons whatever your partner carries, so you may want to see it now. Only you can open it.', ar: 'تهم أي أبناء ذكور في المستقبل أياً كان ما يحمله شريكك، فقد ترغبين في رؤيتها الآن. لا يستطيع أحد غيرك فتحها.' })}</p>
      <button onClick={onOpen} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Open my personal result', ar: 'افتحي نتيجتي الخاصة' })}</button>
    </div>
  );
}

function FindingCard({ f, t, sex, level }: { f: Finding; t: T; sex: 'F' | 'M'; level: Level }) {
  const c = conditionFor(f.gene);
  return (
    <li className="rounded-[3px] border border-rule bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">{c ? t(c.name) : f.gene}</span>
        <span dir="ltr" className="font-mono text-[12px] text-ink-2">{f.gene}</span>
      </div>
      {c && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t(c.what[level])}</p>}
      {f.inheritance === 'XL' && sex === 'F' && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome. For each son: a 1 in 2 chance of having the condition. For each daughter: a 1 in 2 chance of carrying it, as you do. This does not depend on your partner.', ar: 'يقع هذا الجين على الكروموسوم X. لكل ابن: احتمال 1 من 2 أن يصاب بالحالة. ولكل ابنة: احتمال 1 من 2 أن تحمل التغيّر مثلك. ولا يعتمد ذلك على شريكك.' })}</p>
      )}
      {f.inheritance === 'XL' && sex === 'M' && (
        <p className="mt-2 text-[14px] leading-relaxed">{t({ en: 'This gene is on the X chromosome, and men have one X, so this result is about your own health. Your daughters would carry it; your sons would not inherit it from you.', ar: 'يقع هذا الجين على الكروموسوم X، وللرجل نسخة واحدة منه، لذا تخص هذه النتيجة صحتك أنت. ستحمله بناتك، ولن يرثه أبناؤك الذكور منك.' })}</p>
      )}
      {f.severity === 'mild' && <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'A milder change: it matters only alongside a more serious change in the same gene from a partner.', ar: 'تغيّر أخف: لا يهم إلا مع تغيّر أشد في الجين نفسه لدى الشريك.' })}</p>}
      {c?.carrierNote && f.inheritance === 'AR' && <p className="mt-1 text-[13px] text-ink-2">{t(c.carrierNote)}</p>}
    </li>
  );
}

function SharedGeneCard({ g, lang, t, level }: { g: SharedGene; lang: Locale; t: T; level: Level }) {
  const c = conditionFor(g.gene);
  const milder = g.strength === 1;
  const odds: L = milder
    ? { en: 'One of you carries a milder change. In each pregnancy there is a 1 in 4 chance the child inherits both changes, which usually causes a milder form of the condition. A counsellor will explain what that means for this gene.', ar: 'أحدكما يحمل تغيّراً أخف. في كل حمل احتمال 1 من 4 أن يرث الطفل التغيّرين معاً، وهذا يسبب عادة شكلاً أخف من الحالة. وسيشرح المستشار ما يعنيه ذلك لهذا الجين.' }
    : { en: 'In each pregnancy: a 1 in 4 chance the child has the condition, 2 in 4 that the child is a healthy carrier like you, and 1 in 4 that the child has no changed copy.', ar: 'في كل حمل: احتمال 1 من 4 أن يصاب الطفل بالحالة، و2 من 4 أن يحمل التغيّر وهو سليم مثلكما، و1 من 4 ألا يحمل أي نسخة متغيرة.' };
  return (
    <article className="mt-5 rounded-[3px] border border-madder bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-madder-2 px-4 py-3">
        <h3 className="text-[17px] font-semibold text-madder">{c ? t(c.name) : g.gene}</h3>
        <span className="flex items-center gap-2">
          <Listen lang={lang} text={[c ? t(c.name) : g.gene, t(odds), c ? t(c.what[level]) : '', c ? t(c.care) : ''].filter(Boolean).join(' ')} />
          <span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene}</span>
        </span>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-center gap-3" role="img" aria-label={t(odds)}>
          {(['affected', 'carrier', 'carrier', 'clear'] as const).map((k, i) => <Diamond key={i} fill={k} size={40} color={milder ? 'var(--camel)' : undefined} />)}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">{t(odds)}</p>
        <p className="mt-1.5 text-[13px] text-ink-2">{t({ en: 'Chance has no memory: each pregnancy is a new 1 in 4.', ar: 'الاحتمال لا يتذكر: كل حمل هو 1 من 4 من جديد.' })}</p>
        {c && (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">{t(c.what[level])}</p>
            <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>
            {c.carrierNote && <p className="mt-1.5 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'For you as carriers: ', ar: 'لكما كحاملين للتغيّر: ' })}</span>{t(c.carrierNote)}</p>}
            <a className="mt-2 inline-block text-[12px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>
          </>
        )}
      </div>
    </article>
  );
}

/** X-linked match: she carries it and he has it. Both sons and daughters can be affected. */
function XlCoupleCard({ g, t, level }: { g: SharedGene; t: T; level: Level }) {
  const c = conditionFor(g.gene);
  return (
    <article className="mt-5 rounded-[3px] border border-madder bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-madder-2 px-4 py-3">
        <h3 className="text-[17px] font-semibold text-madder">{c ? t(c.name) : g.gene}</h3>
        <span dir="ltr" className="font-mono text-[12px] text-ink-2">{g.gene} · X</span>
      </div>
      <div className="px-4 py-4 text-[15px] leading-relaxed">
        <p>{t({ en: 'This gene is on the X chromosome. The woman carries a change in it, and the man’s result means he has the condition himself.', ar: 'يقع هذا الجين على الكروموسوم X. تحمل الزوجة تغيّراً فيه، وتعني نتيجة الزوج أنه مصاب بالحالة نفسها.' })}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{t({ en: 'Each son: a 1 in 2 chance of having the condition.', ar: 'لكل ابن: احتمال 1 من 2 أن يصاب بالحالة.' })}</li>
          <li>{t({ en: 'Each daughter: a 1 in 2 chance of having it; otherwise she carries it.', ar: 'لكل ابنة: احتمال 1 من 2 أن تصاب بها، وإلا فهي تحمل التغيّر.' })}</li>
        </ul>
        {c && <p className="mt-3 text-ink">{t(c.what[level])}</p>}
        {c && <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>}
        {c && <a className="mt-2 inline-block text-[12px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>}
      </div>
    </article>
  );
}
