'use client';
// The follow-on screens after a couple result: options, a counsellor, questions, and family.
import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';
import { letterFor, oneIn, RELATIONS, sealLetter, type Relation } from '@/lib/letters';
import { RELATION_NAME } from '@/components/family/LetterView';

type L = { en: string; ar: string };
const useT = (lang: Locale) => (l: L) => l[lang];

function Back({ lang, onBack }: { lang: Locale; onBack: () => void }) {
  return <button onClick={onBack} className="text-[14px] text-ink-2">{lang === 'ar' ? '→ رجوع إلى النتيجة' : '← Back to the result'}</button>;
}

// ---------------------------------------------------------------- options

const OPTIONS: { title: L; body: L }[] = [
  { title: { en: 'Go ahead with no changes', ar: 'المضي دون تغيير' },
    body: { en: 'Many couples choose this. Newborn screening and early care can make a big difference for several of these conditions.', ar: 'يختار كثير من الأزواج ذلك. ويُحدث فحص حديثي الولادة والرعاية المبكرة فرقاً كبيراً في عدد من هذه الحالات.' } },
  { title: { en: 'Testing during pregnancy', ar: 'الفحص أثناء الحمل' },
    body: { en: 'A test in early pregnancy can show whether the baby is affected, so you can prepare. It is done only with the mother’s consent.', ar: 'يمكن لفحص في بداية الحمل أن يبيّن إن كان الجنين مصاباً، لتستعدا. ولا يُجرى إلا بموافقة الأم.' } },
  { title: { en: 'IVF with embryo testing (PGT-M)', ar: 'أطفال الأنابيب مع فحص الأجنة (PGT-M)' },
    body: { en: 'Embryos are tested before transfer and an unaffected one is chosen. In Abu Dhabi, Thiqa covers it for couples who carry the same gene.', ar: 'تُفحص الأجنة قبل نقلها ويُختار جنين غير مصاب. وفي أبوظبي يغطيه تأمين ثقة للأزواج الحاملين للجين نفسه.' } },
  { title: { en: 'Talk it through first', ar: 'التحدث أولاً' },
    body: { en: 'A counsellor can explain each option, arrange confirmatory tests, and meet you as a couple. They will not decide for you.', ar: 'يمكن للمستشار شرح كل خيار وترتيب الفحوص التأكيدية ولقاؤكما معاً. ولن يقرر عنكما.' } },
];

