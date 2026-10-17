'use client';
// Teach-back: three questions after the result, the way counsellors check understanding. Only the
// number right, the language and the reading level leave the phone.
import { useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { Level } from '@/lib/conditions';

type L = { en: string; ar: string };
interface Q { q: L; options: L[]; right: number; why: L }

const SHARED: Q[] = [
  { q: { en: 'If you have a child, will the child definitely have the condition?', ar: 'إذا رُزقتما بطفل، هل سيصاب بالحالة حتماً؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No: 1 in 4 in each pregnancy', ar: 'لا: 1 من 4 في كل حمل' }], right: 1,
    why: { en: 'Each pregnancy has a 1 in 4 chance; 3 in 4 children won’t have it.', ar: 'لكل حمل احتمال 1 من 4، و3 من كل 4 أطفال لن يصابوا.' } },
  { q: { en: 'Does being a carrier make you ill?', ar: 'هل يجعلك الحمل الجيني مريضاً؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No', ar: 'لا' }], right: 1,
    why: { en: 'Carriers are healthy. It matters only for children with a partner who carries the same gene.', ar: 'حاملو الجين أصحاء، ولا يهم ذلك إلا للأطفال مع شريك يحمل الجين نفسه.' } },
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
    why: { en: 'Carriers are healthy.', ar: 'حاملو الجينات أصحاء.' } },
  { q: { en: 'Could your brothers, sisters or cousins carry genes you carry?', ar: 'هل قد يحمل إخوتك أو أبناء عمومتك جينات تحملها؟' },
    options: [{ en: 'Yes', ar: 'نعم' }, { en: 'No', ar: 'لا' }], right: 0,
    why: { en: 'Relatives can share the same changes; a sibling has about a 1 in 2 chance.', ar: 'قد يتشارك الأقارب التغيّرات نفسها؛ وللأخ احتمال يقارب 1 من 2.' } },
];

export function TeachBack({ lang, level, kind }: { lang: Locale; level: Level; kind: 'shared' | 'none' }) {
  const t = (l: L) => l[lang];
  const qs = kind === 'shared' ? SHARED : NONE;
  const [ans, setAns] = useState<(number | null)[]>([null, null, null]);
  const [sent, setSent] = useState(false);
  const done = ans.every((a) => a !== null);
  const correct = ans.filter((a, i) => a === qs[i].right).length;
  const submit = async () => {
    setSent(true);
    await fetch('/api/metrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, lang, level, correct }) }).catch(() => {});
  };
  return (
    <section className="mt-8 border-t border-rule pt-5">
      <h3 className="text-[17px] font-semibold">{t({ en: 'Check you’ve got it', ar: 'تأكد أنك فهمت' })}</h3>
      <p className="mt-1 text-[13px] text-ink-3">{t({ en: 'Three quick questions. Only how many you got right is counted, without your name.', ar: 'ثلاثة أسئلة سريعة. لا يُحسب إلا عدد الإجابات الصحيحة، دون اسمك.' })}</p>
      <ol className="mt-3 space-y-4">
        {qs.map((q, i) => (
          <li key={i}>
            <p className="text-[14px] font-medium">{t(q.q)}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {q.options.map((o, j) => {
                const chosen = ans[i] === j;
                const show = sent && chosen;
                return (
                  <button key={j} disabled={sent} aria-pressed={chosen} onClick={() => setAns((a) => a.map((x, k) => (k === i ? j : x)))}
                    className={`rounded-[2px] border px-3 py-2 text-[13px] ${chosen ? 'border-ink bg-ink text-wool' : 'border-rule'} ${show && j !== q.right ? 'line-through' : ''}`}>{t(o)}</button>
                );
              })}
            </div>
            {sent && <p className={`mt-1 text-[13px] ${ans[i] === q.right ? 'text-sage' : 'text-madder'}`}>{t(q.why)}</p>}
          </li>
        ))}
      </ol>
      {!sent ? (
        <button disabled={!done} onClick={submit} className="mt-4 rounded-[2px] border border-ink px-4 py-2.5 text-[14px] font-medium disabled:opacity-40">{t({ en: 'Check my answers', ar: 'تحقق من إجاباتي' })}</button>
      ) : (
        <p className="mt-3 text-[14px]">{t({ en: `${correct} of 3. Thank you.`, ar: `${correct} من 3. شكراً لك.` })}</p>
      )}
    </section>
  );
}
