'use client';
// Live explainer monitoring counts (routes, escalations, languages) for the governance page.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

type L = { en: string; ar: string };
const ROWS: [string, L][] = [
  ['route:model', { en: 'Answered by the model, all checks passed', ar: 'أجاب النموذج واجتاز كل الفحوص' }],
  ['route:guard', { en: 'Caught by a keyword guard', ar: 'التقطه حارس الكلمات' }],
  ['route:intent', { en: 'Caught by the intent check', ar: 'التقطه فحص النية' }],
  ['route:fallback', { en: 'Checks failed twice: safe fixed answer', ar: 'فشلت الفحوص مرتين: إجابة ثابتة آمنة' }],
  ['escalate', { en: 'Offered a counsellor', ar: 'عُرض عليه مستشار' }],
  ['urgent', { en: 'Distress: offered a same-day call', ar: 'ضيق: عُرضت مكالمة في اليوم نفسه' }],
  ['lang:ar', { en: 'Asked in Arabic', ar: 'سُئل بالعربية' }],
  ['lang:en', { en: 'Asked in English', ar: 'سُئل بالإنجليزية' }],
  ['feedback', { en: '“Report a problem” taps', ar: 'نقرات «الإبلاغ عن مشكلة»' }],
];

export function Monitor({ lang }: { lang: Locale }) {
  const [m, setM] = useState<{ model?: string; totals: Record<string, number> } | null>(null);
  useEffect(() => { fetch('/api/monitor').then((r) => r.json()).then(setM).catch(() => {}); }, []);
  const fmt = new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-GB');
  if (!m) return <div className="mt-6 h-40 animate-pulse bg-wool-2 motion-reduce:animate-none" />;
  return (
    <>
    <dl className="mt-6 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
      {ROWS.map(([k, l]) => (
        <div key={k} className="bg-wool p-4">
          <dt className="text-[13px] text-ink-2">{l[lang]}</dt>
          <dd className="mt-1 text-[28px] font-semibold leading-none">{fmt.format(m.totals[k] ?? 0)}</dd>
        </div>
      ))}
    </dl>
    {m.model && <p className="mt-2 text-[12px] text-ink-2">{lang === 'ar' ? 'النموذج: ' : 'Model: '}<bdi dir="ltr" className="font-mono">{m.model}</bdi>{lang === 'ar' ? ` · ${fmt.format(m.totals[`model:${m.model}`] ?? 0)} إجابة` : ` · ${fmt.format(m.totals[`model:${m.model}`] ?? 0)} answers`}</p>}
    </>
  );
}
