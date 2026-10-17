'use client';
// The person's app: their carrier card, the pairing with their partner, and the couple result.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Locale } from '@/i18n/locales';
import type { Finding } from '@/lib/lab';
import { matchedGenes } from '@/lib/lab';
import type { Outcome } from '@/lib/psi';
import { checkWords, linkFragment, newLink, parseFragment, runInitiator, runResponder, type Link, type Step } from '@/lib/pairing';
import { conditionFor, type Level } from '@/lib/conditions';
import { F, type Relationship } from '@/lib/risk';
import { Diamond, Mark, Person } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';
import { Ask, Counsellor, Family, Options } from './Views';
import { TeachBack } from './TeachBack';
import { sessionId } from '@/lib/pairing';

type L = { en: string; ar: string };
export interface PublicPerson { id: string; name: L; sex: 'F' | 'M'; age: number }
export interface PhoneProps {
  lang: Locale;
  me: PublicPerson;
  relationship: Relationship;
  /** Pre-shared link for the side-by-side demo; otherwise read from the URL fragment or created on demand. */
  role?: 'A' | 'B';
  embedded?: boolean;
}

type View = 'card' | 'mine' | 'pair' | 'running' | 'result' | 'options' | 'counsellor' | 'ask' | 'family';

const REL: Record<Relationship, L> = {
  unrelated: { en: 'not related', ar: 'لا قرابة' },
  'second-cousins': { en: 'second cousins', ar: 'أبناء عمومة من الدرجة الثانية' },
  'first-cousins-once-removed': { en: 'first cousins once removed', ar: 'ابن عم وابنة ابن عم' },
  'first-cousins': { en: 'first cousins', ar: 'أبناء عمومة من الدرجة الأولى' },
  'double-first-cousins': { en: 'double first cousins', ar: 'أبناء عمومة وخؤولة معاً' },
};

