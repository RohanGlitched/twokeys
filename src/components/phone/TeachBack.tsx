'use client';
// Teach-back: three questions after the result, the way counsellors check understanding. A wrong
// answer is explained again and can be tried again; only the first-try score, the language and the
// reading level leave the phone. Options are similar in length so the right one doesn't stand out,
// every wrong option is a real misunderstanding, and their order is shuffled once per comparison.
import { useMemo, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';
import type { L, T } from './PhoneApp';

interface Q { q: L; options: L[]; right: number; why: L }

/** Carriers are healthy: true for most genes on the panel. */
const CARRIER: Q = { q: { en: 'Does carrying the change make you ill?', ar: 'هل يجعلك حمل هذا التغيّر مريضاً؟', arF: 'هل يجعلك حمل هذا التغيّر مريضة؟' },
  options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are healthy', ar: 'لا، حامل التغيّر بصحة جيدة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
  why: { en: 'Carriers are healthy. It matters for children with a partner who carries the same gene.', ar: 'حاملو التغيّر بصحة جيدة، ويهم ذلك للأطفال مع شريك يحمل الجين نفسه.' } };
/** Thalassaemia carriers can have mild anaemia, so the plain "carriers are healthy" item would mark a true answer wrong. */
const THAL: Q = { q: { en: 'Can carrying thalassaemia affect your own health?', ar: 'هل يمكن أن يؤثر حمل الثلاسيميا في صحتك أنت؟' },
  options: [{ en: 'Carriers can have mild anaemia that is usually harmless', ar: 'قد يصاب الحامل بفقر دم خفيف غير ضار عادة' }, { en: 'Carriers need regular blood transfusions', ar: 'يحتاج الحامل إلى نقل دم منتظم' }, { en: 'Carrying it turns into thalassaemia later in life', ar: 'يتحول حمل التغيّر إلى ثلاسيميا لاحقاً' }], right: 0,
  why: { en: 'Carriers of thalassaemia can have mild anaemia that is usually harmless. It is not the illness, and it doesn’t turn into it.', ar: 'قد يصاب حاملو الثلاسيميا بفقر دم خفيف غير ضار عادة. وهو ليس المرض، ولا يتحول إليه.' } };

const SHARED: Q[] = [
  { q: { en: 'If you have a child, what is the chance the child has the condition?', ar: 'إذا رُزقتما بطفل، ما احتمال أن يصاب بالحالة؟' },
    options: [{ en: 'Only the first child is at risk', ar: 'الطفل الأول فقط معرّض' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance; 3 in 4 children won’t have it.', ar: 'لكل حمل احتمال 1 من 4، و3 من كل 4 أطفال لن يصابوا.' } },
  CARRIER,
  { q: { en: 'If a first child has the condition, does the chance change next time?', ar: 'إذا أصيب الطفل الأول، هل يتغيّر الاحتمال في الحمل التالي؟' },
    options: [{ en: 'It goes down', ar: 'ينخفض' }, { en: 'It stays 1 in 4', ar: 'يبقى 1 من 4' }, { en: 'It goes up', ar: 'يرتفع' }], right: 1,
    why: { en: 'What happened before doesn’t change it: every pregnancy is 1 in 4.', ar: 'لا يتأثر الاحتمال بما سبق: يبقى 1 من 4 في كل حمل.' } },
];
/** One partner's change is milder: the 1 in 4 child usually has a milder form. */
const MILDER: Q[] = [
  { q: { en: 'If a child inherits both your changes, what is most likely?', ar: 'إذا ورث الطفل تغيّريكما معاً، فما الأرجح؟' },
    options: [{ en: 'A milder form of the condition', ar: 'شكل أخف من الحالة' }, { en: 'The most severe form', ar: 'أشد أشكالها' }, { en: 'A healthy carrier, like you', ar: 'حامل سليم للتغيّر مثلكما' }], right: 0,
    why: { en: 'One of the changes is milder, so a child with both usually has a milder form.', ar: 'أحد التغيّرين أخف، لذا يصاب الطفل الذي يرثهما عادة بشكل أخف.' } },
  { q: { en: 'What is the chance a child inherits both changes?', ar: 'ما احتمال أن يرث الطفل التغيّرين معاً؟' },
    options: [{ en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: 'Only the first child', ar: 'الطفل الأول فقط' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance of both changes.', ar: 'لكل حمل احتمال 1 من 4 أن يرث التغيّرين.' } },
  CARRIER,
];
/** Both changes are milder: at most a mild form. */
const LOW: Q[] = [
  { q: { en: 'If a child inherits both your milder changes, what is most likely?', ar: 'إذا ورث الطفل تغيّريكما الأخفين معاً، فما الأرجح؟' },
    options: [{ en: 'A mild form at most, often nothing', ar: 'شكل خفيف على الأكثر، وغالباً لا شيء' }, { en: 'The serious form, as with a full match', ar: 'الشكل الخطير، كما في التطابق الكامل' }, { en: 'It depends only on whether you are related', ar: 'يعتمد ذلك على القرابة بينكما فقط' }], right: 0,
    why: { en: 'Two milder changes together cause at most a mild form, and often no problems.', ar: 'يسبب تغيّران أخفان معاً شكلاً خفيفاً على الأكثر، وغالباً لا مشكلات.' } },
  { q: { en: 'What is the chance a child inherits both changes?', ar: 'ما احتمال أن يرث الطفل التغيّرين معاً؟' },
    options: [{ en: '1 in 2 each time', ar: '1 من 2 في كل مرة' }, { en: '1 in 4 each time', ar: '1 من 4 في كل مرة' }, { en: 'Only the first child', ar: 'الطفل الأول فقط' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance of both changes.', ar: 'لكل حمل احتمال 1 من 4 أن يرث التغيّرين.' } },
  CARRIER,
];
const XL: Q[] = [
  { q: { en: 'For each son, what is the chance of having the condition?', ar: 'لكل ابن، ما احتمال أن يصاب بالحالة؟' },
    options: [{ en: '1 in 4', ar: '1 من 4' }, { en: '1 in 2', ar: '1 من 2' }, { en: 'None', ar: 'لا احتمال' }], right: 1,
    why: { en: 'Each son gets his X from his mother: a 1 in 2 chance it is the changed one.', ar: 'يرث كل ابن الكروموسوم X من أمه: احتمال 1 من 2 أن يكون هو المتغير.' } },
  { q: { en: 'Could a daughter be free of the change?', ar: 'هل يمكن أن تخلو ابنة من التغيّر؟' },
    options: [{ en: 'Yes, about half of them', ar: 'نعم، نحو نصفهن' }, { en: 'No, never', ar: 'لا، أبداً' }, { en: 'Only if she is the eldest', ar: 'فقط إن كانت الكبرى' }], right: 1,
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
    options: [{ en: 'Yes, mildly', ar: 'نعم، قليلاً' }, { en: 'No, carriers are usually healthy', ar: 'لا، حامل التغيّر بصحة جيدة عادة' }, { en: 'Not yet, but it can turn into the illness later', ar: 'ليس الآن، لكنه قد يتحول إلى المرض لاحقاً' }], right: 1,
    why: { en: 'Carriers are usually healthy; for a few genes, such as thalassaemia, a carrier can have mild, harmless signs.', ar: 'حاملو التغيّر بصحة جيدة عادة؛ وفي جينات قليلة، مثل الثلاسيميا، قد تظهر على الحامل علامات خفيفة غير ضارة.' } },
  { q: { en: 'Could your brothers, sisters or cousins carry the same changes you carry?', ar: 'هل يمكن أن يحمل إخوتك أو أبناء عمومتك التغيّرات نفسها التي تحملها؟', arF: 'هل يمكن أن يحمل إخوتك أو أبناء عمومتك التغيّرات نفسها التي تحملينها؟' },
    options: [{ en: 'Yes, they could', ar: 'نعم، يمكن' }, { en: 'No, never', ar: 'لا، أبداً' }, { en: 'Only if they are unwell', ar: 'فقط إن كانوا مرضى' }], right: 0,
    why: { en: 'Relatives can share the same changes; a brother or sister has about a 1 in 2 chance.', ar: 'قد يتشارك الأقارب التغيّرات نفسها، وللأخ أو الأخت احتمال يقارب 1 من 2.' } },
];

/** A small seeded shuffle (FNV-1a into mulberry32), so the order is stable for one comparison and differs between them. */
function order(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => { h = (h + 0x6D2B79F5) | 0; let x = Math.imul(h ^ (h >>> 15), 1 | h); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function TeachBack({ lang, t, level, kind, identity, onCounsellor, thal, seed }: {
  lang: Locale; t: T; level: Level; kind: 'shared' | 'milder' | 'low' | 'xl' | 'none'; identity: string | null; onCounsellor: () => void;
  /** A thalassaemia gene is shared (HBB or HBA): ask about carriers' mild anaemia instead. */
  thal?: boolean;
  seed: string;
}) {
  const qs = { shared: SHARED, milder: MILDER, low: LOW, xl: XL, none: NONE }[kind].map((q) => (thal && q === CARRIER ? THAL : q));
  // Shown order per question, as indexes into its options; answers are stored as the original index.
  const shown = useMemo(() => qs.map((q, i) => order(`${seed}:${kind}:${i}`, q.options.length)), [seed, kind, qs.length]); // eslint-disable-line react-hooks/exhaustive-deps
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
                {shown[i].map((j) => (
                  <button key={j} role="radio" aria-checked={a === j} disabled={right && a !== j} onClick={() => choose(i, j)}
                    className={`min-h-11 rounded-[2px] border px-3 py-2 text-start text-[13px] ${a === j ? (right ? 'border-sage bg-sage text-wool' : 'border-alert text-alert') : 'border-ink-3'} disabled:opacity-50`}>{t(q.options[j])}</button>
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
        <button onClick={onCounsellor} className="mt-2 min-h-11 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Go over it with a genetic counsellor', ar: 'راجعه مع مرشد وراثي', arF: 'راجعيه مع مرشد وراثي' })}</button>
      )}
    </section>
  );
}
