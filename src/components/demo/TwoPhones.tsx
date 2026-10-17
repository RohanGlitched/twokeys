'use client';
// Two phones side by side, each a real, separate app instance (iframe), pairing through the real
// lab and relay. The page only hands both phones the same link; it never sees their results. The
// strip between them shows what each phone reports it sent and received, which is all the relay saw.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { linkFragment, newLink } from '@/lib/pairing';
import type { CoupleInfo } from '@/components/phone/PhoneRoute';

type L = { en: string; ar: string };
interface Seen { at: number; person: string; kind: string; bytes?: number; cipher?: string; count?: number; ms?: number }

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
    { en: 'They both carry a milder GJB2 change, which is not reported as a match.', ar: 'يحمل كلاهما تغيّراً أخف في GJB2، ولا يُبلَّغ عنه كتطابق.' },
    { en: 'Ahmed’s CYP1B1 stays private.', ar: 'يبقى CYP1B1 لدى أحمد خاصاً.' },
  ],
};

export function TwoPhones({ lang, couples, names }: { lang: Locale; couples: CoupleInfo[]; names: Record<string, L> }) {
  const t = (l: L) => l[lang];
  const [coupleId, setCoupleId] = useState(couples[0].id);
  const [frag, setFrag] = useState('');
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState<Seen[]>([]);
  const reset = () => { setFrag(linkFragment(newLink())); setSeen([]); setRound((r) => r + 1); };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- needs Web Crypto, so it runs in the browser, read once after hydration
  useEffect(() => { setFrag(linkFragment(newLink())); }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'twokeys-step') return;
      const { person, step } = e.data as { person: string; step: Omit<Seen, 'at' | 'person'> };
      if (step.kind === 'waiting') return;
      setSeen((x) => [...x, { ...step, person, at: Date.now() }].slice(-14));
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);
  const c = couples.find((x) => x.id === coupleId)!;
  const src = (id: string, role: 'A' | 'B') => `/${lang}/phone?as=${id}&role=${role}&embed=1#${frag}`;
  const n = (x: number) => x.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB');
  const line = (s: Seen) => {
    const who = t(names[s.person] ?? { en: s.person, ar: s.person });
    switch (s.kind) {
      case 'tokens': return t({ en: `Lab → ${who}: ${s.count} tokens, no gene names`, ar: `المختبر ← ${who}: ${n(s.count ?? 0)} رمزاً، دون أسماء جينات` });
      case 'sent': return t({ en: `${who} → relay: ${n(s.bytes ?? 0)} encrypted characters`, ar: `${who} ← الوسيط: ${n(s.bytes ?? 0)} حرفاً مشفّراً` });
      case 'received': return t({ en: `Relay → ${who}: the partner’s locked list`, ar: `الوسيط ← ${who}: قائمة الشريك المقفلة` });
      case 'proof': return t({ en: `${who}’s phone checked the proof of honest locking`, ar: `تحقق هاتف ${who} من إثبات القفل الأمين` });
      case 'done': return t({ en: `Lab confirmed ${who}’s match (${((s.ms ?? 0) / 1000).toFixed(1)} s)`, ar: `أكد المختبر تطابق ${who}` });
      default: return s.kind;
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t({ en: 'Choose a couple', ar: 'اختر زوجين' })}>
        {couples.map((x) => (
          <button key={x.id} aria-pressed={x.id === coupleId} onClick={() => { setCoupleId(x.id); reset(); }}
            className={`rounded-[2px] border px-3.5 py-2 text-[14px] ${x.id === coupleId ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2 hover:border-ink'}`}>
            {t(names[x.a])} {lang === 'ar' ? 'و' : '&'} {t(names[x.b])}
          </button>
        ))}
        <button onClick={reset} className="ms-auto text-[14px] text-indigo underline underline-offset-4">{t({ en: 'Reset both phones', ar: 'أعد ضبط الهاتفين' })}</button>
      </div>
      <p className="mt-3 text-[14px] text-ink-2">{t(c.story)}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="rounded-[3px] border border-rule bg-paper px-4 py-3">
          <p className="text-[14px] font-medium">{t({ en: 'Try it', ar: 'جرّبه' })}</p>
          <ol className="mt-1 list-decimal space-y-0.5 ps-5 text-[13px] text-ink-2">
            <li>{t({ en: 'On the first phone, tap “Pair with your partner”.', ar: 'في الهاتف الأول، اضغط «اقترن بشريكك».' })}</li>
            <li>{t({ en: 'Check that both phones show the same three words.', ar: 'تحقق من ظهور الكلمات الثلاث نفسها على الهاتفين.' })}</li>
            <li>{t({ en: 'Tap “Compare now” on both phones, in any order.', ar: 'اضغط «قارن الآن» على الهاتفين، بأي ترتيب.' })}</li>
          </ol>
        </div>
        <div className="rounded-[3px] border border-rule bg-paper px-4 py-3">
          <p className="text-[14px] font-medium">{t({ en: 'What to look for', ar: 'ما الذي تلاحظه' })}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-5 text-[13px] text-ink-2">
            {(LOOK[c.id] ?? []).map((l) => <li key={l.en}>{t(l)}</li>)}
          </ul>
        </div>
      </div>

      {frag && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_260px_1fr]" key={`${coupleId}-${round}`}>
          {[{ id: c.a, role: 'A' as const }, { id: c.b, role: 'B' as const }].map((p, i) => (
            <figure key={p.id} className={`mx-auto w-full max-w-[400px] ${i === 1 ? 'lg:order-3' : ''}`}>
              <div className="overflow-hidden rounded-[28px] border-[10px] border-ink bg-ink">
                <iframe title={lang === 'ar' ? `هاتف ${t(names[p.id])}` : `${t(names[p.id])}’s phone`} src={src(p.id, p.role)} className="h-[720px] w-full rounded-[18px] bg-wool" />
              </div>
              <figcaption className="mt-2 text-center text-[13px] text-ink-2">{lang === 'ar' ? `هاتف ${t(names[p.id])}` : `${t(names[p.id])}’s phone`}</figcaption>
            </figure>
          ))}
          <aside className="lg:order-2" aria-live="polite" aria-label={t({ en: 'What the relay and lab saw', ar: 'ما رآه الوسيط والمختبر' })}>
            <p className="text-[14px] font-medium">{t({ en: 'What crossed the wire', ar: 'ما عبر الشبكة' })}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{t({ en: 'Reported by the phones as it happens. The relay stores only these encrypted blobs and deletes them after 10 minutes.', ar: 'تبلّغ عنه الهواتف لحظة حدوثه. لا يخزن الوسيط إلا هذه الكتل المشفّرة ويحذفها بعد 10 دقائق.' })}</p>
            {seen.length === 0 ? (
              <p className="mt-3 rounded-[3px] border border-dashed border-ink-3 px-3 py-4 text-[13px] text-ink-2">{t({ en: 'Nothing yet. Start a pairing.', ar: 'لا شيء بعد. ابدأ الاقتران.' })}</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {seen.map((s, i) => (
                  <li key={i} className="rounded-[3px] border border-rule bg-paper px-3 py-2 text-[12.5px] leading-snug">
                    {line(s)}
                    {s.cipher && <code dir="ltr" className="mt-1 block truncate font-mono text-[10.5px] text-ink-2">{s.cipher}</code>}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
