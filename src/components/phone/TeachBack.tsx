'use client';
// Teach-back: three questions after the result, the way counsellors check understanding. A wrong
// answer is explained again and can be tried again; only the first-try score, the language and the
// reading level leave the phone.
import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';
import type { L, T } from './PhoneApp';
interface Q { q: L; options: L[]; right: number; why: L }

const SHARED: Q[] = [
  { q: { en: 'If you have a child, will the child definitely have the condition?', ar: 'إذا رُزقتما بطفل، هل سيصاب بالحالة حتماً؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No: 1 in 4 in each pregnancy', ar: 'لا: 1 من 4 في كل حمل' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance; 3 in 4 children won’t have it.', ar: 'لكل حمل احتمال 1 من 4، و3 من كل 4 أطفال لن يصابوا.' } },
  { q: { en: 'Does being a carrier make you ill?', ar: 'هل تكون مريضاً لأنك تحمل تغيّراً جينياً؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No', ar: 'لا' }], right: 1,
    why: { en: 'Carriers are healthy. It matters only for children with a partner who carries the same gene.', ar: 'من يحملون التغيّر أصحاء، ولا يهم ذلك إلا للأطفال مع شريك يحمل الجين نفسه.' } },
  { q: { en: 'If a first child is affected, is the next pregnancy safer?', ar: 'إذا أصيب الطفل الأول، هل يكون الحمل التالي أكثر أماناً؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No: it is 1 in 4 again', ar: 'لا: إنه 1 من 4 من جديد' }], right: 1,
    why: { en: 'Chance has no memory: every pregnancy is a new 1 in 4.', ar: 'الاحتمال لا يتذكر: كل حمل هو 1 من 4 من جديد.' } },
];
const NONE: Q[] = [
  { q: { en: 'Does this result rule out every inherited condition?', ar: 'هل تستبعد هذه النتيجة كل الحالات الوراثية؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No: it lowers the chance for the conditions tested', ar: 'لا: تخفض احتمال الحالات المفحوصة' }], right: 1,
    why: { en: 'No test covers everything; this one lowers the chance for the conditions it tested.', ar: 'لا يغطي أي فحص كل شيء، وهذا يخفض احتمال الحالات التي فحصها.' } },
  { q: { en: 'If you carry a gene, are you ill?', ar: 'إذا كنت تحمل جيناً، هل أنت مريض؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No', ar: 'لا' }], right: 1,
    why: { en: 'Carriers are healthy.', ar: 'من يحملون التغيّرات الجينية أصحاء.' } },
  { q: { en: 'Could your brothers, sisters or cousins carry genes you carry?', ar: 'هل قد يحمل إخوتك أو أبناء عمومتك جينات تحملها؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No', ar: 'لا' }], right: 0,
    why: { en: 'Relatives can share the same changes; a sibling has about a 1 in 2 chance.', ar: 'قد يتشارك الأقارب التغيّرات نفسها؛ وللأخ احتمال يقارب 1 من 2.' } },
];

export function TeachBack({ lang, t, level, kind, identity, onCounsellor }: {
  lang: Locale; t: T; level: Level; kind: 'shared' | 'none'; identity: string | null; onCounsellor: () => void;
}) {
  const qs = kind === 'shared' ? SHARED : NONE;
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
          return (
            <li key={i}>
              <p className="text-[14px] font-medium">{t(q.q)}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {q.options.map((o, j) => (
                  <button key={j} aria-pressed={a === j} disabled={right && a !== j} onClick={() => choose(i, j)}
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
            : t({ en: `All three right now (${firstRight} of 3 first time). A counsellor can go over anything that still feels unclear.`, ar: `الإجابات الثلاث صحيحة الآن (${firstRight} من 3 من المحاولة الأولى). ويمكن للمستشار مراجعة ما لا يزال غير واضح.` })}
        </p>
      )}
      {answered && allRight && firstRight < 3 && (
        <button onClick={onCounsellor} className="mt-2 text-[14px] font-medium text-indigo underline underline-offset-4">{t({ en: 'Go over it with a counsellor', ar: 'راجعه مع مستشار', arF: 'راجعيه مع مستشار' })}</button>
      )}
    </section>
  );
}
