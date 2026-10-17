'use client';
// The follow-on screens after a couple result: options, a genetic counsellor, questions, and family.
// `ar` addresses a man (partner: a woman); `arF` addresses a woman (partner: a man).
import { useState, type ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';
import { letterFor, per100, RELATIONS, sealLetter, type Relation } from '@/lib/letters';
import { RELATION_NAME } from '@/components/family/LetterView';
import type { L, T } from './PhoneApp';

function Back({ lang, onBack }: { lang: Locale; onBack: () => void }) {
  return <button onClick={onBack} className="text-[14px] text-ink-2"><span aria-hidden>{lang === 'ar' ? '→ ' : '← '}</span>{lang === 'ar' ? 'رجوع' : 'Back'}</button>;
}
const Heading = ({ id, children }: { id: string; children: ReactNode }) => <h2 id={id} tabIndex={-1} className="mt-3 text-[24px] font-semibold tracking-tight outline-none">{children}</h2>;

/** Emergency numbers: 999 police/emergency, 998 ambulance, 800 4673 (800 HOPE) UAE Mental Support Line. */
export const HELP: L = {
  en: 'Emergency: 999. Ambulance: 998. To talk to someone now: UAE Mental Support Line 800 4673 (800 HOPE).',
  ar: 'الطوارئ: 999. الإسعاف: 998. للتحدث مع أحد الآن: خط الدعم النفسي في الإمارات 800 4673 (800 HOPE).',
};

// ---------------------------------------------------------------- options

const OPTIONS: { title: L; body: L }[] = [
  { title: { en: 'Go ahead with no changes', ar: 'المضي دون تغيير' },
    body: { en: 'Newborn screening and early care make a real difference for several of these conditions.', ar: 'يُحدث فحص حديثي الولادة والرعاية المبكرة فرقاً حقيقياً في عدد من هذه الحالات.' } },
  { title: { en: 'Testing during pregnancy', ar: 'الفحص أثناء الحمل' },
    body: { en: 'A test in early pregnancy can show whether the baby has the condition. It is done only with the mother’s consent, and a genetic counsellor explains every choice a result opens, including what UAE law allows and its time limits.', ar: 'يمكن لفحص في بداية الحمل أن يبيّن إن كان الجنين مصاباً. ولا يُجرى إلا بموافقة الأم، ويشرح المرشد الوراثي كل خيار تفتحه النتيجة، بما في ذلك ما يسمح به القانون في الإمارات ومهله الزمنية.' } },
  { title: { en: 'IVF with embryo testing (PGT-M)', ar: 'أطفال الأنابيب مع فحص الأجنة (PGT-M)' },
    body: { en: 'Embryos are tested before transfer and an unaffected one is chosen. In Abu Dhabi, Thiqa (the plan for UAE nationals) covers it with prior approval for couples who carry the same gene; other plans vary.', ar: 'تُفحص الأجنة قبل نقلها ويُختار جنين غير مصاب. وفي أبوظبي يغطيه برنامج ثقة (تأمين المواطنين) بموافقة مسبقة للأزواج الذين يحمل كلاهما الجين نفسه، وتختلف الخطط الأخرى.' } },
  { title: { en: 'Reconsider your plans together', ar: 'إعادة النظر في خططكما معاً' },
    body: { en: 'Some couples take time to think about what this means for them before making any plans. The law does not stop any couple from marrying.', ar: 'يأخذ بعض الأزواج وقتاً للتفكير فيما يعنيه هذا لهما قبل أي خطط. ولا يمنع القانون أي زوجين من الزواج.' } },
  { title: { en: 'Kafala or fostering, or no children', ar: 'الكفالة أو الرعاية، أو عدم الإنجاب' },
    body: { en: 'Some couples build a family through kafala or fostering, and some choose not to have children. These are choices too.', ar: 'يكوّن بعض الأزواج أسرة عبر الكفالة أو الرعاية، ويختار بعضهم عدم الإنجاب. وهذه خيارات أيضاً.' } },
  { title: { en: 'Talk it through first', ar: 'التحدث أولاً' },
    body: { en: 'A genetic counsellor can explain each option, arrange confirmatory tests, and meet you as a couple. They will not decide for you.', ar: 'يمكن للمرشد الوراثي شرح كل خيار وترتيب الفحوص التأكيدية ولقاؤكما معاً. ولن يقرر عنكما.' } },
];

export function Options({ lang, t, onBack, onCounsellor, headingId }: { lang: Locale; t: T; onBack: () => void; onCounsellor: () => void; headingId: string }) {
  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <Heading id={headingId}>{t({ en: 'Your options', ar: 'خياراتكما' })}</Heading>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'In no particular order. No option is right for everyone, and you can take your time.', ar: 'بلا ترتيب معيّن. لا يوجد خيار صحيح للجميع، ولكما أن تأخذا وقتكما.' })}</p>
      <ul className="mt-4 grid gap-3">
        {OPTIONS.map((o) => (
          <li key={o.title.en} className="rounded-[3px] border border-ink bg-paper px-4 py-3.5">
            <h3 className="text-[16px] font-semibold">{t(o.title)}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t(o.body)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{t({ en: 'For questions of faith, a scholar you trust can help.', ar: 'وللمسائل الشرعية يمكن لعالِم تثقان به أن يساعد.' })}</p>
      <button onClick={onCounsellor} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">{t({ en: 'Talk to a genetic counsellor', ar: 'تحدّث إلى مرشد وراثي', arF: 'تحدّثي إلى مرشد وراثي' })}</button>
    </section>
  );
}

// ---------------------------------------------------------------- counsellor

interface Booking { id: string; dueBy: number; priority: 'urgent' | 'pregnant' | 'routine'; consentVersion: string; sharedGenes?: string[] }

export function Counsellor({ lang, t, identity, urgent, onBack, pairing, role, genes, personalGenes, level, related, headingId }: {
  lang: Locale; t: T; identity: string; urgent: boolean; onBack: () => void; pairing: string | null; role: 'A' | 'B' | null; genes: string[]; personalGenes: string[]; level: Level; related: boolean; headingId: string;
}) {
  const [own, setOwn] = useState(personalGenes.length > 0);
  const [rel, setRel] = useState(related);
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [booked, setBooked] = useState<Booking | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = lang === 'ar' ? 'ar-AE' : 'en-GB';
  const priority = urgent ? 'urgent' : pregnant ? 'pregnant' : 'routine';

  const book = async () => {
    setBusy(true); setError(null);
    // The shared genes are worked out by the lab from the pairing, not taken from this phone.
    const r = await fetch('/api/desk/cases', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity },
      body: JSON.stringify({ pairing, role, consent: { ownResults: own, relationship: rel }, language: lang, readingLevel: level, priority, question }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setBooked(j); else setError(j.error ?? t({ en: 'Booking failed. Try again.', ar: 'تعذّر الحجز. حاول مرة أخرى.', arF: 'تعذّر الحجز. حاولي مرة أخرى.' }));
  };
  const withdraw = async () => {
    if (!booked) return;
    const r = await fetch(`/api/desk/cases/${booked.id}`, { method: 'DELETE', headers: { 'x-person': identity } });
    if (r.ok) setWithdrawn(true);
  };
  const when = (ms: number) => new Date(ms).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  const shown = booked?.sharedGenes ?? genes;

  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <Heading id={headingId}>
        {urgent ? t({ en: 'A genetic counsellor will call you today', ar: 'سيتصل بك مرشد وراثي اليوم' }) : t({ en: 'Talk to a genetic counsellor', ar: 'تحدّث إلى مرشد وراثي', arF: 'تحدّثي إلى مرشد وراثي' })}
      </Heading>
      {urgent && !booked && (
        <div className="mt-2 border-s-4 border-madder bg-paper px-3 py-2 text-[14px] leading-relaxed">
          <p>{t({ en: 'If you might hurt yourself, call 999 now (998 for an ambulance) or go to the nearest emergency department.', ar: 'إن كنت قد تؤذي نفسك فاتصل بـ999 الآن (998 للإسعاف) أو توجّه إلى أقرب قسم طوارئ.', arF: 'إن كنتِ قد تؤذين نفسك فاتصلي بـ999 الآن (998 للإسعاف) أو توجّهي إلى أقرب قسم طوارئ.' })}</p>
          <p className="mt-1">{t(HELP)}</p>
          <p className="mt-1 text-ink-2">{t({ en: 'Booking here puts you at the top of the genetic counsellors’ list.', ar: 'والحجز هنا يضعك في أعلى قائمة المرشدين الوراثيين.' })}</p>
        </div>
      )}

      {withdrawn ? (
        <p className="mt-4 text-[15px] leading-relaxed">{t({ en: 'Consent withdrawn. Your genes, results, question and relationship were erased from the desk, and the counsellor’s notes were sealed. The audit trail keeps only that a case existed, when it was booked and withdrawn, and who viewed it.', ar: 'سُحبت الموافقة. مُسحت جيناتك ونتائجك وسؤالك والقرابة من المكتب، وخُتمت ملاحظات المرشد. ولا يحتفظ سجل التدقيق إلا بأن حالة وُجدت، ومتى حُجزت وسُحبت، ومن اطّلع عليها.' })}</p>
      ) : booked ? (
        <div className="mt-4">
          <p className="text-[18px] font-semibold">{t({ en: 'Booked.', ar: 'تم الحجز.' })}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            {t({ en: `A genetic counsellor will contact you in the app by ${when(booked.dueBy)}.`, ar: `سيتواصل معك مرشد وراثي عبر التطبيق قبل ${when(booked.dueBy)}.` })}
          </p>
          <dl className="mt-4 divide-y divide-rule border-y border-rule text-[13px]">
            <Row k={t({ en: 'Case', ar: 'الحالة' })} v={<bdi dir="ltr" className="font-mono">{booked.id}</bdi>} />
            <Row k={t({ en: 'You shared', ar: 'ما شاركته', arF: 'ما شاركتِه' })} v={[
              shown.length ? t({ en: `shared genes (${shown.join(', ')})`, ar: `الجينات المشتركة (${shown.join('، ')})` }) : t({ en: 'that you share no gene', ar: 'أنكما لا تشتركان في جين' }),
              own ? t({ en: 'your own results', ar: 'نتائجك الخاصة' }) : null,
              rel ? t({ en: 'that you are related', ar: 'أن بينكما قرابة' }) : null,
              question.trim() ? t({ en: 'your question', ar: 'سؤالك' }) : null,
            ].filter(Boolean).join(lang === 'ar' ? '، ' : ', ')} />
            <Row k={t({ en: 'Priority', ar: 'الأولوية' })} v={t({ urgent: { en: 'today, within 4 hours', ar: 'اليوم، خلال 4 ساعات' }, pregnant: { en: 'within 1 working day (pregnancy)', ar: 'خلال يوم عمل واحد (حمل)' }, routine: { en: 'within 2 working days', ar: 'خلال يومَي عمل' } }[booked.priority])} />
            <Row k={t({ en: 'Consent', ar: 'الموافقة' })} v={<bdi dir="ltr" className="font-mono">{booked.consentVersion}</bdi>} />
          </dl>
          <button onClick={withdraw} className="mt-4 text-[14px] font-medium text-madder underline underline-offset-4">{t({ en: 'Withdraw consent and erase what I shared', ar: 'اسحب الموافقة وامسح ما شاركته', arF: 'اسحبي الموافقة وامسحي ما شاركتِه' })}</button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Choose exactly what the counsellor may see. Nothing else leaves this phone.', ar: 'اختر بالضبط ما يمكن للمرشد رؤيته. ولا يخرج شيء آخر من هذا الهاتف.', arF: 'اختاري بالضبط ما يمكن للمرشد رؤيته. ولا يخرج شيء آخر من هذا الهاتف.' })}</p>
          <fieldset className="mt-4 divide-y divide-rule border-y border-rule">
            <legend className="sr-only">{t({ en: 'What the counsellor may see', ar: 'ما يمكن للمرشد رؤيته' })}</legend>
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked disabled className="mt-1" />
              <span><span className="font-medium">{t({ en: 'The genes we both carry', ar: 'الجينات التي نحملها معاً' })}</span><br />
                <span className="text-ink-2">{genes.length ? genes.join(', ') : t({ en: 'none in common', ar: 'لا جين مشتركاً' })}{t({ en: ' (confirmed by the lab; needed to book)', ar: ' (يؤكدها المختبر؛ لازمة للحجز)' })}</span></span></label>
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} className="mt-1" />
              <span><span className="font-medium">{t({ en: 'My own full results', ar: 'نتائجي الكاملة' })}</span><br /><span className="text-ink-2">{t({ en: 'Only you and the counsellor, never your partner.', ar: 'أنت والمرشد فقط، ولا تراها شريكتك أبداً.', arF: 'أنتِ والمرشد فقط، ولا يراها شريكك أبداً.' })}</span></span></label>
            <label className="flex gap-3 py-3 text-[14px]"><input type="checkbox" checked={rel} onChange={(e) => setRel(e.target.checked)} className="mt-1" />
              <span><span className="font-medium">{t({ en: 'That we are related', ar: 'أن بيننا قرابة' })}</span><br /><span className="text-ink-2">{t({ en: 'Helps the counsellor explain your chances.', ar: 'يساعد المرشد على شرح الاحتمالات.' })}</span></span></label>
          </fieldset>

          {!urgent && (
            <fieldset className="mt-4 text-[14px]">
              <legend className="font-medium">{t({ en: 'Is there a pregnancy now?', ar: 'هل يوجد حمل الآن؟' })}</legend>
              <p className="text-[13px] text-ink-2">{t({ en: 'If yes, a counsellor contacts you within one working day, because some tests have time limits.', ar: 'إن كان الجواب نعم يتواصل معك مرشد خلال يوم عمل واحد، لأن لبعض الفحوص مهلاً زمنية.' })}</p>
              <div className="mt-2 flex gap-2" role="radiogroup">
                {[{ v: true, l: { en: 'Yes', ar: 'نعم' } }, { v: false, l: { en: 'No', ar: 'لا' } }].map((o) => (
                  <button key={String(o.v)} role="radio" aria-checked={pregnant === o.v} onClick={() => setPregnant(o.v)}
                    className={`rounded-[2px] border px-4 py-2 ${pregnant === o.v ? 'border-ink bg-ink text-wool' : 'border-ink-3'}`}>{t(o.l)}</button>
                ))}
              </div>
            </fieldset>
          )}

          <label className="mt-4 block text-[14px] font-medium" htmlFor="cq">{t({ en: 'Anything you want the counsellor to know (optional)', ar: 'أي شيء تريد أن يعرفه المرشد (اختياري)', arF: 'أي شيء تريدين أن يعرفه المرشد (اختياري)' })}</label>
          <textarea id="cq" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} rows={3}
            className="mt-1 w-full rounded-[2px] border border-ink bg-paper px-3 py-2 text-[15px]" />

          <details className="mt-4 text-[13px] leading-relaxed text-ink-2">
            <summary className="cursor-pointer font-medium text-ink">{t({ en: 'What you are agreeing to', ar: 'ما توافق عليه', arF: 'ما توافقين عليه' })}</summary>
            <ul className="mt-2 list-disc space-y-1 ps-5">
              <li>{t({ en: 'Purpose: so a genetic counsellor can explain your result and options. Nothing is used for anything else.', ar: 'الغرض: أن يشرح مرشد وراثي نتيجتك وخياراتك، ولا يُستخدم شيء لغير ذلك.' })}</li>
              <li>{t({ en: 'Who sees it: the counsellors at your screening centre. Every view is logged, and you can ask for that log.', ar: 'من يراها: المرشدون في مركز الفحص. وكل اطلاع مسجَّل، ويمكنك طلب هذا السجل.' })}</li>
              <li>{t({ en: 'Your partner: if you booked from a pairing, the case is linked to it so the counsellor can see you together if your partner books too. Your partner never sees what you shared.', ar: 'شريكتك: إن حجزت من اقتران فإن الحالة مرتبطة به ليتمكن المرشد من لقائكما معاً إن حجزت شريكتك أيضاً. ولا ترى شريكتك أبداً ما شاركته.', arF: 'شريكك: إن حجزتِ من اقتران فإن الحالة مرتبطة به ليتمكن المرشد من لقائكما معاً إن حجز شريكك أيضاً. ولا يرى شريكك أبداً ما شاركتِه.' })}</li>
              <li>{t({ en: 'How long: this demo keeps cases for 60 days. In service, records follow health-data retention rules. You can withdraw at any time: what you shared is erased, notes are sealed, and the audit keeps only dates and who viewed the case.', ar: 'المدة: يحتفظ هذا العرض بالحالات 60 يوماً، وفي الخدمة الفعلية تتبع السجلات قواعد الاحتفاظ بالبيانات الصحية. ويمكنك السحب في أي وقت: يُمسح ما شاركته، وتُختم الملاحظات، ولا يحتفظ السجل إلا بالتواريخ ومن اطّلع على الحالة.' })}</li>
              <li>{t({ en: 'Law: UAE Federal Decree-Law 49/2023 on medically assisted reproduction and genetic testing.', ar: 'القانون: المرسوم بقانون اتحادي رقم 49 لسنة 2023.' })}</li>
            </ul>
          </details>
          {error && <p role="alert" className="mt-3 text-[14px] text-madder">{error}</p>}
          <button onClick={book} disabled={busy || (!urgent && pregnant === null)} className="mt-5 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-50">
            {busy ? t({ en: 'Booking…', ar: 'جارٍ الحجز…' }) : urgent ? t({ en: 'Ask a counsellor to call me today', ar: 'اطلب من مرشد الاتصال بي اليوم', arF: 'اطلبي من مرشد الاتصال بي اليوم' }) : t({ en: 'Agree and book a call', ar: 'وافق واحجز مكالمة', arF: 'وافقي واحجزي مكالمة' })}
          </button>
        </>
      )}
    </section>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-4 py-2"><dt className="text-ink-2">{k}</dt><dd className="text-end">{v}</dd></div>;
}

