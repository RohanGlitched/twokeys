'use client';
// Two phones side by side, each a real, separate app instance (iframe), pairing through the real
// lab and relay. The page only hands both phones the same link. The strip between them shows what
// each phone reports it sent and received, which is all the relay saw; at the end each phone tells
// the page which shared genes it learned, for the summary row (a demo convenience: in real use there
// is no page between the two phones).
// On a phone-sized screen one phone shows at a time, with a switcher that flags the other when it
// is waiting for a tap, and switches to it by itself when it needs the identity check.
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { linkFragment, newLink } from '@/lib/pairing';
import type { CoupleInfo } from '@/components/phone/PhoneRoute';

type L = { en: string; ar: string };
interface Seen { at: number; person: string; kind: string; bytes?: number; cipher?: string; count?: number; ms?: number; genes?: string[] }
/** What the wire log shows; anything else a phone reports (such as waiting) is left out. */
const KINDS = new Set(['tokens', 'confirmed', 'sent', 'received', 'proof', 'done']);

/** Arabic counted noun: 1, 2 (dual), 3–10 (plural), 11+ (singular). */
const messagesAr = (k: number, n: (x: number) => string) => (k === 1 ? 'رسالة واحدة' : k === 2 ? 'رسالتان' : k <= 10 ? `${n(k)} رسائل` : `${n(k)} رسالة`);

const LOOK: Record<string, L[]> = {
  'mariam-saeed': [
    { en: 'Both phones show the same three words before comparing.', ar: 'يعرض الهاتفان الكلمات الثلاث نفسها قبل المقارنة.' },
    { en: 'Both learn CYP21A2 only. Neither sees HBB or MEFV.', ar: 'يعرف كلاهما CYP21A2 فقط، ولا يرى أي منهما HBB أو MEFV.' },
    { en: 'They are first cousins: the note about untested conditions uses the first-cousin figure.', ar: 'هما أبناء عمومة من الدرجة الأولى: تستخدم ملاحظة الحالات غير المفحوصة رقم أبناء العمومة.' },
  ],
  'noura-khalid': [
    { en: 'No shared gene: the result says what that does and doesn’t rule out.', ar: 'لا جين مشترك: تبيّن النتيجة ما يستبعده ذلك وما لا يستبعده.' },
    { en: 'Neither learns the other’s ABCA4, USH2A or HBA2.', ar: 'لا يعرف أي منهما ABCA4 أو USH2A أو HBA2 لدى الآخر.' },
  ],
  'hessa-rashid': [
    { en: 'HBB is a full match; GJB2 shows as a milder match in a different colour.', ar: 'HBB تطابق كامل، ويظهر GJB2 كتطابق أخف بلون مختلف.' },
    { en: 'Only Hessa’s phone offers her own X-linked result (G6PD). Rashid never sees it.', ar: 'لا يعرض نتيجتها الخاصة المرتبطة بالكروموسوم X (G6PD) إلا هاتف حصة، ولا يراها راشد أبداً.' },
    { en: 'Double first cousins: the untested-conditions note uses the double-cousin figure.', ar: 'أبناء عمومة وخؤولة معاً: تستخدم الملاحظة رقمهم الخاص.' },
  ],
  'latifa-ahmed': [
    { en: 'Both carry a milder GJB2 change: shown as a low-concern match (a mild form is possible), in green.', ar: 'يحمل كلاهما تغيّراً أخف في GJB2: يظهر كتطابق منخفض الأثر (قد يظهر شكل خفيف)، باللون الأخضر.' },
    { en: 'Ahmed’s CYP1B1 and Latifa’s SMN1 stay private.', ar: 'يبقى CYP1B1 لدى أحمد وSMN1 لدى لطيفة خاصين.' },
  ],
};

