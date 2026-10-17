'use client';
// The counsellor desk: a named counsellor signs in, sees a queue sorted by priority and time-to-contact,
// only what each person consented to share, counsellor-only estimates, actions, and an audit trail
// (every view logged) whose integrity is checked on every read.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import type { DeskCase } from '@/lib/desk';
import { conditionFor } from '@/lib/conditions';
import { F, oneIn, oneCarrierResidual } from '@/lib/risk';
import { geneQ } from '@/lib/genefreq';
import { Mark, Person } from '@/components/glyphs';

type L = { en: string; ar: string };
const CNV = new Set(['CYP21A2', 'HBA1', 'HBA2', 'SMN1', 'GBA1', 'F8']);
const XL = new Set(['ABCD1', 'AFF2', 'ARX', 'DMD', 'F8', 'F9', 'FMR1', 'GLA', 'L1CAM', 'MID1', 'NR0B1', 'OTC', 'PLP1', 'RPGR', 'RS1', 'SLC6A8', 'G6PD']);
/** Must match COUNSELLORS in lib/deskauth.ts (server-only). */
const COUNSELLORS = ['Dr. Fatima Al Hammadi (synthetic)', 'Dr. Yousef Al Marzouqi (synthetic)', 'Judge (demo)'];
const PRIORITY: Record<DeskCase['priority'], L> = { urgent: { en: 'Urgent: call today', ar: 'عاجل: اتصال اليوم' }, pregnant: { en: 'Pregnant', ar: 'حمل' }, routine: { en: 'Routine', ar: 'روتيني' } };
const LEVEL: Record<string, L> = { simple: { en: 'simple reading', ar: 'قراءة مبسطة' }, standard: { en: 'standard reading', ar: 'قراءة عادية' }, detailed: { en: 'detailed reading', ar: 'قراءة مفصلة' } };
const done = (c: DeskCase) => c.status === 'withdrawn' || c.status === 'closed';
/** Waiting cases before contacted ones, finished last. Urgent first, then soonest due (pregnancy has the shorter clock, so it rises on its own). */
const order = (a: DeskCase, b: DeskCase) => Number(done(a)) - Number(done(b)) || Number(!!a.firstContactAt) - Number(!!b.firstContactAt)
  || Number(a.priority !== 'urgent') - Number(b.priority !== 'urgent') || a.dueBy - b.dueBy;
const STATUS: Record<string, L> = {
  new: { en: 'New', ar: 'جديدة' }, contacted: { en: 'Contacted', ar: 'تم التواصل' }, counselled: { en: 'Counselled', ar: 'تمت الاستشارة' },
  referred: { en: 'Referred', ar: 'أحيلت' }, closed: { en: 'Closed', ar: 'مغلقة' }, withdrawn: { en: 'Consent withdrawn', ar: 'سُحبت الموافقة' },
};
const REL: Record<string, L> = {
  unrelated: { en: 'Not related', ar: 'لا قرابة' }, 'second-cousins': { en: 'Second cousins', ar: 'أبناء عمومة درجة ثانية' },
  'first-cousins-once-removed': { en: 'First cousins once removed', ar: 'أقارب درجة أولى بفارق جيل' }, 'first-cousins': { en: 'First cousins', ar: 'أبناء عمومة درجة أولى' },
  'double-first-cousins': { en: 'Double first cousins', ar: 'أبناء عمومة وخؤولة' },
};

function clock(c: DeskCase, now: number, lang: Locale) {
  if (c.status === 'withdrawn') return { text: '—', tone: 'text-ink-2' };
  if (c.firstContactAt) {
    const h = Math.round((c.firstContactAt - c.createdAt) / 3_600_000);
    return { text: lang === 'ar' ? `تواصل خلال ${h} س` : `contacted in ${h} h`, tone: 'text-sage' };
  }
  const left = c.dueBy - now;
  const h = Math.max(1, Math.round(Math.abs(left) / 3_600_000));
  const share = left / Math.max(1, c.dueBy - c.createdAt);
  return left < 0
    ? { text: lang === 'ar' ? `متأخرة ${h} س` : `${h} h overdue`, tone: 'text-madder font-medium' }
    : { text: lang === 'ar' ? `${h} س متبقية` : `${h} h left`, tone: share < 0.25 ? 'text-camel font-medium' : 'text-ink-2' };
}