// ---------------------------------------------------------------- ask

interface Turn { role: 'user' | 'assistant'; text: string; cites?: string[]; route?: string; escalate?: boolean; urgent?: boolean }

const STARTERS: L[] = [
  { en: 'What does it mean that we both carry this?', ar: 'ماذا يعني أننا نحمل هذا معاً؟' },
  { en: 'Can our children be healthy?', ar: 'هل يمكن أن يكون أطفالنا أصحاء؟' },
  { en: 'Does being related change anything?', ar: 'هل تغيّر قرابتنا شيئاً؟' },
];

export function Ask({ lang, t, sex, onBack, genes, xl, level, related, onCounsellor, onUrgent, headingId }: {
  lang: Locale; t: T; sex: 'F' | 'M'; onBack: () => void; genes: { gene: string; strength: number }[]; xl: string[]; level: Level; related: boolean; onCounsellor: () => void; onUrgent: () => void; headingId: string;
}) {
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
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, sex, level, genes: genes.map((g) => g.gene), strengths: Object.fromEntries(genes.map((g) => [g.gene, g.strength])), xl, related, question, history }) });
      const j = await r.json();
      setTurns((x) => [...x, r.ok ? { role: 'assistant', text: j.answer, cites: j.cites, route: j.route, escalate: j.escalate, urgent: j.urgent } : { role: 'assistant', text: j.error, escalate: true }]);
    } catch {
      setTurns((x) => [...x, { role: 'assistant', text: t({ en: 'The connection dropped. A genetic counsellor can answer this.', ar: 'انقطع الاتصال. يمكن للمرشد الوراثي الإجابة عن هذا.' }), escalate: true }]);
    } finally { setBusy(false); }
  };
  return (
    <section className="flex flex-col">
      <Back lang={lang} onBack={onBack} />
      <Heading id={headingId}>{t({ en: 'Ask a question', ar: 'اطرح سؤالاً', arF: 'اطرحي سؤالاً' })}</Heading>
      <div className="mt-2 rounded-[3px] border border-rule bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
        <p>{t({ en: 'Answers are written by an AI model from checked medical facts and your result, then checked before you see them. It is information, not medical advice, and it can be wrong: a genetic counsellor has the final word.', ar: 'يكتب الإجاباتِ نموذجُ ذكاء اصطناعي من معلومات طبية موثوقة ومن نتيجتكما، ثم تُفحص قبل أن تراها. هذه معلومات وليست نصيحة طبية، وقد تخطئ، والكلمة الأخيرة للمرشد الوراثي.', arF: 'يكتب الإجاباتِ نموذجُ ذكاء اصطناعي من معلومات طبية موثوقة ومن نتيجتكما، ثم تُفحص قبل أن تريها. هذه معلومات وليست نصيحة طبية، وقد تخطئ، والكلمة الأخيرة للمرشد الوراثي.' })}</p>
        <button onClick={onCounsellor} className="mt-1.5 font-medium text-indigo underline underline-offset-4">{t({ en: 'I’d rather ask a person', ar: 'أفضّل أن أسأل شخصاً' })}</button>
      </div>
      <div className="mt-4 space-y-3" aria-live="polite">
        {turns.map((m, i) => (
          <div key={i}>
            <div data-turn={m.role} className={m.role === 'user' ? 'ms-8 rounded-[3px] bg-ink px-3.5 py-2.5 text-[14px] text-wool' : 'me-4 rounded-[3px] border border-rule bg-paper px-3.5 py-2.5 text-[14px] leading-relaxed'}>
              {m.text}
              {m.cites?.some((c) => c !== 'counsellor') ? <p dir="ltr" className="mt-1.5 font-mono text-[11px] text-ink-2">{m.cites.filter((c) => c !== 'counsellor').join(', ')}</p> : null}
              {m.role === 'assistant' && <ReportProblem t={t} />}
            </div>
            {m.urgent ? (
              <div className="me-4 mt-2 rounded-[3px] border border-madder bg-paper px-3.5 py-3 text-[14px]">
                <p className="font-medium">{t(HELP)}</p>
                <button onClick={onUrgent} className="mt-2 w-full rounded-[2px] bg-madder px-3 py-3 font-medium text-wool">{t({ en: 'Ask a counsellor to call me today', ar: 'اطلب من مرشد الاتصال بي اليوم', arF: 'اطلبي من مرشد الاتصال بي اليوم' })}</button>
              </div>
            ) : m.escalate ? (
              <button onClick={onCounsellor} className="me-4 mt-2 w-full rounded-[2px] border border-ink px-3 py-2.5 text-[14px] font-medium">{t({ en: 'Talk to a genetic counsellor about this', ar: 'تحدّث إلى مرشد وراثي بشأن هذا', arF: 'تحدّثي إلى مرشد وراثي بشأن هذا' })}</button>
            ) : null}
          </div>
        ))}
        {busy && <div className="me-4 h-10 animate-pulse rounded-[3px] bg-wool-2 motion-reduce:animate-none" />}
      </div>
      {!turns.length && (
        <div className="mt-2 flex flex-col gap-2">
          {STARTERS.map((s) => <button key={s.en} onClick={() => send(t(s))} className="rounded-[2px] border border-ink-3 px-3 py-2 text-start text-[14px] hover:border-ink">{t(s)}</button>)}
        </div>
      )}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <label className="sr-only" htmlFor="q">{t({ en: 'Your question', ar: 'سؤالك' })}</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder={t({ en: 'Type your question', ar: 'اكتب سؤالك', arF: 'اكتبي سؤالك' })}
          className="min-w-0 flex-1 rounded-[2px] border border-ink bg-paper px-3 py-3 text-[15px]" />
        <button disabled={busy || !q.trim()} className="rounded-[2px] bg-ink px-4 text-[15px] font-medium text-wool disabled:opacity-50">{t({ en: 'Ask', ar: 'اسأل', arF: 'اسألي' })}</button>
      </form>
    </section>
  );
}

