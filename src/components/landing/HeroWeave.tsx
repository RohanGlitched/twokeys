// The hero: a family tree drawn in pedigree notation. Two siblings' children (first cousins) marry —
// the double line — and the couple's two threads weave into an Al Sadu band where only the shared
// gene shows, in madder. Drawn once on load; still for reduced motion.
import type { Locale } from '@/i18n/locales';

export function HeroWeave({ lang }: { lang: Locale }) {
  const ar = lang === 'ar';
  const shared = ar ? 'جين CYP21A2 · كلاهما يحمله · 1 من 4 لكل حمل' : 'CYP21A2 · both carry · 1 in 4 per pregnancy';
  const rest = ar ? 'وكل ما عدا ذلك يبقى على هاتف كل منهما.' : 'Everything else each of them carries stays on their own phone.';
  const motifs = 13;
  const w = 520 / motifs;
  return (
    <figure className="hero-weave m-0">
      <svg viewBox="0 0 640 600" width="100%" role="img" aria-label={ar ? 'شجرة عائلة يلتقي فيها أبناء العم، وتنسج خيوطهما شريطاً لا يظهر فيه إلا الجين المشترك' : 'A family tree in which first cousins marry; their threads weave into one band where only the shared gene shows'}>
        <g className="hw-lines" fill="none" stroke="var(--ink)" strokeWidth="2.2">
          <rect x="246" y="30" width="34" height="34" />
          <circle cx="377" cy="47" r="17" />
          <path d="M280 47 H360 M320 47 V92 M180 92 H460 M180 92 V120 M460 92 V120" pathLength={1} className="draw" />
          <rect x="163" y="120" width="34" height="34" />
          <circle cx="460" cy="137" r="17" />
          <circle cx="90" cy="137" r="17" />
          <rect x="533" y="120" width="34" height="34" />
          <path d="M107 137 H163 M477 137 H533 M135 137 V200 M505 137 V200" pathLength={1} className="draw d2" />
        </g>
        <rect x="163" y="120" width="17" height="34" fill="var(--ink)" className="fade d2" />
        <path d="M460 120 a17 17 0 0 0 0 34Z" fill="var(--ink)" className="fade d2" />
        <g className="fade d3">
          <circle cx="135" cy="222" r="22" fill="var(--wool)" stroke="var(--indigo)" strokeWidth="2.4" />
          <path d="M135 200 a22 22 0 0 0 0 44Z" fill="var(--indigo)" />
          <rect x="483" y="200" width="44" height="44" fill="var(--wool)" stroke="var(--camel)" strokeWidth="2.4" />
          <rect x="483" y="200" width="22" height="44" fill="var(--camel)" />
        </g>
        <path d="M157 216 H483 M157 228 H483" stroke="var(--ink)" strokeWidth="2.2" pathLength={1} className="draw d3" />
        <text x="320" y="206" textAnchor="middle" fontSize="12" fill="var(--ink-2)" className="fade d3">{ar ? 'أبناء عمومة' : 'first cousins'}</text>
        <text x="135" y="282" textAnchor="middle" fontSize="14" fill="var(--indigo)" fontWeight="500" className="fade d3">{ar ? 'مفتاحها' : 'Her key'}</text>
        <text x="505" y="282" textAnchor="middle" fontSize="14" fill="var(--camel)" fontWeight="500" className="fade d3">{ar ? 'مفتاحه' : 'His key'}</text>
        <path d="M135 300 C 135 360, 300 360, 300 420" stroke="var(--indigo)" strokeWidth="3" fill="none" pathLength={1} className="draw d4" />
        <path d="M505 300 C 505 360, 340 360, 340 420" stroke="var(--camel)" strokeWidth="3" fill="none" pathLength={1} className="draw d4" />
        <g className="fade d5">
          <rect x="60" y="420" width="520" height="80" fill="var(--ink)" />
          {Array.from({ length: 26 }, (_, i) => (
            <g key={i}>
              <path d={`M${60 + i * 20} 432 L${70 + i * 20} 423 L${80 + i * 20} 432Z`} fill="var(--wool)" />
              <path d={`M${60 + i * 20} 488 L${70 + i * 20} 497 L${80 + i * 20} 488Z`} fill="var(--wool)" />
            </g>
          ))}
          {Array.from({ length: motifs }, (_, i) => {
            const cx = 60 + w * i + w / 2;
            const lit = i === 6;
            return (
              <g key={`m${i}`}>
                <path d={`M${cx} 442 L${cx + 17} 460 L${cx} 478 L${cx - 17} 460Z`} fill={lit ? 'var(--madder)' : 'none'} stroke="var(--wool)" strokeWidth={lit ? 3 : 1.6} className={lit ? 'lit' : undefined} />
                {!lit && <path d={`M${cx} 452 L${cx + 8} 460 L${cx} 468 L${cx - 8} 460Z`} fill="var(--wool)" />}
              </g>
            );
          })}
          <rect x="60" y="420" width="520" height="80" fill="none" stroke="var(--ink)" strokeWidth="2" />
        </g>
        <text x="320" y="534" textAnchor="middle" fontSize="16" fontWeight="600" fill="var(--madder)" className="fade d6">{shared}</text>
        <text x="320" y="558" textAnchor="middle" fontSize="13" fill="var(--ink-2)" className="fade d6">{rest}</text>
      </svg>
      <style>{`
        .hero-weave .draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: hw-draw .9s cubic-bezier(.6,0,.2,1) forwards; }
        .hero-weave .fade { opacity: 0; animation: hw-fade .6s ease-out forwards; }
        .hero-weave .d2 { animation-delay: .5s } .hero-weave .d3 { animation-delay: 1s } .hero-weave .d4 { animation-delay: 1.5s }
        .hero-weave .d5 { animation-delay: 2.1s } .hero-weave .d6 { animation-delay: 2.7s }
        .hero-weave .lit { transform-origin: center; transform-box: fill-box; animation: hw-lit .7s 2.6s ease-out both; }
        @keyframes hw-draw { to { stroke-dashoffset: 0; } }
        @keyframes hw-fade { to { opacity: 1; } }
        @keyframes hw-lit { from { transform: scale(.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .hero-weave .draw { stroke-dashoffset: 0; animation: none } .hero-weave .fade, .hero-weave .lit { opacity: 1; animation: none } }
      `}</style>
    </figure>
  );
}