export function Options({ lang, onBack, onCounsellor }: { lang: Locale; onBack: () => void; onCounsellor: () => void }) {
  const t = useT(lang);
  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight">{t({ en: 'Your options', ar: 'خياراتكما' })}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'In no particular order. No option is right for everyone, and you can take your time.', ar: 'بلا ترتيب معيّن. لا يوجد خيار صحيح للجميع، ولكما أن تأخذا وقتكما.' })}</p>
      <ul className="mt-4 grid gap-3">
        {OPTIONS.map((o) => (
          <li key={o.title.en} className="rounded-[3px] border border-ink bg-paper px-4 py-3.5">
            <h3 className="text-[16px] font-semibold">{t(o.title)}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t(o.body)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-3">{t({ en: 'For questions of faith, a scholar you trust can help. UAE law does not stop any couple from marrying, whatever their result.', ar: 'وللمسائل الشرعية يمكن لعالِم تثقان به أن يساعد. ولا يمنع القانون الإماراتي أي زوجين من الزواج أياً كانت النتيجة.' })}</p>
      <button onClick={onCounsellor} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">{t({ en: 'Talk to a counsellor', ar: 'تحدّث إلى مستشار' })}</button>
    </section>
  );
}

// ---------------------------------------------------------------- counsellor

export function Counsellor({ lang, onBack, person, pairing, genes, level, related }: {
  lang: Locale; onBack: () => void; person: string; pairing: string | null; genes: string[]; level: Level; related: boolean;
}) {
  const t = useT(lang);
  const [own, setOwn] = useState(false);
  const [rel, setRel] = useState(related);
  const [booked, setBooked] = useState<{ id: string; dueBy: number } | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const book = async () => {
    setBusy(true);
    const r = await fetch('/api/desk/cases', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ person, pairing, sharedGenes: genes, consent: { ownResults: own, relationship: rel }, language: lang, readingLevel: level }) });
    setBusy(false);
    if (r.ok) setBooked(await r.json());
  };
  const withdraw = async () => {
    if (!booked) return;
    await fetch(`/api/desk/cases/${booked.id}?person=${person}`, { method: 'DELETE' });
    setWithdrawn(true);
  };
  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight">{t({ en: 'Talk to a counsellor', ar: 'تحدّث إلى مستشار' })}</h2>
      {!booked ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Choose exactly what the counsellor may see. Nothing else leaves this phone.', ar: 'اختر بالضبط ما يمكن للمستشار رؤيته. ولا يخرج شيء آخر من هذا الهاتف.' })}</p>
          <fieldset className="mt-4 divide-y divide-rule border-y border-rule">
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked disabled className="mt-1" />
              <span><span className="font-medium">{t({ en: 'The genes we both carry', ar: 'الجينات التي نحملها معاً' })}</span><br /><span className="text-ink-2">{genes.length ? genes.join(', ') : t({ en: 'none on this panel', ar: 'لا شيء في هذه اللوحة' })}{t({ en: ' (needed to book)', ar: ' (لازم للحجز)' })}</span></span></label>
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-1" />
              <span><span className="font-medium">{t({ en: 'My own full results', ar: 'نتائجي الكاملة' })}</span><br /><span className="text-ink-2">{t({ en: 'Only you and the counsellor, never your partner.', ar: 'أنت والمستشار فقط، ولا يراها شريكك أبداً.' })}</span></span></label>
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked={rel} onChange={(e) => setRel(e.target.checked)} className="mt-1" />
              <span><span className="font-medium">{t({ en: 'That we are related', ar: 'أن بيننا قرابة' })}</span><br /><span className="text-ink-2">{t({ en: 'Helps the counsellor explain your chances.', ar: 'يساعد المستشار على شرح الاحتمالات.' })}</span></span></label>
          </fieldset>
          <button onClick={book} disabled={busy} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-60">
            {busy ? t({ en: 'Booking…', ar: 'جارٍ الحجز…' }) : t({ en: 'Book a call', ar: 'احجز مكالمة' })}
          </button>
        </>
      ) : withdrawn ? (
        <p className="mt-4 text-[15px] leading-relaxed">{t({ en: 'Consent withdrawn. Everything you shared was erased from the counsellor’s desk; only a line saying you withdrew remains in the audit trail.', ar: 'سُحبت الموافقة. مُسح كل ما شاركته من مكتب المستشار، ولم يبقَ في سجل التدقيق إلا سطر يفيد بالسحب.' })}</p>
      ) : (
        <div className="mt-4">
          <p className="text-[18px] font-semibold">{t({ en: 'Booked.', ar: 'تم الحجز.' })}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            {t({ en: `A counsellor will contact you in the app by ${new Date(booked.dueBy).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.`, ar: `سيتواصل معك مستشار عبر التطبيق قبل ${new Date(booked.dueBy).toLocaleDateString('ar-AE', { weekday: 'long', day: 'numeric', month: 'long' })}.` })}
          </p>
          <p className="mt-1 font-mono text-[12px] text-ink-3">{t({ en: 'Case', ar: 'الحالة' })} {booked.id}</p>
          <button onClick={withdraw} className="mt-4 text-[14px] font-medium text-madder underline underline-offset-4">{t({ en: 'Withdraw consent and erase what I shared', ar: 'اسحب الموافقة وامسح ما شاركته' })}</button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- ask

interface Turn { role: 'user' | 'assistant'; text: string; cites?: string[]; route?: string }

const STARTERS: L[] = [
  { en: 'What does it mean that we both carry this?', ar: 'ماذا يعني أننا نحمل هذا معاً؟' },
  { en: 'Can our children be healthy?', ar: 'هل يمكن أن يكون أطفالنا أصحاء؟' },
  { en: 'Does being cousins change anything?', ar: 'هل تغيّر قرابتنا شيئاً؟' },
];

export function Ask({ lang, onBack, genes, xl, level, related }: { lang: Locale; onBack: () => void; genes: string[]; xl: string[]; level: Level; related: boolean }) {
  const t = useT(lang);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((x) => [...x, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, level, genes, xl, related, question, history }) });
      const j = await r.json();
      setTurns((x) => [...x, r.ok ? { role: 'assistant', text: j.answer, cites: j.cites, route: j.route } : { role: 'assistant', text: j.error }]);
    } finally { setBusy(false); }
  };
  return (
    <section className="flex flex-col">
      <Back lang={lang} onBack={onBack} />
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight">{t({ en: 'Ask a question', ar: 'اطرح سؤالاً' })}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{t({ en: 'Answers come only from checked medical sources and your couple result. This is information, not medical advice; a counsellor is one tap away.', ar: 'تأتي الإجابات فقط من مصادر طبية موثوقة ومن نتيجتكما. هذه معلومات وليست نصيحة طبية، والمستشار على بُعد ضغطة.' })}</p>
      <div className="mt-4 space-y-3" aria-live="polite">
        {turns.map((m, i) => (
          <div key={i} data-turn={m.role} className={m.role === 'user' ? 'ms-8 rounded-[3px] bg-ink px-3.5 py-2.5 text-[14px] text-wool' : 'me-4 rounded-[3px] border border-rule bg-paper px-3.5 py-2.5 text-[14px] leading-relaxed'}>
            {m.text}
            {m.cites?.length ? <p className="mt-1.5 font-mono text-[11px] text-ink-3">{m.cites.join(' · ')}</p> : null}
          </div>
        ))}
        {busy && <div className="me-4 h-10 animate-pulse rounded-[3px] bg-wool-2" />}
      </div>
      {!turns.length && (
        <div className="mt-2 flex flex-col gap-2">
          {STARTERS.map((s) => <button key={s.en} onClick={() => send(t(s))} className="rounded-[2px] border border-rule px-3 py-2 text-start text-[14px] hover:border-ink">{t(s)}</button>)}
        </div>
      )}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <label className="sr-only" htmlFor="q">{t({ en: 'Your question', ar: 'سؤالك' })}</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder={t({ en: 'Type your question', ar: 'اكتب سؤالك' })}
          className="min-w-0 flex-1 rounded-[2px] border border-ink bg-paper px-3 py-3 text-[15px]" />
        <button disabled={busy || !q.trim()} className="rounded-[2px] bg-ink px-4 text-[15px] font-medium text-wool disabled:opacity-50">{t({ en: 'Ask', ar: 'اسأل' })}</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- family

interface Made { relation: Relation; url: string; id: string; manage: string; opened?: number; booked?: number }

export function Family({ lang, onBack, genes }: { lang: Locale; onBack: () => void; genes: string[] }) {
  const t = useT(lang);
  const [gene, setGene] = useState(genes[0] ?? '');
  const [relation, setRelation] = useState<Relation>('sibling');
  const [made, setMade] = useState<Made[]>([]);
  const preview = gene ? letterFor(gene, relation, lang) : null;
  const create = async () => {
    if (!gene) return;
    const body = letterFor(gene, relation, lang);
    const { c, key } = await sealLetter(body);
    const r = await fetch('/api/family', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ c }) });
    const j = await r.json();
    if (!r.ok) return;
    setMade((m) => [...m, { relation, id: j.id, manage: j.manage, url: `${window.location.origin}/${lang}/r/${j.id}#${key}` }]);
  };
  const refresh = async () => {
    const next = await Promise.all(made.map(async (m) => {
      const r = await fetch(`/api/family/${m.id}?manage=${m.manage}`);
      return r.ok ? { ...m, ...(await r.json()) } : m;
    }));
    setMade(next);
  };
  if (!genes.length) {
    return (
      <section><Back lang={lang} onBack={onBack} />
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{t({ en: 'You can tell relatives about a gene you know you carry. Open your own results first, or pair with your partner.', ar: 'يمكنك إخبار أقاربك بجين تعرف أنك تحمله. افتح نتائجك أولاً، أو اقترن بشريكك.' })}</p>
      </section>
    );
  }
  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <h2 className="mt-3 text-[24px] font-semibold tracking-tight">{t({ en: 'Tell relatives, without your name', ar: 'أخبر أقاربك دون ذكر اسمك' })}</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Relatives can carry the same change. Each note is sealed on this phone; the service can’t read it and won’t know it came from you.', ar: 'قد يحمل الأقارب التغيّر نفسه. تُختم كل رسالة على هذا الهاتف، ولا تستطيع الخدمة قراءتها ولن تعرف أنها منك.' })}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <label className="text-[13px] text-ink-2">{t({ en: 'Gene', ar: 'الجين' })}
          <select value={gene} onChange={(e) => setGene(e.target.value)} className="mt-1 w-full rounded-[2px] border border-ink bg-paper px-2 py-2.5 text-[15px] text-ink">
            {genes.map((g) => <option key={g} value={g}>{g}</option>)}
          </select></label>
        <label className="text-[13px] text-ink-2">{t({ en: 'They are my', ar: 'صلة القرابة' })}
          <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)} className="mt-1 w-full rounded-[2px] border border-ink bg-paper px-2 py-2.5 text-[15px] text-ink">
            {RELATIONS.map((r) => <option key={r} value={r}>{t(RELATION_NAME[r])}</option>)}
          </select></label>
      </div>
      {preview && (
        <p className="mt-3 text-[14px] leading-relaxed">
          {t({ en: `Their chance of carrying it: about ${oneIn(preview.chance)}`, ar: `احتمال أن يحمله: نحو ${oneIn(preview.chance)}` })}
          {preview.population ? <span className="text-ink-2">{t({ en: ` (general population ${oneIn(preview.population)})`, ar: ` (عامة الناس ${oneIn(preview.population)})` })}</span> : null}
        </p>
      )}
      <button onClick={create} className="mt-4 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">{t({ en: 'Make a sealed note', ar: 'أنشئ رسالة مختومة' })}</button>
      {made.length > 0 && (
        <ul className="mt-5 divide-y divide-rule border-y border-rule text-[13px]">
          {made.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex justify-between gap-2"><span className="font-medium">{t(RELATION_NAME[m.relation])}</span>
                <span className="text-ink-3">{m.opened !== undefined ? t({ en: `opened ${m.opened} · booked ${m.booked}`, ar: `فُتحت ${m.opened} · حُجز ${m.booked}` }) : ''}</span></div>
              <div className="mt-1 flex gap-3">
                <button className="text-indigo underline" onClick={() => navigator.clipboard?.writeText(m.url)}>{t({ en: 'Copy link', ar: 'انسخ الرابط' })}</button>
                <a className="text-indigo underline" href={`https://wa.me/?text=${encodeURIComponent(m.url)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="text-indigo underline" href={m.url} target="_blank" rel="noreferrer">{t({ en: 'Preview', ar: 'معاينة' })}</a>
              </div>
            </li>
          ))}
        </ul>
      )}
      {made.length > 0 && <p className="mt-3 text-[12px] leading-relaxed text-ink-3">{t({ en: 'Sending from your own WhatsApp shows your number to them. To stay unnamed, post it in a family group, or ask your counsellor to send it.', ar: 'الإرسال من واتساب الخاص بك يُظهر رقمك لهم. لتبقى دون اسم، انشرها في مجموعة العائلة، أو اطلب من مستشارك إرسالها.' })}</p>}
      {made.length > 0 && <button onClick={refresh} className="mt-3 text-[13px] text-ink-2 underline">{t({ en: 'Check who opened them', ar: 'تحقق ممن فتحها' })}</button>}
    </section>
  );
}
