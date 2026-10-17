'use client';
// A step-through of the real protocol, run in this browser with a throwaway lab key, so every value
// shown is the actual value: lab tokens, padded and locked lists, the double lock, and the match.
import { useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { issue, matchedGenes, type Finding } from '@/lib/lab';
import { Initiator, Responder, SET_SIZE, type Msg1, type Msg2, type Msg3, type Outcome, type Token } from '@/lib/psi';

type L = { en: string; ar: string };
const ar = (gene: string): Finding => ({ gene, inheritance: 'AR', severity: 'severe' });
const HER = [ar('CYP21A2'), ar('HBB')];
const HIM = [ar('CYP21A2'), ar('MEFV')];

interface Run { ta: Token[]; tb: Token[]; m1: Msg1; m2: Msg2; m3: Msg3; a: Outcome; b: Outcome; matchAB: Set<string> }

function run(): Run {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const session = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');
  const ta = issue(key, session, 'A', 'F', HER);
  const tb = issue(key, session, 'B', 'M', HIM);
  const i = new Initiator(ta);
  const r = new Responder(tb);
  const m1 = i.step1();
  const m2 = r.step2(m1);
  const { msg: m3, outcome: a } = i.step3(m2);
  const b = r.step4(m3);
  const ba = new Set(m3.ba);
  return { ta, tb, m1, m2, m3, a, b, matchAB: new Set(m2.ab.filter((x) => ba.has(x))) };
}

const STEPS: { title: L; body: L }[] = [
  { title: { en: 'What each person carries', ar: 'ما يحمله كل منهما' }, body: { en: 'Imagine we could see both results. Mariam carries CYP21A2 and HBB; Saeed carries CYP21A2 and MEFV. Neither will ever see the other’s list.', ar: 'تخيّل أننا نرى النتيجتين. مريم تحمل CYP21A2 وHBB، وسعيد يحمل CYP21A2 وMEFV. ولن يرى أي منهما قائمة الآخر أبداً.' } },
  { title: { en: 'The lab issues one-time tokens', ar: 'المختبر يصدر رموزاً لمرة واحدة' }, body: { en: 'For this pairing only, the lab turns each gene into tokens only it can make (two per gene, tagged so that mild changes never match each other). A token from another pairing is worthless.', ar: 'لهذا الاقتران فقط، يحوّل المختبر كل جين إلى رموز لا يصنعها غيره (رمزان لكل جين، موسومان بحيث لا تتطابق التغيّرات الخفيفة مع بعضها). والرمز من اقتران آخر لا قيمة له.' } },
  { title: { en: 'Mariam’s phone locks and pads her list', ar: 'هاتف مريم يقفل قائمتها ويحشوها' }, body: { en: `Her phone multiplies each token by a secret number it never shares, adds random entries up to ${SET_SIZE}, shuffles, and sends it. This is everything that leaves her phone.`, ar: `يضرب هاتفها كل رمز في رقم سري لا يشاركه، ويضيف عناصر عشوائية حتى ${SET_SIZE}، ويخلطها، ثم يرسلها. هذا كل ما يخرج من هاتفها.` } },
  { title: { en: 'Saeed’s phone adds its lock', ar: 'هاتف سعيد يضيف قفله' }, body: { en: 'His phone locks her list again with its own secret, in the same order, and sends back its own locked, padded list.', ar: 'يقفل هاتفه قائمتها مرة أخرى بسره الخاص وبالترتيب نفسه، ويعيد قائمته المقفلة المحشوة.' } },
  { title: { en: 'Two locks on both sides: only shared genes match', ar: 'قفلان على الجانبين: لا يتطابق إلا المشترك' }, body: { en: 'Mariam’s phone adds her lock to his list. Now every entry carries both locks. Entries that started as the same token are now identical; everything else is still noise.', ar: 'يضيف هاتف مريم قفلها إلى قائمته. الآن يحمل كل عنصر القفلين. والعناصر التي بدأت بالرمز نفسه أصبحت متطابقة، وكل ما عداها لا يزال ضجيجاً.' } },
  { title: { en: 'What each one learns', ar: 'ما يعرفه كل منهما' }, body: { en: 'Each phone knows which of its own entries matched, so both learn CYP21A2. Neither learns HBB or MEFV, or how many genes the other carries. The relay saw only the locked lists.', ar: 'يعرف كل هاتف أي عناصره تطابقت، فيعرف كلاهما CYP21A2. ولا يعرف أي منهما HBB أو MEFV أو عدد جينات الآخر. ولم يرَ الوسيط إلا القوائم المقفلة.' } },
];

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

function List({ title, items, tone, lit, more }: { title: string; items: { label?: string; hex: string }[]; tone: 'her' | 'him' | 'wire'; lit?: Set<string>; more?: number }) {
  const border = tone === 'her' ? 'border-indigo' : tone === 'him' ? 'border-camel' : 'border-ink';
  return (
    <div className={`min-w-0 rounded-[3px] border ${border} bg-paper`}>
      <p className="border-b border-rule px-3 py-2 text-[13px] font-medium">{title}</p>
      <ul className="divide-y divide-rule font-mono text-[11.5px]">
        {items.map((x, i) => {
          const on = lit?.has(x.hex);
          return (
            <li key={i} className={`flex items-center justify-between gap-2 px-3 py-1.5 ${on ? 'bg-madder text-wool' : ''}`}>
              <span className="truncate">{short(x.hex)}</span>
              {x.label && <span className={`shrink-0 font-sans text-[12px] ${on ? 'text-wool' : 'text-ink-2'}`}>{x.label}</span>}
            </li>
          );
        })}
        {more ? <li className="px-3 py-1.5 font-sans text-[12px] text-ink-3">+ {more}</li> : null}
      </ul>
    </div>
  );
}

export function Theatre({ lang }: { lang: Locale }) {
  const t = (l: L) => l[lang];
  const [step, setStep] = useState(0);
  const [r, setR] = useState<Run | null>(null);
  useEffect(() => { setR(run()); }, []);
  const shown = 8;
  const view = useMemo(() => {
    if (!r) return null;
    const ab = r.m2.ab, ba = r.m3.ba;
    const both = new Set(ab.filter((x) => ba.includes(x)));
    const sortFirst = (xs: string[]) => [...xs.filter((x) => both.has(x)), ...xs.filter((x) => !both.has(x))];
    return { both, abTop: sortFirst(ab).slice(0, shown), baTop: sortFirst(ba).slice(0, shown) };
  }, [r]);
  if (!r || !view) return <div className="h-[420px] animate-pulse bg-wool-2" />;
  const genesA = r.a.mode === 'reveal' ? matchedGenes(r.a.labels).ar : [];
  const genesB = r.b.mode === 'reveal' ? matchedGenes(r.b.labels).ar : [];
  const her = lang === 'ar' ? 'مريم' : 'Mariam';
  const him = lang === 'ar' ? 'سعيد' : 'Saeed';

  return (
    <div>
      <ol className="flex flex-wrap gap-2" aria-label={t({ en: 'Steps', ar: 'الخطوات' })}>
        {STEPS.map((s, i) => (
          <li key={i}><button aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}
            className={`rounded-[2px] border px-3 py-1.5 text-[13px] ${step === i ? 'border-ink bg-ink text-wool' : 'border-rule text-ink-2 hover:border-ink'}`}>{i + 1}</button></li>
        ))}
      </ol>
      <h3 className="mt-5 text-[24px] font-semibold tracking-tight">{t(STEPS[step].title)}</h3>
      <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-ink-2">{t(STEPS[step].body)}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2" aria-live="polite">
        {step === 0 && (<>
          <List title={her} tone="her" items={HER.map((f) => ({ hex: '·'.repeat(16), label: f.gene }))} />
          <List title={him} tone="him" items={HIM.map((f) => ({ hex: '·'.repeat(16), label: f.gene }))} />
        </>)}
        {step === 1 && (<>
          <List title={t({ en: `${her}’s tokens (on her phone only)`, ar: `رموز ${her} (على هاتفها فقط)` })} tone="her" items={r.ta.map((x) => ({ hex: x.token, label: x.label }))} />
          <List title={t({ en: `${him}’s tokens (on his phone only)`, ar: `رموز ${him} (على هاتفه فقط)` })} tone="him" items={r.tb.map((x) => ({ hex: x.token, label: x.label }))} />
        </>)}
        {step === 2 && (<>
          <List title={t({ en: `Sent by ${her}: locked, padded, shuffled`, ar: `أرسلته ${her}: مقفل ومحشو ومخلوط` })} tone="wire" items={r.m1.a.slice(0, shown).map((h) => ({ hex: h }))} more={SET_SIZE - shown} />
          <div className="rounded-[3px] border border-dashed border-rule p-4 text-[14px] leading-relaxed text-ink-2">
            {t({ en: `${SET_SIZE} entries whatever she carries. Without her secret number, nobody (not Saeed, not the relay, not the lab) can tell which entries are real, let alone which gene they are.`, ar: `${SET_SIZE} عنصراً أياً كان ما تحمله. ومن دون رقمها السري لا يستطيع أحد (لا سعيد ولا الوسيط ولا المختبر) معرفة أي العناصر حقيقي، فضلاً عن الجين.` })}
          </div>
        </>)}
        {step === 3 && (<>
          <List title={t({ en: `Her list with his lock added (back to ${her})`, ar: `قائمتها مع قفله (تعود إلى ${her})` })} tone="wire" items={r.m2.ab.slice(0, shown).map((h) => ({ hex: h }))} more={SET_SIZE - shown} />
          <List title={t({ en: `His own list, locked and padded`, ar: 'قائمته مقفلة ومحشوة' })} tone="wire" items={r.m2.b.slice(0, shown).map((h) => ({ hex: h }))} more={SET_SIZE - shown} />
        </>)}
        {step === 4 && (<>
          <List title={t({ en: 'Her entries, both locks', ar: 'عناصرها بالقفلين' })} tone="her" items={view.abTop.map((h) => ({ hex: h }))} lit={view.both} more={SET_SIZE - shown} />
          <List title={t({ en: 'His entries, both locks', ar: 'عناصره بالقفلين' })} tone="him" items={view.baTop.map((h) => ({ hex: h }))} lit={view.both} more={SET_SIZE - shown} />
        </>)}
        {step === 5 && (<>
          <div className="rounded-[3px] border border-indigo bg-paper p-4"><p className="text-[13px] text-ink-3">{t({ en: `${her}’s phone learned`, ar: `عرف هاتف ${her}` })}</p><p className="mt-1 text-[22px] font-semibold text-madder">{genesA.join(', ') || '—'}</p></div>
          <div className="rounded-[3px] border border-camel bg-paper p-4"><p className="text-[13px] text-ink-3">{t({ en: `${him}’s phone learned`, ar: `عرف هاتف ${him}` })}</p><p className="mt-1 text-[22px] font-semibold text-madder">{genesB.join(', ') || '—'}</p></div>
        </>)}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px] disabled:opacity-40">{t({ en: 'Back', ar: 'السابق' })}</button>
        <button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1} className="rounded-[2px] bg-ink px-4 py-2.5 text-[14px] text-wool disabled:opacity-40">{t({ en: 'Next step', ar: 'الخطوة التالية' })}</button>
        <button onClick={() => { setR(run()); setStep(0); }} className="ms-auto text-[13px] text-indigo underline underline-offset-4">{t({ en: 'Run again with fresh secrets', ar: 'أعد التشغيل بأسرار جديدة' })}</button>
      </div>
    </div>
  );
}
