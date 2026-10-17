'use client';
// Teach-back: three questions after the result, the way counsellors check understanding. A wrong
// answer is explained again and can be tried again; only the first-try score, the language and the
// reading level leave the phone. Options are similar in length so the right one doesn't stand out.
import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';
import type { L, T } from './PhoneApp';

interface Q { q: L; options: L[]; right: number; why: L }

const SHARED: Q[] = [
  { q: { en: 'If you have a child, what is the chance the child has the condition?', ar: 'إذا رُزقتما بطفل، ما احتمال أن يصاب بالحالة؟' },
    options: [{ en: 'Only the first child is at risk', ar: 'الطفل الأول فقط معرّض' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance; 3 in 4 children won’t have it.', ar: 'لكل حمل احتمال 1 من 4، و3 من كل 4 أطفال لن يصابوا.' } },
  { q: { en: 'Does carrying the change make you ill?', ar: 'هل يجعلك حمل هذا التغيّر مريضاً؟', arF: 'هل يجعلك حمل هذا التغيّر مريضة؟' },
    options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are healthy', ar: 'لا، حامل التغيّر بصحة جيدة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
    why: { en: 'Carriers are healthy. It matters for children with a partner who carries the same gene.', ar: 'حاملو التغيّر بصحة جيدة، ويهم ذلك للأطفال مع شريك يحمل الجين نفسه.' } },
  { q: { en: 'If a first child has the condition, does the chance change next time?', ar: 'إذا أصيب الطفل الأول، هل يتغيّر الاحتمال في الحمل التالي؟' },
    options: [{ en: 'It goes down', ar: 'ينخفض' }, { en: 'It stays 1 in 4', ar: 'يبقى 1 من 4' }, { en: 'It goes up', ar: 'يرتفع' }], right: 1,
    why: { en: 'What happened before doesn’t change it: every pregnancy is 1 in 4.', ar: 'لا يتأثر الاحتمال بما سبق: يبقى 1 من 4 في كل حمل.' } },
];
/** One partner's change is milder: the 1 in 4 child usually has a milder form. */
const MILDER: Q[] = [
  { q: { en: 'If a child inherits both your changes, what is most likely?', ar: 'إذا ورث الطفل تغيّريكما معاً، فما الأرجح؟' },
    options: [{ en: 'A milder form of the condition', ar: 'شكل أخف من الحالة' }, { en: 'The most severe form', ar: 'أشد أشكالها' }, { en: 'No effect at all, ever', ar: 'لا أثر أبداً' }], right: 0,
    why: { en: 'One of the changes is milder, so a child with both usually has a milder form.', ar: 'أحد التغيّرين أخف، لذا يصاب الطفل الذي يرثهما عادة بشكل أخف.' } },
  { q: { en: 'What is the chance a child inherits both changes?', ar: 'ما احتمال أن يرث الطفل التغيّرين معاً؟' },
    options: [{ en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: 'Only the first child', ar: 'الطفل الأول فقط' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance of both changes.', ar: 'لكل حمل احتمال 1 من 4 أن يرث التغيّرين.' } },
  { q: { en: 'Does carrying the change make you ill?', ar: 'هل يجعلك حمل هذا التغيّر مريضاً؟', arF: 'هل يجعلك حمل هذا التغيّر مريضة؟' },
    options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are healthy', ar: 'لا، حامل التغيّر بصحة جيدة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
    why: { en: 'Carriers are healthy. It matters for children with a partner who carries the same gene.', ar: 'حاملو التغيّر بصحة جيدة، ويهم ذلك للأطفال مع شريك يحمل الجين نفسه.' } },
];
/** Both changes are milder: at most a mild form. */
const LOW: Q[] = [
  { q: { en: 'If a child inherits both your milder changes, what is most likely?', ar: 'إذا ورث الطفل تغيّريكما الأخفين معاً، فما الأرجح؟' },
    options: [{ en: 'A mild form at most, often nothing', ar: 'شكل خفيف على الأكثر، وغالباً لا شيء' }, { en: 'The most severe form', ar: 'أشد أشكالها' }, { en: 'A serious illness in every child', ar: 'مرض خطير لدى كل طفل' }], right: 0,
    why: { en: 'Two milder changes together cause at most a mild form, and often no problems.', ar: 'يسبب تغيّران أخفان معاً شكلاً خفيفاً على الأكثر، وغالباً لا مشكلات.' } },
  { q: { en: 'What is the chance a child inherits both changes?', ar: 'ما احتمال أن يرث الطفل التغيّرين معاً؟' },
    options: [{ en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: 'Only the first child', ar: 'الطفل الأول فقط' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance of both changes.', ar: 'لكل حمل احتمال 1 من 4 أن يرث التغيّرين.' } },
  { q: { en: 'Does carrying the change make you ill?', ar: 'هل يجعلك حمل هذا التغيّر مريضاً؟', arF: 'هل يجعلك حمل هذا التغيّر مريضة؟' },
    options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are healthy', ar: 'لا، حامل التغيّر بصحة جيدة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
    why: { en: 'Carriers are healthy. It matters for children with a partner who carries the same gene.', ar: 'حاملو التغيّر بصحة جيدة، ويهم ذلك للأطفال مع شريك يحمل الجين نفسه.' } },
];
const XL: Q[] = [
  { q: { en: 'For each son, what is the chance of having the condition?', ar: 'لكل ابن، ما احتمال أن يصاب بالحالة؟' },
    options: [{ en: '1 in 4', ar: '1 من 4' }, { en: '1 in 2', ar: '1 من 2' }, { en: 'None', ar: 'لا احتمال' }], right: 1,
    why: { en: 'Each son gets his X from his mother: a 1 in 2 chance it is the changed one.', ar: 'يرث كل ابن الكروموسوم X من أمه: احتمال 1 من 2 أن يكون هو المتغير.' } },
  { q: { en: 'Could a daughter be free of the change?', ar: 'هل يمكن أن تخلو ابنة من التغيّر؟' },
    options: [{ en: 'Yes, often', ar: 'نعم، غالباً' }, { en: 'No, never', ar: 'لا، أبداً' }, { en: 'Only the first', ar: 'الأولى فقط' }], right: 1,
    why: { en: 'Every daughter gets her father’s X, which carries the change, so each daughter is either affected or a carrier.', ar: 'ترث كل ابنة الكروموسوم X من أبيها وهو يحمل التغيّر، فتكون كل ابنة مصابة أو حاملة للتغيّر.' } },
  { q: { en: 'Does the chance change from one pregnancy to the next?', ar: 'هل يتغيّر الاحتمال من حمل إلى آخر؟' },
    options: [{ en: 'It goes down', ar: 'ينخفض' }, { en: 'It stays the same', ar: 'يبقى كما هو' }, { en: 'It goes up', ar: 'يرتفع' }], right: 1,
    why: { en: 'Each pregnancy starts again with the same chances.', ar: 'يبدأ كل حمل من جديد بالاحتمالات نفسها.' } },
];
const NONE: Q[] = [
  { q: { en: 'Does this result rule out every inherited condition?', ar: 'هل تستبعد هذه النتيجة كل الحالات الوراثية؟' },
    options: [{ en: 'Yes, our children will be healthy', ar: 'نعم، سيكون أطفالنا بصحة جيدة' }, { en: 'No, it lowers the chance of the ones tested', ar: 'لا، تخفض احتمال ما فُحص' }, { en: 'Yes, unless we are related', ar: 'نعم، إلا إذا كنا أقارب' }], right: 1,
    why: { en: 'No test covers everything; this one lowers the chance for the conditions it tested.', ar: 'لا يغطي أي فحص كل شيء، وهذا يخفض احتمال الحالات التي فحصها.' } },
  { q: { en: 'If you carry a change in a gene, are you ill?', ar: 'إذا كنت تحمل تغيّراً في جين، هل أنت مريض؟', arF: 'إذا كنتِ تحملين تغيّراً في جين، هل أنتِ مريضة؟' },
    options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are healthy', ar: 'لا، حامل التغيّر بصحة جيدة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
    why: { en: 'Carriers are healthy.', ar: 'حاملو التغيّر بصحة جيدة.' } },
  { q: { en: 'Could your brothers, sisters or cousins carry the same changes you carry?', ar: 'هل يمكن أن يحمل إخوتك أو أبناء عمومتك التغيّرات نفسها التي تحملها؟', arF: 'هل يمكن أن يحمل إخوتك أو أبناء عمومتك التغيّرات نفسها التي تحملينها؟' },
    options: [{ en: 'Yes, they could', ar: 'نعم، يمكن' }, { en: 'No, never', ar: 'لا، أبداً' }, { en: 'Only cousins', ar: 'أبناء العم فقط' }], right: 0,
    why: { en: 'Relatives can share the same changes; a brother or sister has about a 1 in 2 chance.', ar: 'قد يتشارك الأقارب التغيّرات نفسها، وللأخ أو الأخت احتمال يقارب 1 من 2.' } },
];

export function TeachBack({ lang, t, level, kind, identity, onCounsellor }: {
  lang: Locale; t: T; level: Level; kind: 'shared' | 'milder' | 'low' | 'xl' | 'none'; identity: string | null; onCounsellor: () => void;
}) {
  const qs = { shared: SHARED, milder: MILDER, low: LOW, xl: XL, none: NONE }[kind];
  const [first, setFirst] = useState<(number | null)[]>([null, null, null]);
  const [now, setNow] = useState<(number | null)[]>([null, null, null]);
  const [sent, setSent] = useState(false);
  const answered = now.every((a) => a !== null);
  const firstRight = first.filter((a, i) => a === qs[i].right).length;
  const allRight = now.every((a, i) => a === qs[i].right);

  const choose = (i: number, j: number) => {
    if (now[i] === qs[i].right) return;
    setNow((a) => a.map((x, k) => (k === i ? j : x)));
    if (first[i] !== null) return;
    const nextFirst = first.map((x, k) => (k === i ? j : x));
    setFirst(nextFirst);
    if (!sent && identity && nextFirst.every((a) => a !== null)) {
      setSent(true);
      const correct = nextFirst.filter((a, k) => a === qs[k].right).length;
      fetch('/api/metrics', { method: 'POST', headers: { 'content-type': 'application/json', 'x-person': identity }, body: JSON.stringify({ kind, lang, level, correct }) }).catch(() => {});
    }
  };

  return (
    <section className="mt-8 border-t border-rule pt-5">
      <h3 className="text-[17px] font-semibold">{t({ en: 'Check you’ve got it', ar: 'تأكد أنك فهمت', arF: 'تأكدي أنك فهمتِ' })}</h3>
      <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'Three quick questions. If an answer is off, we explain it again. Only how many you got right first time is counted, without your name.', ar: 'ثلاثة أسئلة سريعة. إن لم تكن الإجابة دقيقة نشرحها من جديد. ولا يُحسب إلا عدد الإجابات الصحيحة من المحاولة الأولى، دون اسمك.' })}</p>
      <ol className="mt-3 space-y-4">
        {qs.map((q, i) => {
          const a = now[i];
          const right = a === q.right;
          const qid = `tb-${kind}-${i}`;
          return (
            <li key={i}>
              <p id={qid} className="text-[14px] font-medium">{t(q.q)}</p>
              <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={qid}>
                {q.options.map((o, j) => (
                  <button key={j} role="radio" aria-checked={a === j} disabled={right && a !== j} onClick={() => choose(i, j)}
                    className={`rounded-[2px] border px-3 py-2 text-[13px] ${a === j ? (right ? 'border-sage bg-sage text-wool' : 'border-madder text-madder') : 'border-ink-3'} disabled:opacity-50`}>{t(o)}</button>
                ))}
              </div>
              {a !== null && (
                <p role="status" className={`mt-1.5 text-[13px] leading-relaxed ${right ? 'text-sage' : 'text-ink'}`}>
                  {right ? t(q.why) : <>{t({ en: 'Not quite. ', ar: 'ليس تماماً. ' })}{t(q.why)} {t({ en: 'Try again.', ar: 'حاول مرة أخرى.', arF: 'حاولي مرة أخرى.' })}</>}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {answered && allRight && (
        <p className="mt-4 text-[14px]">
          {firstRight === 3
            ? t({ en: 'All three right first time.', ar: 'الإجابات الثلاث صحيحة من المحاولة الأولى.' })
            : t({ en: `All three right now (${firstRight} of 3 first time). A genetic counsellor can go over anything that still feels unclear.`, ar: `الإجابات الثلاث صحيحة الآن (${firstRight} من 3 من المحاولة الأولى). ويمكن للمرشد الوراثي مراجعة ما لا يزال غير واضح.` })}
        </p>
      )}
      {answered && allRight && firstRight < 3 && (
        <button onClick={onCounsellor} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Go over it with a genetic counsellor', ar: 'راجعه مع مرشد وراثي', arF: 'راجعيه مع مرشد وراثي' })}</button>
      )}
    </section>
  );
}