export function PhoneApp({ lang, me, relationship, role: fixedRole, embedded }: PhoneProps) {
  const t = useCallback((l: L) => l[lang], [lang]);
  const [view, setView] = useState<View>('card');
  const [level, setLevel] = useState<Level>('standard');
  const [mine, setMine] = useState<Finding[] | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [role, setRole] = useState<'A' | 'B' | null>(fixedRole ?? null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string>('');
  const started = useRef(false);

  // A link in the URL fragment means someone shared a pairing with this phone.
  useEffect(() => {
    const l = parseFragment(window.location.hash);
    if (l) {
      setLink(l);
      setRole(fixedRole ?? 'B');
      setView('pair');
    }
  }, [fixedRole]);

  const shareUrl = useMemo(() => {
    if (!link || typeof window === 'undefined') return '';
    const u = new URL(window.location.href);
    u.searchParams.delete('as');
    u.searchParams.delete('role');
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
    if (!link || !role || started.current) return;
    started.current = true;
    setView('running');
    setSteps([]);
    setError(null);
    try {
      const onStep = (s: Step) => setSteps((x) => [...x, s]);
      const o = role === 'A'
        ? await runInitiator({ person: me.id, link, onStep })
        : await runResponder({ person: me.id, link, onStep });
      setOutcome(o);
      setView('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      started.current = false;
    }
  };

  const openMine = async () => {
    const ok = window.confirm(t({
      en: 'Open your own results? You will see every gene you carry, not only the ones you share. You can close them again, but you cannot un-see them.',
      ar: 'هل تريد فتح نتائجك الخاصة؟ سترى كل جين تحمله، لا المشترك فقط. يمكنك إغلاقها مجدداً، لكن لا يمكنك نسيان ما رأيت.',
    }));
    if (!ok) return;
    const r = await fetch('/api/lab/results', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ person: me.id, confirm: true }) });
    const j = await r.json();
    if (r.ok) { setMine(j.findings); setView('mine'); } else setError(j.error);
  };

  const words = link ? checkWords(link, lang) : [];
  const genes = outcome?.mode === 'reveal' ? matchedGenes(outcome.labels) : { ar: [], xl: [] };
  const color = me.sex === 'F' ? 'var(--indigo)' : 'var(--camel)';

  return (
    <div className={`flex h-full flex-col bg-wool text-ink ${embedded ? '' : 'min-h-dvh'}`}>
      <header className="flex items-center justify-between border-b border-rule px-5 py-3.5">
        <div className="flex items-center gap-2.5" style={{ color }}>
          <Person sex={me.sex} color={color} size={22} />
          <span className="text-[15px] font-medium text-ink">{t({ en: `${me.name.en}’s phone`, ar: `هاتف ${me.name.ar}` })}</span>
        </div>
        <span className="flex items-center gap-1.5 text-ink-3"><Mark size={20} /></span>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        {error && (
          <div role="alert" className="mb-4 border-l-4 border-madder bg-madder-2 px-4 py-3 text-[14px]">
            {error} <button className="ms-2 underline" onClick={() => { setError(null); setView('card'); }}>{t({ en: 'Start over', ar: 'ابدأ من جديد' })}</button>
          </div>
        )}

        {view === 'card' && (
          <section>
            <p className="text-[13px] text-ink-3">{t({ en: 'Carrier card · Premarital screening, Abu Dhabi', ar: 'بطاقة الحمل الجيني · الفحص قبل الزواج، أبوظبي' })}</p>
            <h2 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight">{t({ en: 'Your results are sealed on this phone.', ar: 'نتائجك مختومة على هذا الهاتف.' })}</h2>
            <div className="mt-5 overflow-hidden rounded-[3px] border border-ink">
              <Sadu height={64} motifs={9} seed={me.id.length} />
              <div className="bg-paper px-4 py-3.5 text-[14px] leading-relaxed text-ink-2">
                {t({
                  en: 'You chose to see your results only as a couple. When you pair with your partner, you both learn the genes you both carry, and nothing else.',
                  ar: 'اخترت أن ترى نتائجك كزوجين فقط. عند الاقتران بشريكك تعرفان الجينات التي تحملانها معاً، ولا شيء غيرها.',
                })}
              </div>
            </div>
            <button onClick={startPairing} className="mt-6 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">
              {t({ en: 'Pair with your partner', ar: 'اقترن بشريكك' })}
            </button>
            <div className="mt-6 border-t border-rule pt-4">
              <p className="text-[14px] text-ink-2">{t({ en: 'You also have the right to see your own full results at any time.', ar: 'ولك الحق في رؤية نتائجك الكاملة في أي وقت.' })}</p>
              <button onClick={openMine} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Open my own results', ar: 'افتح نتائجي الخاصة' })}</button>
            </div>
          </section>
        )}

        {view === 'mine' && mine && (
          <section>
            <button onClick={() => setView('card')} className="text-[14px] text-ink-2">← {t({ en: 'Back', ar: 'رجوع' })}</button>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight">{t({ en: 'Your own results', ar: 'نتائجك الخاصة' })}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
              {t({ en: 'You carry one changed copy of each gene below. A carrier is healthy: being a carrier is not a disease. It matters only if a partner carries the same gene.', ar: 'تحمل نسخة واحدة متغيرة من كل جين أدناه. حامل الجين سليم، فالحمل ليس مرضاً. ولا يهم إلا إذا حمل الشريك الجين نفسه.' })}
            </p>
            <ul className="mt-4 divide-y divide-rule border-y border-rule">
              {mine.map((f) => {
                const c = conditionFor(f.gene);
                return (
                  <li key={f.gene} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium">{c ? t(c.name) : f.gene}</span>
                      <span className="font-mono text-[12px] text-ink-3">{f.gene}</span>
                    </div>
                    {f.inheritance === 'XL' && me.sex === 'F' && (
                      <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'X-linked: this matters for your sons whatever your partner carries. Only you see this unless you share it.', ar: 'مرتبط بالكروموسوم X: يهم أبناءك الذكور أياً كان ما يحمله شريكك. لا يراه أحد غيرك إلا إذا شاركته.' })}</p>
                    )}
                    {f.severity === 'mild' && <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'A mild change: it matters only alongside a severe change from a partner.', ar: 'تغيّر خفيف: لا يهم إلا مع تغيّر شديد لدى الشريك.' })}</p>}
                  </li>
                );
              })}
            </ul>
            <button onClick={() => { setMine(null); setView('card'); }} className="mt-5 text-[14px] font-medium underline underline-offset-4">{t({ en: 'Close my results', ar: 'أغلق نتائجي' })}</button>
          </section>
        )}

        {view === 'pair' && link && (
          <section>
            <h2 className="text-[24px] font-semibold tracking-tight">
              {role === 'A' ? t({ en: 'Show this to your partner', ar: 'اعرض هذا على شريكك' }) : t({ en: 'Your partner invited you to compare', ar: 'دعاك شريكك إلى المقارنة' })}
            </h2>
            {role === 'A' && !embedded && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-[3px] border border-rule bg-paper p-4">
                {qr ? <img src={qr} alt={t({ en: 'QR code for your partner', ar: 'رمز QR لشريكك' })} width={200} height={200} /> : <div className="h-[200px] w-[200px] animate-pulse bg-wool-2" />}
                <button className="text-[13px] text-indigo underline" onClick={() => navigator.clipboard?.writeText(shareUrl)}>{t({ en: 'Copy the link instead', ar: 'انسخ الرابط بدلاً من ذلك' })}</button>
              </div>
            )}
            <div className="mt-5">
              <p className="text-[14px] text-ink-2">{t({ en: 'Both screens should show the same three words. Read them to each other.', ar: 'يجب أن تظهر الكلمات الثلاث نفسها على الشاشتين. اقرآها لبعضكما.' })}</p>
              <p className="mt-2 flex flex-wrap gap-2" aria-live="polite">
                {words.map((w) => <span key={w} className="rounded-[2px] border border-ink px-3 py-1.5 text-[17px] font-medium">{w}</span>)}
              </p>
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-ink-3">
              {t({ en: `You told us you are ${REL[relationship].en}.`, ar: `أخبرتنا أنكما ${REL[relationship].ar}.` })}
            </p>
            <button onClick={compare} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">
              {t({ en: 'The words match. Compare now', ar: 'الكلمات متطابقة. قارن الآن' })}
            </button>
          </section>
        )}

        {view === 'running' && (
          <section aria-live="polite">
            <h2 className="text-[24px] font-semibold tracking-tight">{t({ en: 'Comparing, privately', ar: 'تجري المقارنة بخصوصية' })}</h2>
            <ol className="mt-4 space-y-3 text-[14px]">
              {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-sage">✓</span><StepLine s={s} lang={lang} /></li>)}
            </ol>
            <div className="mt-6 h-1 w-full overflow-hidden bg-wool-2"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-ink" /></div>
          </section>
        )}

        {view === 'result' && outcome && (
          <Result lang={lang} genes={genes} relationship={relationship} level={level} setLevel={setLevel} me={me} steps={steps} onGo={setView} />
        )}

        {view === 'options' && <Options lang={lang} onBack={() => setView('result')} onCounsellor={() => setView('counsellor')} />}
        {view === 'counsellor' && (
          <Counsellor lang={lang} onBack={() => setView(outcome ? 'result' : 'card')} person={me.id} pairing={link ? sessionId(link) : null}
            genes={[...genes.ar, ...genes.xl]} level={level} related={F[relationship] > 0} />
        )}
        {view === 'ask' && <Ask lang={lang} onBack={() => setView('result')} genes={genes.ar} xl={genes.xl} level={level} related={F[relationship] > 0} />}
        {view === 'family' && <Family lang={lang} onBack={() => setView(outcome ? 'result' : 'card')} genes={[...new Set([...genes.ar, ...(mine ?? []).filter((f) => f.inheritance === 'AR').map((f) => f.gene)])]} />}
      </div>
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

function StepLine({ s, lang }: { s: Step; lang: Locale }) {
  const t = (l: L) => l[lang];
  switch (s.kind) {
    case 'tokens': return <span>{t({ en: `The lab gave this phone ${s.count} one-time tokens for this pairing only.`, ar: `أعطى المختبرُ هذا الهاتفَ ${s.count} رمزاً لمرة واحدة لهذا الاقتران فقط.` })}</span>;
    case 'sent': return <span>{t({ en: `Sent this phone’s locked list to the relay, encrypted (${s.bytes.toLocaleString()} characters).`, ar: `أُرسلت القائمة المقفلة إلى الوسيط مشفّرة (${s.bytes.toLocaleString()} حرفاً).` })}</span>;
    case 'received': return <span>{t({ en: 'Received your partner’s locked list.', ar: 'وصلت قائمة شريكك المقفلة.' })}</span>;
    case 'waiting': return <span className="text-ink-3">{t({ en: 'Waiting for your partner’s phone…', ar: 'بانتظار هاتف شريكك…' })}</span>;
    case 'done': return <span>{t({ en: `Compared on this phone in ${(s.ms / 1000).toFixed(1)} s.`, ar: `تمت المقارنة على هذا الهاتف في ${(s.ms / 1000).toFixed(1)} ث.` })}</span>;
  }
}

function Result({ lang, genes, relationship, level, setLevel, me, steps, onGo }: {
  lang: Locale; genes: { ar: string[]; xl: string[] }; relationship: Relationship; level: Level; setLevel: (l: Level) => void; me: PublicPerson; steps: Step[]; onGo: (v: View) => void;
}) {
  const t = (l: L) => l[lang];
  const related = F[relationship] > 0;
  const none = genes.ar.length === 0 && genes.xl.length === 0;
  const sent = steps.find((s) => s.kind === 'sent');
  return (
    <section>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-3">{t({ en: 'Your couple result', ar: 'نتيجتكما كزوجين' })}</p>
        <div className="flex gap-1 text-[12px]" role="group" aria-label={t({ en: 'Reading level', ar: 'مستوى القراءة' })}>
          {(['simple', 'standard', 'detailed'] as Level[]).map((l) => (
            <button key={l} aria-pressed={level === l} onClick={() => setLevel(l)} className={`rounded-[2px] border px-2 py-1 ${level === l ? 'border-ink bg-ink text-wool' : 'border-rule text-ink-2'}`}>
              {t({ simple: { en: 'Simple', ar: 'مبسّط' }, standard: { en: 'Standard', ar: 'عادي' }, detailed: { en: 'Detailed', ar: 'مفصّل' } }[l])}
            </button>
          ))}
        </div>
      </div>

      {none ? (
        <>
          <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{t({ en: 'You don’t carry the same gene on this panel.', ar: 'لا تحملان الجين نفسه في هذه اللوحة.' })}</h2>
          <div className="mt-4 overflow-hidden rounded-[3px] border border-ink"><Sadu height={52} motifs={9} seed={7} /></div>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            {t({ en: 'This lowers the chance of the conditions tested, but no test can rule out every inherited condition.', ar: 'هذا يخفض احتمال الحالات التي فُحصت، لكن لا يستطيع أي فحص استبعاد كل الحالات الوراثية.' })}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">
            {sharedHeadline(genes.ar.length + genes.xl.length, lang)}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'You are both healthy carriers. This is about the chance for a future child, not a diagnosis.', ar: 'كلاكما حامل سليم. هذا عن احتمال لطفل في المستقبل، وليس تشخيصاً.' })}</p>
          {genes.ar.map((g) => <SharedGene key={g} gene={g} lang={lang} level={level} />)}
          {genes.xl.map((g) => <SharedGene key={`x${g}`} gene={g} lang={lang} level={level} xl />)}
        </>
      )}

      {related && (
        <div className="mt-6 border-l-2 border-ink ps-4 text-[14px] leading-relaxed text-ink-2">
          {t({
            en: `You told us you are ${REL[relationship].en}. For conditions no panel tests, related parents have a slightly higher chance: for first cousins, about 2 to 3 more in every 100 pregnancies than for unrelated parents. A counsellor can explain what this means for you.`,
            ar: `أخبرتنا أنكما ${REL[relationship].ar}. بالنسبة للحالات التي لا تفحصها أي لوحة، يكون الاحتمال لدى الوالدين الأقارب أعلى قليلاً: لأبناء العمومة من الدرجة الأولى نحو 2 إلى 3 حالات إضافية في كل 100 حمل مقارنة بغير الأقارب. يمكن للمستشار أن يشرح ما يعنيه ذلك لكما.`,
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2.5 text-[14px] font-medium">
        <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => onGo('options')}>{t({ en: 'Your options', ar: 'خياراتكما' })}</button>
        <button className="rounded-[2px] bg-ink px-3 py-3 text-wool" onClick={() => onGo('counsellor')}>{t({ en: 'Talk to a counsellor', ar: 'تحدّث إلى مستشار' })}</button>
        <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => onGo('ask')}>{t({ en: 'Ask a question', ar: 'اطرح سؤالاً' })}</button>
        <button className="rounded-[2px] border border-ink px-3 py-3" onClick={() => onGo('family')}>{t({ en: 'Tell relatives', ar: 'أخبر أقاربك' })}</button>
      </div>

      <TeachBack lang={lang} level={level} kind={none ? 'none' : 'shared'} />

      {sent?.kind === 'sent' && (
        <details className="mt-6 text-[13px] text-ink-2">
          <summary className="cursor-pointer font-medium text-ink">{t({ en: 'What left this phone', ar: 'ما الذي خرج من هذا الهاتف' })}</summary>
          <p className="mt-2">{t({ en: 'Only this, encrypted. The relay could not read it, and even unencrypted it would be random-looking numbers:', ar: 'هذا فقط، مشفّراً. لم يستطع الوسيط قراءته، وحتى من دون تشفير لكان أرقاماً عشوائية المظهر:' })}</p>
          <code className="mt-2 block break-all bg-wool-2 p-2 font-mono text-[11px]">{sent.cipher}…</code>
        </details>
      )}
      <p className="mt-6 text-[12px] text-ink-3">{t({ en: `Synthetic person for the demo: ${me.name.en}, ${me.age}.`, ar: `شخص افتراضي للعرض: ${me.name.ar}، ${me.age}.` })}</p>
    </section>
  );
}

function SharedGene({ gene, lang, level, xl }: { gene: string; lang: Locale; level: Level; xl?: boolean }) {
  const t = (l: L) => l[lang];
  const c = conditionFor(gene);
  return (
    <article className="mt-5 rounded-[3px] border border-madder bg-paper">
      <div className="flex items-baseline justify-between gap-3 border-b border-madder-2 px-4 py-3">
        <h3 className="text-[17px] font-semibold text-madder">{c ? t(c.name) : gene}</h3>
        <span className="font-mono text-[12px] text-ink-3">{gene}</span>
      </div>
      <div className="px-4 py-4">
        {!xl ? (
          <>
            <div className="flex items-center gap-3">
              {(['affected', 'carrier', 'carrier', 'clear'] as const).map((k, i) => <Diamond key={i} fill={k} size={40} />)}
            </div>
            <p className="mt-3 text-[15px] leading-relaxed">
              {t({ en: 'In each pregnancy: a 1 in 4 chance the child has the condition, 2 in 4 that the child is a healthy carrier like you, and 1 in 4 that the child carries neither copy.', ar: 'في كل حمل: احتمال 1 من 4 أن يصاب الطفل بالحالة، و2 من 4 أن يكون حاملاً سليماً مثلكما، و1 من 4 ألا يحمل أي نسخة.' })}
            </p>
            <p className="mt-1.5 text-[13px] text-ink-3">{t({ en: 'Chance does not remember: each pregnancy is a new 1 in 4.', ar: 'الاحتمال لا يتذكر: كل حمل هو 1 من 4 من جديد.' })}</p>
          </>
        ) : (
          <p className="text-[15px] leading-relaxed">{t({ en: 'This X-linked gene matters for both sons and daughters in your family. A counsellor will explain the exact chances.', ar: 'هذا الجين المرتبط بالكروموسوم X يهم الأبناء والبنات في عائلتكما. سيشرح المستشار الاحتمالات بدقة.' })}</p>
        )}
        {c && (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">{t(c.what[level])}</p>
            <p className="mt-2 text-[13px] text-ink-2"><span className="font-medium text-ink">{t({ en: 'Care today: ', ar: 'الرعاية اليوم: ' })}</span>{t(c.care)}</p>
            <a className="mt-2 inline-block text-[12px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>
          </>
        )}
      </div>
    </article>
  );
}
