'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import type { Relationship } from '@/lib/risk';
import { PhoneApp, type PublicPerson } from './PhoneApp';
import { Person } from '@/components/glyphs';

export interface CoupleInfo { id: string; a: string; b: string; relationship: Relationship; story: { en: string; ar: string } }

/** Picks the synthetic person from ?as= (the demo's stand-in for logging in). */
export function PhoneRoute({ lang, people, couples }: { lang: Locale; people: PublicPerson[]; couples: CoupleInfo[] }) {
  const q = useSearchParams();
  const as = q.get('as');
  const role = q.get('role');
  const embedded = q.get('embed') === '1';
  const me = people.find((p) => p.id === as);
  // A scanned QR lands here with the pairing in the #fragment; keep it on the picker's links.
  const [hash, setHash] = useState('');
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
  useEffect(() => { setHash(window.location.hash); }, []);
  const ar = lang === 'ar';
  if (!me) {
    const invited = hash.length > 40;
    // The invitation names who it was for; that person comes first, everyone else waits behind "Not you?".
    const guest = invited ? people.find((p) => p.id === q.get('for')) : undefined;
    const href = (id: string) => `/${lang}/phone?as=${id}${hash}`;
    const list = (
      <ul className="mt-6 divide-y divide-rule border-y border-rule">
        {couples.map((c) => (
          <li key={c.id} className="py-4">
            <p className="text-[13px] text-ink-2">{c.story[lang]}</p>
            <div className="mt-2 flex gap-3">
              {[c.a, c.b].map((id) => {
                const p = people.find((x) => x.id === id)!;
                return (
                  <Link key={id} href={href(id)} className="flex min-h-11 flex-1 items-center gap-2 rounded-[2px] border border-ink px-3 py-2.5 text-[15px] font-medium">
                    <Person sex={p.sex} color={p.sex === 'F' ? 'var(--indigo)' : 'var(--camel)'} size={20} /> {p.name[lang]}
                  </Link>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    );
    if (guest) {
      const he = guest.sex === 'M';
      return (
        <main id="main" className="mx-auto max-w-md px-5 py-10">
          <p className="text-[13px] text-ink-2">{ar ? 'دعوة للمقارنة' : 'An invitation to compare'}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
            {ar ? (he ? `هل أنت ${guest.name.ar}؟` : `هل أنتِ ${guest.name.ar}؟`) : `You’re ${guest.name.en}?`}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            {ar ? (he ? 'دعتك شريكتك إلى مقارنة نتائج الفحص. تابع لتفتح بطاقتك، وستصل الدعوة معك.' : 'دعاكِ شريكك إلى مقارنة نتائج الفحص. تابعي لتفتحي بطاقتك، وستصل الدعوة معك.')
              : 'Your partner invited you to compare screening results. Continue to open your card; the invitation comes with you.'}
          </p>
          <Link href={href(guest.id)} className="mt-6 flex min-h-12 items-center justify-center gap-2.5 rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">
            <Person sex={guest.sex} color="var(--wool)" size={20} />
            {ar ? (he ? `تابع باسم ${guest.name.ar}` : `تابعي باسم ${guest.name.ar}`) : `Continue as ${guest.name.en}`}
          </Link>
          <p className="mt-3 text-[13px] text-ink-2">{ar ? 'كل الأشخاص هنا افتراضيون. في الحياة الحقيقية تفتح بطاقتك بعد تسجيل الدخول عبر الهوية الرقمية.' : 'Everyone here is synthetic. In real life you would open your card after signing in with UAE PASS.'}</p>
          <details className="mt-8">
            <summary className="cursor-pointer py-2.5 text-[15px] font-medium">{ar ? 'لست هذا الشخص؟' : 'Not you?'}</summary>
            {list}
          </details>
        </main>
      );
    }
    return (
      <main id="main" className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-[28px] font-semibold tracking-tight">{ar ? 'من أنت في هذا العرض؟' : 'Who are you in this demo?'}</h1>
        {invited && <p className="mt-3 border-s-4 border-indigo bg-paper px-3 py-2 text-[14px]">{ar ? 'دعاك شريكك إلى المقارنة. اختر الشخص الذي تمثله، وستصل الدعوة معك.' : 'Your partner invited you to compare. Choose who you are and the invitation comes with you.'}</p>}
        <p className="mt-2 text-[14px] text-ink-2">{ar ? 'كل الأشخاص هنا افتراضيون. في الحياة الحقيقية تفتح بطاقتك بعد تسجيل الدخول عبر الهوية الرقمية.' : 'Everyone here is synthetic. In real life you would open your card after signing in with UAE PASS.'}</p>
        {list}
      </main>
    );
  }
  const couple = couples.find((c) => c.a === me.id || c.b === me.id);
  const partner = couple ? (couple.a === me.id ? couple.b : couple.a) : undefined;
  return <PhoneApp lang={lang} me={me} relationship={couple?.relationship ?? 'unrelated'} partner={partner} role={role === 'A' || role === 'B' ? role : undefined} embedded={embedded} />;
}
