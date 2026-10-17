'use client';
// Live explainer monitoring counts (routes, escalations, languages, failed checks, Arabic repairs and
// answers per version) for the governance page.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

type L = { en: string; ar: string };
const ROWS: [string, L][] = [
  ['route:model', { en: 'Answered by the model, all checks passed', ar: 'أجاب النموذج واجتاز كل الفحوص' }],
  ['route:guard', { en: 'Caught by a keyword guard', ar: 'التقطه حارس الكلمات' }],
  ['route:intent', { en: 'Caught by the intent check', ar: 'التقطه فحص النية' }],
  ['route:fallback', { en: 'Checks failed twice: safe fixed answer', ar: 'فشلت الفحوص مرتين: إجابة ثابتة آمنة' }],
  ['escalate', { en: 'Offered a counsellor', ar: 'عُرض عليه مرشد وراثي' }],
  // Counted only when the explainer flags a crisis (urgent), not when a worried question falls back.
  ['urgent', { en: 'Crisis: offered a same-day call', ar: 'أزمة: عُرضت مكالمة في اليوم نفسه' }],
  ['lang:ar', { en: 'Asked in Arabic', ar: 'سُئل بالعربية' }],
  ['lang:en', { en: 'Asked in English', ar: 'سُئل بالإنجليزية' }],
  ['feedback', { en: '“Report a problem” taps', ar: 'نقرات «الإبلاغ عن مشكلة»' }],
  ['repaired', { en: 'Arabic answers repaired before the checks', ar: 'إجابات عربية صُحّحت صياغتها قبل الفحوص' }],
  ['reveal-mismatch', { en: 'Pairings where a comparison didn’t match the lab', ar: 'اقترانات لم تطابق فيها مقارنةٌ سجلات المختبر' }],
];
/** Plain names for the code checks (lib/ask), so a reviewer can read which one turned answers into fallbacks. */
const CHECK: Record<string, L> = {
  numbersOk: { en: 'numbers', ar: 'الأرقام' }, nonDirective: { en: 'non-directive', ar: 'عدم التوجيه' }, citesOk: { en: 'citations', ar: 'المصادر' },
  oddsOk: { en: 'odds', ar: 'الاحتمالات' }, personaOk: { en: 'persona', ar: 'الدور' }, languageOk: { en: 'language', ar: 'اللغة' },
  framingOk: { en: 'framing', ar: 'الصياغة' }, xlOk: { en: 'X-linked', ar: 'الكروموسوم X' }, strengthOk: { en: 'milder match', ar: 'التطابق الأخف' },
  reassureOk: { en: 'false reassurance', ar: 'الطمأنة الخاطئة' }, relatedOk: { en: 'relatedness', ar: 'القرابة' }, coverOk: { en: 'cover', ar: 'التغطية' },
};

interface M { model?: string; version?: string; totals: Record<string, number>; fails?: Record<string, number>; versions?: Record<string, number>; fallbackRate?: number | null }

export function Monitor({ lang }: { lang: Locale }) {
  const [m, setM] = useState<M | null>(null);
  useEffect(() => { fetch('/api/monitor').then((r) => r.json()).then(setM).catch(() => {}); }, []);
  const fmt = new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-GB');
  const t = (l: L) => l[lang];
  if (!m) return <div role="status" className="mt-6 h-40 animate-pulse bg-wool-2 motion-reduce:animate-none"><span className="sr-only">{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</span></div>;
  const fails = Object.entries(m.fails ?? {}).sort((a, b) => b[1] - a[1]);
  const versions = Object.entries(m.versions ?? {}).sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <>
    <dl className="mt-6 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
      {ROWS.map(([k, l]) => (
        <div key={k} className="bg-wool p-4">
          <dt className="text-[13px] text-ink-2">{t(l)}</dt>
          <dd className="mt-1 text-[28px] font-semibold leading-none">{fmt.format(m.totals[k] ?? 0)}</dd>
        </div>
      ))}
      <div className="bg-paper p-4">
        <dt className="text-[13px] text-ink-2">{t({ en: 'Fallback rate, 30 days', ar: 'معدل الإجابات البديلة، 30 يوماً' })}</dt>
        <dd className="mt-1 text-[28px] font-semibold leading-none">{m.fallbackRate == null ? '—' : `${fmt.format(Math.round(m.fallbackRate * 1000) / 10)}%`}</dd>
      </div>
    </dl>
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="text-[15px] font-semibold">{t({ en: 'Which check turned an answer into a fallback', ar: 'أي فحص حوّل الإجابة إلى بديل ثابت' })}</h3>
        <ul className="mt-2 divide-y divide-rule border-y border-rule text-[14px]">
          {fails.map(([k, n]) => (
            <li key={k} className="flex justify-between gap-3 py-1.5"><span>{CHECK[k] ? t(CHECK[k]) : k} <bdi dir="ltr" className="font-mono text-[12px] text-ink-2">{k}</bdi></span><span className="font-medium">{fmt.format(n)}</span></li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-[15px] font-semibold">{t({ en: 'Answers per explainer version', ar: 'الإجابات حسب نسخة الشارح' })}</h3>
        {versions.length ? (
          <ul className="mt-2 divide-y divide-rule border-y border-rule text-[14px]">
            {versions.map(([v, n]) => (
              <li key={v} className="flex justify-between gap-3 py-1.5"><bdi dir="ltr" className="font-mono text-[13px]">{v}</bdi><span className="font-medium">{fmt.format(n)}{v === m.version ? t({ en: ' (current)', ar: ' (الحالية)' }) : ''}</span></li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[14px] text-ink-2">{t({ en: 'No answers in the last 30 days.', ar: 'لا إجابات في آخر 30 يوماً.' })}</p>}
      </div>
    </div>
    {m.model && <p className="mt-3 text-[12px] text-ink-2">{lang === 'ar' ? 'النموذج: ' : 'Model: '}<bdi dir="ltr" className="font-mono">{m.model}</bdi>{lang === 'ar' ? ` · ${fmt.format(m.totals[`model:${m.model}`] ?? 0)} إجابة` : ` · ${fmt.format(m.totals[`model:${m.model}`] ?? 0)} answers`}</p>}
    <p className="mt-1 text-[12px] text-ink-2">{t({ en: 'Review rule: review when the weekly fallback rate is 5 points above the latest evaluation’s. It is read from these counts by hand; automated alerts are not built yet.', ar: 'قاعدة المراجعة: تُجرى مراجعة إذا زاد معدل الإجابات البديلة الأسبوعي 5 نقاط عن معدل آخر تقييم. ويُقرأ من هذه الأعداد يدوياً، ولم تُبنَ التنبيهات الآلية بعد.' })}</p>
    </>
  );
}