export function TwoPhones({ lang, couples, names, female, personal }: {
  lang: Locale; couples: CoupleInfo[]; names: Record<string, L>;
  /** Ids of the women, for Arabic verbs. */
  female: string[];
  /** Ids of people with a result of their own to read before comparing. */
  personal: string[];
}) {
  const t = (l: L) => l[lang];
  const ar = lang === 'ar';
  const [coupleId, setCoupleId] = useState(couples[0].id);
  const [frag, setFrag] = useState('');
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState<Seen[]>([]);
  const [need, setNeed] = useState<Record<string, boolean>>({});
  const [showing, setShowing] = useState(0);
  const [wide, setWide] = useState(true);
  const figures = useRef<Record<string, HTMLElement | null>>({});
  const logBox = useRef<HTMLOListElement | null>(null);
  const c = couples.find((x) => x.id === coupleId)!;
  const couplesRef = useRef(c);
  useEffect(() => { couplesRef.current = c; }, [c]);
  const reset = () => { setFrag(linkFragment(newLink())); setSeen([]); setNeed({}); setShowing(0); setRound((r) => r + 1); };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- needs Web Crypto, so it runs in the browser, read once after hydration
  useEffect(() => { setFrag(linkFragment(newLink())); }, []);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'twokeys-attention') {
        const { person, need: n, confirm } = e.data as { person: string; need: boolean; confirm?: boolean };
        setNeed((x) => ({ ...x, [person]: n }));
        if (confirm) showConfirm(person);
        return;
      }
      if (e.data?.type !== 'twokeys-step') return;
      const { person, step } = e.data as { person: string; step: Omit<Seen, 'at' | 'person'> };
      if (!KINDS.has(step.kind)) return;
      setSeen((x) => [...x, { ...step, person, at: Date.now() }].slice(-30));
    };
    // A phone asking "is this your partner?" shows its sheet at the bottom of its screen: bring that
    // phone into view, and on a phone-sized page switch to it.
    const showConfirm = (person: string) => {
      const i = [couplesRef.current.a, couplesRef.current.b].indexOf(person);
      if (i < 0) return;
      if (!window.matchMedia('(min-width: 768px)').matches) setShowing(i);
      setTimeout(() => {
        const el = figures.current[person];
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.bottom <= window.innerHeight) return;
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'end', behavior: still ? 'auto' : 'smooth' });
      }, 60);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  // The log keeps its newest line in view.
  useEffect(() => { const b = logBox.current?.parentElement; if (b && b.scrollHeight > b.clientHeight) b.scrollTop = b.scrollHeight; }, [seen]);
  const who = (id: string) => t(names[id] ?? { en: id, ar: id });
  const src = (id: string, role: 'A' | 'B') => `/${lang}/phone?as=${id}&role=${role}&embed=1#${frag}`;
  const n = (x: number) => x.toLocaleString(ar ? 'ar-AE' : 'en-GB');
  const line = (s: Seen) => {
    const w = who(s.person);
    const f = female.includes(s.person);
    switch (s.kind) {
      case 'tokens': return t({ en: `Lab → ${w}: ${s.count} tokens, no gene names`, ar: `المختبر ← ${w}: ${n(s.count ?? 0)} رمزاً، دون أسماء جينات` });
      case 'confirmed': return t({ en: `${w} confirmed who ${f ? 'she is' : 'he is'} comparing with`, ar: f ? `أكّدت ${w} هوية من تقارن معه` : `أكّد ${w} هوية من يقارن معها` });
      case 'sent': return t({ en: `${w} → relay: ${n(s.bytes ?? 0)} encrypted characters`, ar: `${w} ← الوسيط: ${n(s.bytes ?? 0)} حرفاً مشفّراً` });
      case 'received': return t({ en: `Relay → ${w}: the partner’s locked list`, ar: `الوسيط ← ${w}: قائمة الشريك المقفلة` });
      case 'proof': return t({ en: `${w}’s phone checked the proof of honest locking`, ar: `تحقق هاتف ${w} من إثبات القفل الأمين` });
      case 'done': return t({ en: `Lab confirmed ${w}’s match (${((s.ms ?? 0) / 1000).toFixed(1)} s)`, ar: `أكد المختبر تطابق ${w}` });
      default: return null;
    }
  };
  const pair = [{ id: c.a, role: 'A' as const }, { id: c.b, role: 'B' as const }];
  // The button's own words on each phone: Arabic addresses her and him differently.
  const compareAr = (id: string) => (female.includes(id) ? 'قارني الآن' : 'قارن الآن');
  const reader = pair.find((p) => personal.includes(p.id));
  // The coach strip: the few taps that make the demo work, named for the couple on screen.
  const steps: L[] = [
    ...(reader ? [female.includes(reader.id)
      ? { en: `${who(reader.id)} opens the result that is hers alone`, ar: `تفتح ${who(reader.id)} نتيجتها الخاصة أولاً` }
      : { en: `${who(reader.id)} opens the result that is his alone`, ar: `يفتح ${who(reader.id)} نتيجته الخاصة أولاً` }] : []),
    { en: 'Check the three words match', ar: 'تحقق من تطابق الكلمات الثلاث' },
    { en: 'Tap “Compare now” on both', ar: `اضغط «${compareAr(c.a)}» لدى ${who(c.a)} و«${compareAr(c.b)}» لدى ${who(c.b)}` },
    { en: 'Tap “Yes” on both', ar: 'اضغط «نعم» على الهاتفين' },
  ];
  const later: L[] = [
    { en: 'the Simple reading level', ar: 'مستوى القراءة المبسّط' },
    { en: '“Ask a question” (try a worried or Gulf-Arabic message)', ar: '«اطرح سؤالاً» (جرّب رسالة قلقة أو باللهجة الخليجية)' },
    { en: 'booking a counsellor', ar: 'حجز مرشد وراثي' },
    { en: 'a family note', ar: 'رسالة للأقارب' },
  ];

  // Consecutive relay messages read as one group; everything else is one row each.
  const groups: { relay: boolean; items: Seen[] }[] = [];
  for (const s of seen) {
    const relay = s.kind === 'sent' || s.kind === 'received';
    const last = groups.at(-1);
    if (relay && last?.relay) last.items.push(s); else groups.push({ relay, items: [s] });
  }
  // Once both phones are done: who learned what, from what they reported.
  const done = pair.map((p) => seen.find((s) => s.kind === 'done' && s.person === p.id));
  const learned = (s?: Seen) => (s?.genes?.length ? s.genes.join(ar ? '، ' : ', ') : t({ en: 'no shared gene', ar: 'لا جين مشترك' }));
  const summary = done.every(Boolean) ? (ar
    ? `${pair.map((p, i) => `${female.includes(p.id) ? 'عرفت' : 'عرف'} ${who(p.id)}: ${learned(done[i])}.`).join(' ')} عرف الوسيط: لا شيء. عرف المختبر: أنهما قارنا، والجينات التي سمّاها (يحتفظ بها يوماً واحداً).`
    : `${pair.map((p, i) => `${who(p.id)} learned: ${learned(done[i])}.`).join(' ')} Relay learned: nothing. Lab learned: that they paired, and the genes it named (kept for one day).`) : null;

  const log = (
    <>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{t({ en: 'Reported by the phones as it happens. The relay stores only these encrypted blobs and deletes them after 10 minutes.', ar: 'تبلّغ عنه الهواتف لحظة حدوثه. لا يخزن الوسيط إلا هذه الكتل المشفّرة ويحذفها بعد 10 دقائق.' })}</p>
      {seen.length === 0 ? (
        <p className="mt-3 rounded-[3px] border border-dashed border-ink-3 px-3 py-4 text-[13px] text-ink-2">{t({ en: 'Nothing yet. Start a comparison.', ar: 'لا شيء بعد. ابدأ المقارنة.' })}</p>
      ) : (
        <ol ref={logBox} className="mt-3 space-y-2">
          {groups.map((g, i) => g.relay ? (
            <li key={i} className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-[13px] leading-snug">
              <p className="font-medium">{t({ en: 'Through the relay, encrypted', ar: 'عبر الوسيط، مشفّرة' })}</p>
              <ul className="mt-1 space-y-0.5 text-ink-2">{g.items.map((s, k) => <li key={k}>{line(s)}</li>)}</ul>
              {g.items.some((s) => s.cipher) && (
                <details className="mt-1">
                  <summary className="cursor-pointer py-1 text-[12.5px] text-ink-2">{t({ en: 'What the relay stored', ar: 'ما خزّنه الوسيط' })}</summary>
                  {g.items.filter((s) => s.cipher).map((s, k) => <code key={k} dir="ltr" className="mt-1 block truncate font-mono text-[11px] text-ink-2">{s.cipher}</code>)}
                </details>
              )}
            </li>
          ) : (
            <li key={i} className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-[13px] leading-snug">{line(g.items[0])}</li>
          ))}
          {summary && <li className="rounded-[3px] border border-ink bg-paper px-3 py-2.5 text-[13px] font-medium leading-relaxed">{summary}</li>}
        </ol>
      )}
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t({ en: 'Choose a couple', ar: 'اختر زوجين' })}>
        {couples.map((x) => (
          <button key={x.id} aria-pressed={x.id === coupleId} onClick={() => { setCoupleId(x.id); reset(); }}
            className={`min-h-11 rounded-[2px] border px-3.5 text-[14px] ${x.id === coupleId ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2 hover:border-ink'}`}>
            {ar ? `${who(x.a)} و${who(x.b)}` : `${who(x.a)} & ${who(x.b)}`}
          </button>
        ))}
        <button onClick={reset} className="ms-auto min-h-11 rounded-[2px] border border-ink px-3.5 text-[14px] font-medium">{t({ en: 'Reset both phones', ar: 'أعد ضبط الهاتفين' })}</button>
      </div>
      <p className="mt-2 text-[14px] text-ink-2">{t(c.story)}</p>

      <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2 rounded-[3px] border border-rule bg-paper px-4 py-2.5 text-[14px]" aria-label={t({ en: 'How to run it', ar: 'طريقة التشغيل' })}>
        {steps.map((s, i) => (
          <li key={s.en} className="flex items-center gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-medium text-wool" aria-hidden>{n(i + 1)}</span>{t(s)}
          </li>
        ))}
      </ol>

      {/* Phone-sized screens: one phone at a time. */}
      <div className="mt-4 grid grid-cols-2 rounded-[3px] border border-ink p-1 md:hidden" role="group" aria-label={t({ en: 'Show a phone', ar: 'اعرض هاتفاً' })}>
        {pair.map((p, i) => (
          <button key={p.id} aria-pressed={showing === i} onClick={() => setShowing(i)}
            className={`relative flex min-h-11 items-center justify-center gap-2 rounded-[2px] text-[15px] font-medium ${showing === i ? 'bg-ink text-wool' : 'text-ink'}`}>
            {who(p.id)}
            {showing !== i && need[p.id] && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo px-2 py-0.5 text-[12px] font-medium text-wool">
                {t({ en: 'needs a tap', ar: 'بانتظار ضغطة' })}
              </span>
            )}
          </button>
        ))}
      </div>

      {frag && (
        <div className="mt-4 grid items-start gap-6 md:mt-6 lg:grid-cols-[1fr_260px_1fr]" key={`${coupleId}-${round}`}>
          {pair.map((p, i) => (
            <figure key={p.id} ref={(el) => { figures.current[p.id] = el; }} className={`mx-auto w-full max-w-[400px] scroll-mb-3 ${i === 1 ? 'lg:order-3' : ''} ${showing === i ? '' : 'hidden'} md:block`}>
              <div className="overflow-hidden rounded-[28px] border-[10px] border-ink bg-ink">
                {/* Never taller than the window, so a sheet at the bottom of the phone is on screen. */}
                <iframe title={ar ? `هاتف ${who(p.id)}` : `${who(p.id)}’s phone`} src={src(p.id, p.role)} className="h-[min(720px,calc(100dvh-24px))] w-full rounded-[18px] bg-wool" />
              </div>
              <figcaption className="mt-2 text-center text-[13px] text-ink-2">{ar ? `هاتف ${who(p.id)}` : `${who(p.id)}’s phone`}</figcaption>
            </figure>
          ))}
          {wide ? (
            <aside className="lg:order-2" aria-live="polite" aria-label={t({ en: 'What the relay and lab saw', ar: 'ما رآه الوسيط والمختبر' })}>
              <p className="text-[14px] font-medium">{t({ en: 'What crossed the wire', ar: 'ما عبر الشبكة' })}</p>
              <div className="mt-1 max-h-[calc(min(720px,calc(100dvh-24px))-4px)] overflow-y-auto pe-1">{log}</div>
            </aside>
          ) : (
            <details className="rounded-[3px] border border-rule bg-paper px-4">
              <summary className="cursor-pointer py-3 text-[15px] font-medium">
                {t({ en: 'What crossed the wire', ar: 'ما عبر الشبكة' })}
                <span className="ms-2 text-[13px] font-normal text-ink-2" aria-live="polite">{seen.length ? t({ en: `${seen.length} messages`, ar: messagesAr(seen.length, n) }) : ''}</span>
              </summary>
              <div className="pb-4">{log}</div>
            </details>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 border-t border-rule pt-6 md:grid-cols-2">
        <div>
          <h2 className="text-[16px] font-semibold">{t({ en: 'What to look for', ar: 'ما الذي تلاحظه' })}</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[14px] leading-relaxed text-ink-2">
            {(LOOK[c.id] ?? []).map((l) => <li key={l.en}>{t(l)}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-[16px] font-semibold">{t({ en: 'Then try', ar: 'ثم جرّب' })}</h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[14px] leading-relaxed text-ink-2">
            {later.map((l) => <li key={l.en}>{t(l)}</li>)}
            {reader && <li>{female.includes(reader.id) ? t({ en: `${who(reader.id)}’s result that is hers alone, after comparing`, ar: `نتيجة ${who(reader.id)} الخاصة بعد المقارنة` }) : t({ en: `${who(reader.id)}’s result that is his alone, after comparing`, ar: `نتيجة ${who(reader.id)} الخاصة بعد المقارنة` })}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
