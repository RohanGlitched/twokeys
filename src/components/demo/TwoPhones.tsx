'use client';
// Two phones side by side, each a real, separate app instance (iframe), pairing through the real
// lab and relay. The page only hands both phones the same link; it never sees their results.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { linkFragment, newLink } from '@/lib/pairing';
import type { CoupleInfo } from '@/components/phone/PhoneRoute';

type L = { en: string; ar: string };

export function TwoPhones({ lang, couples, names }: { lang: Locale; couples: CoupleInfo[]; names: Record<string, L> }) {
  const t = (l: L) => l[lang];
  const [coupleId, setCoupleId] = useState(couples[0].id);
  const [frag, setFrag] = useState('');
  const [round, setRound] = useState(0);
  useEffect(() => { setFrag(linkFragment(newLink())); }, [coupleId, round]);
  const c = couples.find((x) => x.id === coupleId)!;
  const src = (id: string, role: 'A' | 'B') => `/${lang}/phone?as=${id}&role=${role}&embed=1#${frag}`;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t({ en: 'Choose a couple', ar: 'اختر زوجين' })}>
        {couples.map((x) => (
          <button key={x.id} aria-pressed={x.id === coupleId} onClick={() => setCoupleId(x.id)}
            className={`rounded-[2px] border px-3.5 py-2 text-[14px] ${x.id === coupleId ? 'border-ink bg-ink text-wool' : 'border-rule text-ink-2 hover:border-ink'}`}>
            {t(names[x.a])} {lang === 'ar' ? 'و' : '&'} {t(names[x.b])}
          </button>
        ))}
        <button onClick={() => setRound((r) => r + 1)} className="ms-auto text-[14px] text-indigo underline underline-offset-4">{t({ en: 'Reset both phones', ar: 'أعد ضبط الهاتفين' })}</button>
      </div>
      <p className="mt-3 text-[14px] text-ink-2">{t(c.story)}</p>
      {frag && (
        <div className="mt-6 grid gap-6 md:grid-cols-2" key={`${coupleId}-${round}`}>
          {[{ id: c.a, role: 'A' as const }, { id: c.b, role: 'B' as const }].map((p) => (
            <figure key={p.id} className="mx-auto w-full max-w-[400px]">
              <div className="overflow-hidden rounded-[28px] border-[10px] border-ink bg-ink shadow-[0_1px_0_var(--rule)]">
                <iframe title={t(names[p.id])} src={src(p.id, p.role)} className="h-[720px] w-full rounded-[18px] bg-wool" />
              </div>
              <figcaption className="mt-2 text-center text-[13px] text-ink-3">{t(names[p.id])}{t({ en: '’s phone', ar: ': هاتفها/هاتفه' })}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