export function Desk({ lang }: { lang: Locale }) {
  const t = useCallback((l: L) => l[lang], [lang]);
  const [code, setCode] = useState('');
  const [user, setUser] = useState(COUNSELLORS[0]);
  const [authed, setAuthed] = useState(false);
  const [cases, setCases] = useState<DeskCase[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ case: DeskCase; auditIntact: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [note, setNote] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
  useEffect(() => { try { const u = sessionStorage.getItem('desk-user'); if (u && COUNSELLORS.includes(u)) setUser(u); } catch {} }, []);
  const headers = useCallback((extra: Record<string, string> = {}) => ({ 'x-desk': code, 'x-desk-user': encodeURIComponent(user), ...extra }), [code, user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(i); }, []);

  const load = useCallback(async () => {
    const r = await fetch('/api/desk/cases', { headers: headers() });
    if (r.status === 401) { setAuthed(false); setErr(t({ en: 'That passcode is not right.', ar: 'رمز المرور غير صحيح.' })); return; }
    const j = await r.json();
    setCases([...j.cases].sort(order)); setAuthed(true); setErr(null);
    try { sessionStorage.setItem('desk-user', user); } catch {}
  }, [headers, t, user]);

  const open = useCallback(async (id: string) => {
    setSel(id);
    const r = await fetch(`/api/desk/cases/${id}`, { headers: headers() });
    if (r.ok) setDetail(await r.json());
  }, [headers]);

  const act = async (action: string, extra: Record<string, string> = {}) => {
    if (!sel) return;
    const r = await fetch(`/api/desk/cases/${sel}`, { method: 'PATCH', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ action, ...extra }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    setDetail(j); setErr(null); setNote('');
    load();
  };

  const partnerOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cases) if (c.pairing) m.set(c.pairing, (m.get(c.pairing) ?? 0) + 1);
    return m;
  }, [cases]);

  if (!authed) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="flex items-center gap-2"><Mark size={24} /><span className="text-[15px] font-medium">{t({ en: 'Counsellor desk', ar: 'مكتب المستشار' })}</span></div>
        <h1 className="mt-6 text-[28px] font-semibold tracking-tight">{t({ en: 'Sign in to the desk', ar: 'سجّل الدخول إلى المكتب' })}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{t({ en: 'In production, counsellors sign in with their health-authority account. Judges: the demo passcode is in the submission notes.', ar: 'في الإنتاج يسجّل المستشارون الدخول بحساب الجهة الصحية. للمحكّمين: رمز مرور العرض موجود في ملاحظات التقديم.' })}</p>
        <form className="mt-6 grid gap-3" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <label className="text-[13px] text-ink-2" htmlFor="who">{t({ en: 'Counsellor account', ar: 'حساب المستشار' })}
            <select id="who" value={user} onChange={(e) => setUser(e.target.value)} className="mt-1 block w-full rounded-[2px] border border-ink bg-paper px-3 py-3 text-[15px] text-ink">
              {COUNSELLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className="text-[13px] text-ink-2" htmlFor="pc">{t({ en: 'Passcode', ar: 'رمز المرور' })}
            <input id="pc" type="password" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full rounded-[2px] border border-ink bg-paper px-3 py-3 text-ink" autoComplete="off" /></label>
          <button disabled={!code} className="rounded-[2px] bg-ink px-5 py-3 text-wool disabled:opacity-50">{t({ en: 'Open the desk', ar: 'افتح المكتب' })}</button>
        </form>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-2">{t({ en: 'Every case you open is written to its audit trail under the account you choose.', ar: 'تُسجَّل كل حالة تفتحها في سجل تدقيقها باسم الحساب الذي تختاره.' })}</p>
        {err && <p role="alert" className="mt-3 text-[14px] text-madder">{err}</p>}
      </main>
    );
  }

  const c = detail?.case;
  const overdue = cases.filter((x) => !x.firstContactAt && !done(x) && x.dueBy < now).length;
  const urgentOpen = cases.filter((x) => !x.firstContactAt && !done(x) && x.priority === 'urgent').length;
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <div className="flex items-center gap-2 text-ink-2"><Mark size={22} /><span className="text-[14px]">{t({ en: 'Two Keys counsellor desk', ar: 'مكتب المستشار في مفتاحان' })}</span>
            <span className="ms-3 text-[13px]">{t({ en: `Signed in as ${user}`, ar: `مسجّل باسم ${user}` })}</span>
            <button onClick={() => { setAuthed(false); setCode(''); setCases([]); setDetail(null); setSel(null); }} className="ms-2 text-[13px] underline">{t({ en: 'Sign out', ar: 'خروج' })}</button></div>
          <h1 className="mt-1 text-[30px] font-semibold tracking-tight">{t({ en: 'Couples waiting for a call', ar: 'أزواج بانتظار مكالمة' })}</h1>
        </div>
        <dl className="flex gap-8 text-[13px]">
          <div><dt className="text-ink-2">{t({ en: 'Open', ar: 'مفتوحة' })}</dt><dd className="text-[24px] font-semibold">{cases.filter((x) => ['new', 'contacted', 'counselled'].includes(x.status)).length}</dd></div>
          <div><dt className="text-ink-2">{t({ en: 'Urgent', ar: 'عاجلة' })}</dt><dd className={`text-[24px] font-semibold ${urgentOpen ? 'text-madder' : ''}`}>{urgentOpen}</dd></div>
          <div><dt className="text-ink-2">{t({ en: 'Overdue', ar: 'متأخرة' })}</dt><dd className={`text-[24px] font-semibold ${overdue ? 'text-madder' : ''}`}>{overdue}</dd></div>
          <div><dt className="text-ink-2">{t({ en: 'Time to first contact', ar: 'مهلة أول تواصل' })}</dt><dd className="mt-1 max-w-[16rem] text-[13px] leading-snug">{t({ en: 'urgent 4 hours, pregnancy 1 working day, routine 2 working days', ar: 'العاجل 4 ساعات، والحمل يوم عمل، والروتيني يوما عمل' })}</dd></div>
        </dl>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label={t({ en: 'Queue', ar: 'قائمة الانتظار' })}>
          <ul className="divide-y divide-rule border-y border-rule">
            {cases.map((x) => {
              const k = clock(x, now, lang);
              return (
                <li key={x.id}>
                  <button onClick={() => open(x.id)} aria-current={sel === x.id} className={`w-full px-3 py-3.5 text-start ${sel === x.id ? 'bg-paper' : 'hover:bg-paper'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[15px] font-medium"><Person sex={x.person.sex} color={x.person.sex === 'F' ? 'var(--indigo)' : 'var(--camel)'} size={16} />{x.person.name}</span>
                      <span className={`text-[13px] ${k.tone}`}>{k.text}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2">
                      {x.priority && x.priority !== 'routine' && !done(x) && <span className={`rounded-[2px] px-1.5 py-0.5 font-medium ${x.priority === 'urgent' ? 'bg-madder text-wool' : 'border border-indigo text-indigo'}`}>{t(PRIORITY[x.priority])}</span>}
                      <span dir="ltr" className="font-mono">{x.sharedGenes.join(', ') || '—'}</span>
                      <span>{t(STATUS[x.status])}</span>
                      <span>{x.language === 'ar' ? 'العربية' : 'English'}</span>
                      {x.pairing && (partnerOf.get(x.pairing) ?? 0) > 1 && <span className="text-indigo">{t({ en: 'partner also asked', ar: 'الشريك طلب أيضاً' })}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-live="polite">
          {!c ? (
            <p className="border border-dashed border-ink-3 px-6 py-16 text-center text-[15px] text-ink-2">{t({ en: 'Choose a couple on the left to see what they shared with you.', ar: 'اختر زوجين من القائمة لرؤية ما شاركوه معك.' })}</p>
          ) : (
            <article className="rounded-[3px] border border-ink bg-paper">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-5 py-4">
                <h2 className="text-[22px] font-semibold tracking-tight">{c.person.name}</h2>
                <span className="text-[12px] text-ink-2">{t({ en: 'case', ar: 'حالة' })} <bdi dir="ltr" className="font-mono">{c.id}</bdi>, {t(STATUS[c.status])}{c.priority ? `, ${t(PRIORITY[c.priority])}` : ''}</span>
              </div>
              <div className="grid gap-5 px-5 py-5">
                <div>
                  <h3 className="text-[13px] text-ink-2">{t({ en: 'What they agreed to share', ar: 'ما وافقوا على مشاركته' })}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2 text-[13px]">
                    <li className="rounded-[2px] border border-ink px-2 py-1">{t({ en: 'Shared genes', ar: 'الجينات المشتركة' })} ✓</li>
                    <li className={`rounded-[2px] border px-2 py-1 ${c.consent.ownResults ? 'border-ink' : 'border-rule text-ink-2 line-through'}`}>{t({ en: 'Own results', ar: 'نتائجه الخاصة' })}</li>
                    <li className={`rounded-[2px] border px-2 py-1 ${c.consent.relationship ? 'border-ink' : 'border-rule text-ink-2 line-through'}`}>{t({ en: 'Relationship', ar: 'القرابة' })}</li>
                    <li className="rounded-[2px] border border-rule px-2 py-1 text-ink-2">{c.language === 'ar' ? 'العربية' : 'English'}, {t(LEVEL[c.readingLevel] ?? LEVEL.standard)}</li>
                  </ul>
                  {c.consent.version && <p className="mt-1.5 text-[12px] text-ink-2">{t({ en: 'Consent version', ar: 'نسخة الموافقة' })} <bdi dir="ltr" className="font-mono">{c.consent.version}</bdi></p>}
                  {c.question && <blockquote className="mt-3 border-s-2 border-indigo ps-3 text-[14px] leading-relaxed">{c.question}</blockquote>}
                </div>

                {c.status === 'withdrawn' ? (
                  <p className="text-[15px] text-ink-2">{t({ en: 'This person withdrew consent. What they shared was erased. Clinical notes are sealed: kept as health-records law requires, but no longer shown.', ar: 'سحب هذا الشخص موافقته. مُسح ما شاركه. وخُتمت الملاحظات السريرية: تُحفظ كما يقتضي قانون السجلات الصحية، لكنها لم تعد تُعرض.' })}</p>
                ) : (
                  <div>
                    <h3 className="text-[13px] text-ink-2">{t({ en: 'Genes the couple both carry', ar: 'الجينات التي يحملها الزوجان معاً' })}</h3>
                    <table className="mt-2 w-full text-[14px]">
                      <thead><tr className="border-b border-rule text-start text-[12px] text-ink-2">
                        <th className="py-1.5 text-start font-normal">{t({ en: 'Gene', ar: 'الجين' })}</th>
                        <th className="py-1.5 text-start font-normal">{t({ en: 'Per pregnancy', ar: 'لكل حمل' })}</th>
                        <th className="py-1.5 text-start font-normal">{t({ en: 'Before acting', ar: 'قبل أي إجراء' })}</th>
                      </tr></thead>
                      <tbody>
                        {c.sharedGenes.map((g) => {
                          const cond = conditionFor(g);
                          return (
                            <tr key={g} className="border-b border-rule align-top">
                              <td className="py-2 pe-3"><span className="font-mono text-[13px]">{g}</span><br /><span className="text-[12px] text-ink-2">{cond ? t(cond.name) : ''}</span></td>
                              <td className="py-2 pe-3 font-medium text-madder">{XL.has(g) ? t({ en: 'X-linked: sons 1 in 2', ar: 'مرتبط بـ X: الأبناء 1 من 2' }) : t({ en: '1 in 4', ar: '1 من 4' })}</td>
                              <td className="py-2 text-[13px] text-ink-2">{CNV.has(g) ? t({ en: 'Confirm with a dedicated test (copy number / pseudogene region).', ar: 'أكّد بفحص مخصص (عدد النسخ / منطقة الجين الكاذب).' }) : t({ en: 'Confirm variant classification; offer partner-specific counselling.', ar: 'أكّد تصنيف المتغير، وقدّم استشارة للزوجين.' })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {c.relationship && (
                      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
                        <span className="font-medium text-ink">{t(REL[c.relationship])}</span>{F[c.relationship] > 0 ? t({ en: ` · F = 1/${Math.round(1 / F[c.relationship])}. Empirical excess for first cousins: +1.7 to 2.8 points over background (Bennett 2002). ACMG suggests tier-4 screening for consanguineous couples.`, ar: ` · F = 1/${Math.round(1 / F[c.relationship])}. الزيادة التجريبية لأبناء العمومة: +1.7 إلى 2.8 نقطة فوق الخطر العام (Bennett 2002). توصي ACMG بفحص المستوى الرابع للأزواج الأقارب.` }) : ''}
                      </p>
                    )}
                    {c.ownFindings && (
                      <div className="mt-4">
                        <h3 className="text-[13px] text-ink-2">{t({ en: 'Their own results (shared with you only)', ar: 'نتائجه الخاصة (مشاركة معك فقط)' })}</h3>
                        <ul className="mt-1.5 text-[13px]">
                          {c.ownFindings.map((f) => {
                            const q = geneQ(f.gene);
                            const residual = q && c.relationship && f.inheritance === 'AR' ? oneCarrierResidual(q, c.relationship, 0.95) : null;
                            return (
                              <li key={f.gene} className="flex justify-between gap-3 border-b border-rule py-1.5">
                                <span><span className="font-mono">{f.gene}</span> <span className="text-ink-2">{f.severity === 'mild' ? t({ en: 'mild allele', ar: 'متغير خفيف' }) : ''}{f.inheritance === 'XL' ? t({ en: ' X-linked', ar: ' مرتبط بـ X' }) : ''}</span></span>
                                <span className="text-ink-2">{residual ? t({ en: `residual if partner tested negative ≈ ${oneIn(residual)} per pregnancy (95% detection)`, ar: `الخطر المتبقي إن كان الشريك سلبياً ≈ ${oneIn(residual)} لكل حمل (كشف 95%)` }) : ''}</span>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="mt-1 text-[12px] text-ink-2">{t({ en: 'Counsellor-only estimates. ACMG advises against quoting residual numbers to patients for multi-gene panels.', ar: 'تقديرات للمستشار فقط. لا توصي ACMG بإبلاغ المرضى بأرقام الخطر المتبقي للوحات متعددة الجينات.' })}</p>
                      </div>
                    )}
                  </div>
                )}

                {c.status !== 'withdrawn' && c.status !== 'closed' && (
                  <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
                    {!c.firstContactAt && <button onClick={() => act('contact')} className="rounded-[2px] bg-ink px-4 py-2.5 text-[14px] text-wool">{t({ en: 'Record first contact', ar: 'سجّل أول تواصل' })}</button>}
                    <button onClick={() => act('counsel')} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px]">{t({ en: 'Counselled', ar: 'تمت الاستشارة' })}</button>
                    <button onClick={() => act('refer', { service: 'Reproductive genetics clinic (PGT-M), Thiqa-covered' })} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px]">{t({ en: 'Refer to reproductive genetics', ar: 'إحالة إلى الوراثة الإنجابية' })}</button>
                    <button onClick={() => act('refer', { service: 'Confirmatory testing' })} className="rounded-[2px] border border-ink px-4 py-2.5 text-[14px]">{t({ en: 'Order confirmatory test', ar: 'اطلب فحصاً تأكيدياً' })}</button>
                    <button onClick={() => act('close')} className="rounded-[2px] border border-rule px-4 py-2.5 text-[14px] text-ink-2">{t({ en: 'Close with outcome', ar: 'أغلق مع النتيجة' })}</button>
                  </div>
                )}
                {err && <p role="alert" className="text-[13px] text-madder">{err}</p>}

                {c.status !== 'withdrawn' && (
                  <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) act('note', { note }); }} className="flex gap-2">
                    <label htmlFor="note" className="sr-only">{t({ en: 'Add a note', ar: 'أضف ملاحظة' })}</label>
                    <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t({ en: 'Add a note for the record', ar: 'أضف ملاحظة للسجل' })} className="min-w-0 flex-1 rounded-[2px] border border-rule bg-wool px-3 py-2 text-[14px]" />
                    <button className="rounded-[2px] border border-ink px-3 text-[14px]">{t({ en: 'Save', ar: 'احفظ' })}</button>
                  </form>
                )}
                {c.sealed && <p className="text-[13px] text-ink-2">{t({ en: 'Notes sealed after withdrawal.', ar: 'خُتمت الملاحظات بعد السحب.' })}</p>}
                {c.notes.length > 0 && (
                  <ul className="space-y-2 text-[13px]">{c.notes.map((n, i) => <li key={i} className="border-s-2 border-rule ps-3"><span className="text-ink-2">{new Date(n.at).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB')} · {n.by}</span><br />{n.text}</li>)}</ul>
                )}

                <details className="border-t border-rule pt-3 text-[12px]">
                  <summary className="cursor-pointer text-[13px] font-medium">
                    {t({ en: 'Audit trail', ar: 'سجل التدقيق' })} · <span className={detail?.auditIntact ? 'text-sage' : 'text-madder'}>{detail?.auditIntact ? t({ en: 'chain intact', ar: 'السلسلة سليمة' }) : t({ en: 'chain broken', ar: 'السلسلة مكسورة' })}</span>
                  </summary>
                  <ol className="mt-2 space-y-1.5">
                    {c.audit.map((a) => (
                      <li key={a.hash} className="grid grid-cols-[auto_1fr] gap-x-3">
                        <span className="text-ink-2">{new Date(a.at).toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-GB')}</span>
                        <span>{a.actor}: {a.action} <span className="font-mono text-ink-2">#{a.hash.slice(0, 10)}</span></span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
