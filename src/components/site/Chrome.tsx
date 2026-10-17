import Link from 'next/link';
import type { Locale } from '@/i18n/locales';
import { Mark } from '@/components/glyphs';

type L = { en: string; ar: string };
const NAV: { href: string; label: L }[] = [
  { href: '/how', label: { en: 'How it works', ar: 'كيف يعمل' } },
  { href: '/demo', label: { en: 'Try it', ar: 'جرّبه' } },
  { href: '/desk', label: { en: 'Counsellors', ar: 'المرشدون' } },
  { href: '/programme', label: { en: 'Programme', ar: 'البرنامج' } },
  { href: '/proof', label: { en: 'Proof', ar: 'الإثبات' } },
  { href: '/governance', label: { en: 'Governance', ar: 'الحوكمة' } },
];

export function Nav({ lang, path = '' }: { lang: Locale; path?: string }) {
  const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <header className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 py-5 md:px-8">
      <Link href={`/${lang}`} className="flex items-center gap-2.5 text-[18px] font-semibold tracking-tight">
        <Mark size={28} />
        {lang === 'ar' ? 'مفتاحان' : 'Two Keys'}
        <span className="font-naskh text-[17px] font-medium text-ink-3">{lang === 'ar' ? 'Two Keys' : 'مفتاحان'}</span>
      </Link>
      <nav className="hidden items-center gap-7 text-[14px] text-ink-2 md:flex">
        {NAV.map((n) => (
          <Link key={n.href} href={`/${lang}${n.href}`} className={`hover:text-ink ${path === n.href ? 'text-ink underline underline-offset-[6px]' : ''}`}>{n.label[lang]}</Link>
        ))}
        <Link href={`/${other}${path}`} lang={other} className="rounded-[2px] border border-rule px-2.5 py-1 hover:border-ink">{other === 'ar' ? 'العربية' : 'English'}</Link>
      </nav>
      {/* Phones: the same links in a native disclosure, so every page is one tap from the top. */}
      <details className="relative md:hidden">
        <summary className="cursor-pointer list-none rounded-[2px] border border-ink-3 px-3 py-1.5 text-[14px]">{lang === 'ar' ? 'القائمة' : 'Menu'}</summary>
        <nav className="absolute end-0 z-30 mt-2 flex w-56 flex-col rounded-[3px] border border-ink bg-paper p-2 text-[15px] shadow-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={`/${lang}${n.href}`} aria-current={path === n.href ? 'page' : undefined} className="rounded-[2px] px-3 py-2.5 hover:bg-wool-2">{n.label[lang]}</Link>
          ))}
          <Link href={`/${other}${path}`} lang={other} className="mt-1 rounded-[2px] border-t border-rule px-3 py-2.5">{other === 'ar' ? 'العربية' : 'English'}</Link>
        </nav>
      </details>
    </header>
  );
}

export function Footer({ lang }: { lang: Locale }) {
  const t = (l: L) => l[lang];
  const cols: { title: L; links: { href: string; label: L; ext?: boolean }[] }[] = [
    { title: { en: 'Product', ar: 'المنتج' }, links: [
      { href: `/${lang}/how`, label: { en: 'How it works', ar: 'كيف يعمل' } },
      { href: `/${lang}/demo`, label: { en: 'Two-phone demo', ar: 'عرض الهاتفين' } },
      { href: `/${lang}/phone`, label: { en: 'Open the phone app', ar: 'افتح تطبيق الهاتف' } },
      { href: `/${lang}/desk`, label: { en: 'Counsellor desk', ar: 'مكتب المستشار' } },
      { href: `/${lang}/programme`, label: { en: 'Programme view', ar: 'عرض البرنامج' } },
    ] },
    { title: { en: 'Evidence', ar: 'الأدلة' }, links: [
      { href: `/${lang}/proof`, label: { en: 'Proof and evaluations', ar: 'الإثبات والتقييمات' } },
      { href: `/${lang}/proof#sources`, label: { en: 'Sources and data rights', ar: 'المصادر وحقوق البيانات' } },
      { href: `/${lang}/how#threats`, label: { en: 'Who could learn what', ar: 'من قد يعرف ماذا' } },
      { href: `/${lang}/governance`, label: { en: 'Governance pack', ar: 'ملف الحوكمة' } },
    ] },
    { title: { en: 'Built on', ar: 'مبني على' }, links: [
      { href: 'https://github.com/paulmillr/noble-curves', label: { en: 'noble-curves (ristretto255)', ar: 'noble-curves (ristretto255)' }, ext: true },
      { href: 'https://gnomad.broadinstitute.org/', label: { en: 'gnomAD v4.1', ar: 'gnomAD v4.1' }, ext: true },
      { href: 'https://medlineplus.gov/genetics/', label: { en: 'MedlinePlus Genetics', ar: 'MedlinePlus Genetics' }, ext: true },
      { href: 'https://aws.amazon.com/bedrock/', label: { en: 'Amazon Bedrock (Nova Pro)', ar: 'Amazon Bedrock (Nova Pro)' }, ext: true },
    ] },
  ];
  return (
    <footer className="mt-24 border-t-[1.5px] border-ink bg-wool-2">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-6 py-12 md:grid-cols-[2fr_1fr_1fr_1fr] md:px-8">
        <div>
          <div className="flex items-center gap-2.5 text-[17px] font-semibold"><Mark size={24} />{lang === 'ar' ? 'مفتاحان' : 'Two Keys'}</div>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-ink-2">
            {t({ en: 'A prototype for the Future Health Digital Innovation Challenge, statement 3: understanding and reducing inherited disease risk. Every person and result on this site is synthetic. Nothing here is medical advice.', ar: 'نموذج أولي لتحدي الابتكار الرقمي للصحة المستقبلية، البيان 3: فهم مخاطر الأمراض الوراثية والحد منها. كل الأشخاص والنتائج في هذا الموقع افتراضية، ولا شيء هنا نصيحة طبية.' })}
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title.en}>
            <h2 className="text-[13px] font-medium text-ink-3">{t(c.title)}</h2>
            <ul className="mt-3 space-y-2 text-[14px]">
              {c.links.map((l) => <li key={l.href}>{l.ext ? <a href={l.href} target="_blank" rel="noreferrer" className="hover:underline">{t(l.label)}</a> : <Link href={l.href} className="hover:underline">{t(l.label)}</Link>}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[1240px] border-t border-rule px-6 py-5 text-[12px] text-ink-3 md:px-8">
        {t({ en: 'Pattern after Al Sadu weaving, on UNESCO’s list of intangible cultural heritage. Pedigree notation after the NSGC standard.', ar: 'الزخارف مستوحاة من نسيج السدو المدرج في قائمة اليونسكو للتراث الثقافي غير المادي، ورموز شجرة العائلة وفق معيار NSGC.' })}
      </div>
    </footer>
  );
}