function ReportProblem({ t }: { t: T }) {
  const [sent, setSent] = useState(false);
  return sent
    ? <p className="mt-1.5 text-[12px] text-ink-2">{t({ en: 'Thanks: reported, without your question.', ar: 'شكراً: أُبلغ عنها، دون سؤالك.' })}</p>
    : <button onClick={() => { setSent(true); fetch('/api/monitor', { method: 'POST' }).catch(() => {}); }} className="mt-1.5 text-[12px] text-ink-2 underline underline-offset-2">{t({ en: 'Report a problem with this answer', ar: 'الإبلاغ عن مشكلة في هذه الإجابة' })}</button>;
}

// ---------------------------------------------------------------- family

interface Made { relation: Relation; url: string; id: string; manage: string; read?: number; booked?: number; revoked?: boolean }

export function Family({ lang, t, identity, onBack, genes, headingId }: { lang: Locale; t: T; identity: string; onBack: () => void; genes: { gene: string; inheritance: 'AR' | 'XL' }[]; headingId: string }) {
  const [gene, setGene] = useState(genes[0]?.gene ?? '');
  const [relation, setRelation] = useState<Relation>('sibling');
  const [made, setMade] = useState<Made[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const inheritance = genes.find((g) => g.gene === gene)?.inheritance ?? 'AR';
  const preview = gene ? letterFor(gene, relation, lang, inheritance) : null;
  const create = async () => {
    if (!gene) return;
    const { c, key } = await sealLetter(letterFor(gene, relation, lang, inheritance));
    const r = await fetch('/api/family', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ c }) });
    const j = await r.json();
    if (!r.ok) return;
    setMade((m) => [...m, { relation, id: j.id, manage: j.manage, url: `${window.location.origin}/${lang}/r/${j.id}#${key}` }]);
  };
  const refresh = async () => {
    setMade(await Promise.all(made.map(async (m) => {
      if (m.revoked) return m;
      const r = await fetch(`/api/family/${m.id}`, { headers: { 'x-manage': m.manage } });
      return r.ok ? { ...m, ...(await r.json()) } : m;
    })));
  };
  const revoke = async (m: Made) => {
    const r = await fetch(`/api/family/${m.id}`, { method: 'DELETE', headers: { 'x-manage': m.manage } });
    if (r.ok) setMade((all) => all.map((x) => (x.id === m.id ? { ...x, revoked: true } : x)));
  };
  if (!genes.length) {
    return (
      <section><Back lang={lang} onBack={onBack} />
        <Heading id={headingId}>{t({ en: 'Tell relatives', ar: 'أخبر أقاربك', arF: 'أخبري أقاربك' })}</Heading>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{t({ en: 'You can tell relatives about a gene you know you carry. Open your own results first, or pair with your partner.', ar: 'يمكنك إخبار أقاربك بجين تعرف أنك تحمل تغيّراً فيه. افتح نتائجك أولاً، أو اقترن بشريكتك.', arF: 'يمكنك إخبار أقاربك بجين تعرفين أنك تحملين تغيّراً فيه. افتحي نتائجك أولاً، أو اقترني بشريكك.' })}</p>
      </section>
    );
  }
  return (
    <section>
      <Back lang={lang} onBack={onBack} />
      <Heading id={headingId}>{t({ en: 'Tell relatives, without your name', ar: 'أخبر أقاربك دون ذكر اسمك', arF: 'أخبري أقاربك دون ذكر اسمك' })}</Heading>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Relatives can carry the same change. Each note is sealed on this phone; the service can’t read it and doesn’t record who sent it.', ar: 'قد يحمل الأقارب التغيّر نفسه. تُختم كل رسالة على هذا الهاتف، ولا تستطيع الخدمة قراءتها ولا تسجّل من أرسلها.' })}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <label className="text-[13px] text-ink-2">{t({ en: 'Gene', ar: 'الجين' })}
          <select value={gene} onChange={(e) => setGene(e.target.value)} className="mt-1 w-full rounded-[2px] border border-ink bg-paper px-2 py-2.5 text-[15px] text-ink">
            {genes.map((g) => <option key={g.gene} value={g.gene}>{g.gene}{g.inheritance === 'XL' ? ' (X)' : ''}</option>)}
          </select></label>
        <label className="text-[13px] text-ink-2">{t({ en: 'They are my', ar: 'صلة القرابة' })}
          <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)} className="mt-1 w-full rounded-[2px] border border-ink bg-paper px-2 py-2.5 text-[15px] text-ink">
            {RELATIONS.map((r) => <option key={r} value={r}>{t(RELATION_NAME[r])}</option>)}
          </select></label>
      </div>
      {preview && (
        <p className="mt-3 text-[14px] leading-relaxed">
          {preview.chance === null
            ? t({ en: 'This change is on the X chromosome: female relatives may carry it and male relatives may have the condition. The note explains this; a genetic counsellor works out each relative’s chance.', ar: 'هذا التغيّر على الكروموسوم X: قد تحمله القريبات، وقد يُصاب به الأقارب الذكور. تشرح الرسالة ذلك، ويحسب المرشد الوراثي احتمال كل قريب.' })
            : <>{t({ en: `Their chance of carrying it: ${per100(preview.chance, 'en')}.`, ar: `احتمال أن يكون حاملاً لهذا التغيّر: ${per100(preview.chance, 'ar')}.` })}
              {preview.population !== null && <span className="text-ink-2"> {t({ en: `For anyone in the general population: ${per100(preview.population, 'en')}.`, ar: `ولأي شخص من عامة الناس: ${per100(preview.population, 'ar')}.` })}</span>}</>}
        </p>
      )}
      <button onClick={create} className="mt-4 w-full rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool">{t({ en: 'Make a sealed note', ar: 'أنشئ رسالة مختومة', arF: 'أنشئي رسالة مختومة' })}</button>
      {made.length > 0 && (
        <ul className="mt-5 divide-y divide-rule border-y border-rule text-[13px]">
          {made.map((m) => (
            <li key={m.id} className="py-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{t(RELATION_NAME[m.relation])}</span>
                <span className="text-ink-2">
                  {m.revoked ? t({ en: 'taken back', ar: 'سُحبت' })
                    : m.read !== undefined ? t({ en: `they told you: read ${m.read}, booked a test ${m.booked}`, ar: `قرأها: ${m.read} · حجز فحصاً: ${m.booked}` }) : ''}
                </span>
              </div>
              {!m.revoked && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <button className="text-indigo underline" onClick={() => { navigator.clipboard?.writeText(m.url); setCopied(m.id); setTimeout(() => setCopied(null), 1800); }}>{copied === m.id ? t({ en: 'Copied', ar: 'نُسخ' }) : t({ en: 'Copy link', ar: 'انسخ الرابط', arF: 'انسخي الرابط' })}</button>
                  <a className="text-indigo underline" href={m.url} target="_blank" rel="noreferrer">{t({ en: 'Preview', ar: 'معاينة' })}</a>
                  <button className="text-madder underline" onClick={() => revoke(m)}>{t({ en: 'Take it back', ar: 'اسحب الرسالة', arF: 'اسحبي الرسالة' })}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {made.length > 0 && <p className="mt-3 text-[12px] leading-relaxed text-ink-2">{t({ en: 'Whoever you send it from, they will see who sent the link. To stay unnamed, ask your genetic counsellor to pass it on for you.', ar: 'أياً كانت الوسيلة التي ترسل بها الرابط فسيرى المستلم من أرسله. لتبقى دون اسم، اطلب من المرشد الوراثي أن يوصله عنك.', arF: 'أياً كانت الوسيلة التي ترسلين بها الرابط فسيرى المستلم من أرسله. لتبقي دون اسم، اطلبي من المرشد الوراثي أن يوصله عنك.' })}</p>}
      {made.length > 0 && <button onClick={refresh} className="mt-3 text-[13px] text-ink-2 underline">{t({ en: 'Check what relatives chose to tell me', ar: 'تحقق مما اختار الأقارب إخباري به', arF: 'تحققي مما اختار الأقارب إخباري به' })}</button>}
    </section>
  );
}
