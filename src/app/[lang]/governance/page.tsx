import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { titled } from '@/i18n/meta';
import { FACTS } from '@/lib/knowledge';
import { CONDITIONS } from '@/lib/conditions';
import { CONSENT_VERSION } from '@/lib/desk';
import evalAsk from '../../../../data/eval-ask.json';
import panel from '../../../../data/panel.json';
import { Monitor } from '@/components/governance/Monitor';
import { CLAUSES_AR, FAILURES_AR, FLOWS_AR, RISKS_AR } from './ar';

export const generateMetadata = titled('Governance', 'الحوكمة');
type L = { en: string; ar: string };

/** DoH Responsible AI Standard (DoH/ST/DDGO/RAI/V1/2025, Oct 2025): clause, what Two Keys does, evidence, and the gap. */
const CLAUSES: { c: string; req: string; does: string; evidence: [string, string][]; gap?: string }[] = [
  { c: '3.1.1.1.1', req: 'Co-designed with clinicians and patients', does: 'Wording follows published counselling practice (NSGC non-directive counselling, ACMG reporting, Mackenzie’s Mission couple reports). 17 people (Arabic and English) tried it; their answers confirmed the couple-only default and the opt-out to a person.', evidence: [['/proof#study', 'User study']], gap: 'The sample is friends and family, not representative. Phase 0 runs co-design sessions with the operator’s counsellors and with couples recruited through screening centres.' },
  { c: '3.1.1.2.1–2', req: 'Human oversight and escalation protocols', does: 'Every clinical step goes through a named genetic counsellor. Distress in the explainer shows 999, 998 and the UAE Mental Support Line (800 4673) and offers a one-tap same-day call. Desk clocks: same day (4 hours) for distress, for pregnancy from week 9 or with the weeks unknown, and for a possible Hb Bart’s or severe HbH match in any pregnancy; 1 working day for earlier pregnancy and for a possible Bart’s, severe HbH or SMA match; 2 working days otherwise.', evidence: [['/desk', 'Counsellor desk'], ['/demo', 'Crisis path in the phone']], gap: 'The person must tap to book: nobody is contacted without their consent. Clock targets need staffed counsellors in a pilot.' },
  { c: '3.1.2.1.2', req: 'Graceful degradation and fallback', does: 'If the model fails or an answer breaks a check twice, the person gets a safe fixed answer and a counsellor button. If the intent check itself can’t run, the explainer fails closed and shows help. The rest of the app works with the explainer off.', evidence: [['/proof', 'Route counts in the evaluation']] },
  { c: '3.1.2.1.3', req: 'Safety testing and failure-mode analysis before deployment', does: 'Ablation evaluation on 60 development questions and a new frozen held-out set for every version (146 in v4 and v5, 178 in v6, written by three different model families), graded by three language-model judges, with a majority and a strict count; misses, their fixes and every run published. A failure-mode table is below.', evidence: [['/proof', 'Evaluation'], ['#failure-modes', 'Failure modes'], ['https://github.com/RohanGlitched/twokeys/blob/main/data/eval-ask.json', 'Every answer']], gap: 'Judges are language models, not clinicians; each set is spent once its misses are fixed, so every version needs a new one.' },
  { c: '3.1.2.1.4, 3.1.3.1.3', req: 'Post-deployment monitoring', does: 'Daily counts of how each answer was produced (guard, intent, model, fallback), which check caused each fallback, Arabic wording repairs, answers per explainer version, escalations, crisis same-day offers, language, model id and “report a problem” taps, without storing any question.', evidence: [['#monitoring', 'Live counts below']], gap: 'One review rule: review when the weekly fallback rate is 5 points above the latest evaluation’s. It is read from these counts by hand; automated alerts are not built yet.' },
  { c: '3.1.3.1.4', req: 'Performance decline triggers review', does: 'Monitoring counts fallbacks, failed checks, crisis escalations and problem reports daily.', evidence: [['#monitoring', 'Monitoring']], gap: 'Review when the weekly fallback rate is 5 points above the latest evaluation’s, on any report about an urgent answer, or on a new model version; each starts a re-run of the held-out evaluation. Checked by hand from monitoring; automated alerts are not built yet.' },
  { c: '3.1.2.2.1', req: 'Feedback mechanisms', does: 'Every explainer answer has “report a problem”; reports are counted in monitoring and reviewed.', evidence: [['#monitoring', 'Monitoring']], gap: 'Reports carry no text yet, so review starts from counts.' },
  { c: '3.1.3.1.1', req: 'Validation against established benchmarks', does: 'The risk engine is checked against every published UAE figure (Dubai, Abu Dhabi programme and genome study), all shown, including the one it misses.', evidence: [['/proof#calibration', 'Calibration']], gap: 'Gene-level fit is shown but not yet tuned; the CYP21A2 frequency is classic-only from this version.' },
  { c: '3.1.3.1.2', req: 'Testing across diverse contexts', does: 'Held-out questions in English, Modern Standard Arabic, Gulf dialect and Arabizi, results reported per dialect.', evidence: [['/proof', 'By dialect']], gap: 'Each held-out set now has 23 to 51 questions per dialect, still too few for tight parity bounds. Dialect and speaker labels are re-derived by rule from the text, not checked by a native speaker; that review is a phase-0 task.' },
  { c: '3.1.4.1.2', req: 'Threat modelling', does: 'Per-party threat model: partner, modified phone, relay, lab, counsellor, analyst, outsider.', evidence: [['/how#threats', 'Who could learn what']] },
  { c: '3.1.4.2.1', req: 'Role-based access, least privilege', does: 'Signed identity for people; the lab issues tokens only after the two seated people confirm each other by name; the desk queue shows only names, urgent or not, overdue / due today / later, and counts; desk sign-in locks one address (as the platform sees it) after 20 failures an hour, and past 300 failures an hour overall every check is slowed but never refused, so nobody can shut the escalation path.', evidence: [['/how#threats', 'Threat model']], gap: 'Demo: one shared desk passcode with a chosen name, so attribution is not individual. Production: per-clinician sign-in with MFA (DoH identity provider).' },
  { c: '3.1.4.3.1', req: 'Secure code review and vulnerability scanning', does: 'Open source, typed, tested (unit and end-to-end), input validation and rate limits on every route, strict security headers.', evidence: [['https://github.com/RohanGlitched/twokeys', 'Repository']], gap: 'Independent crypto audit and penetration test before any pilot.' },
  { c: '3.1.4.4.1', req: 'Privacy by design, data minimisation', does: 'Couple-only by default. The lab computes the match from results it already holds and keeps who paired with whom, and the genes it named, for one day. A booked case keeps only a keyed code of its pairing (so the desk can see whether the partner booked too), erased on withdrawal. A counsellor sees only what was ticked; the queue shows no genes and no exact clock. Programme counts take each person once a year, under a pseudonym key that changes every year.', evidence: [['/how', 'How it works']], gap: 'The keyed pairing code links two partners’ bookings for as long as the cases are kept (60 days in the demo; 2 hours for demo identities). Phase 0 decides with the operator whether to compute “partner booked too” at booking time instead and keep no link.' },
  { c: '3.1.4.4.2', req: 'Production data not used for training', does: 'Nothing is trained. The model is called through Amazon Bedrock, which does not use inputs to train models.', evidence: [] },
  { c: '3.1.4.4.3', req: 'Secure multi-party computation, differential privacy', does: 'Private set intersection on the two phones: the lab names genes only when both phones’ comparisons agree with its own records, and labs never need to exchange results. Programme counts use exact discrete Laplace noise from a keyed generator, per-person markers under a pseudonym key that changes every year and deleted when the year ends (a person’s first booking and teach-back once a year, at most 5 notes a year), each week released once into an append-only ledger, ε ≤ 3 per person per year.', evidence: [['/how', 'Protocol'], ['/programme', 'Programme view']], gap: 'In the single-lab setting the lab already holds both results, so the private comparison protects partners from each other; its cross-lab role starts in phase 2.' },
  { c: '3.1.4.5.1', req: 'Compute, storage and remote access inside the UAE', does: 'Designed for in-country hosting (AWS me-central-1 offers Nova Pro and DynamoDB).', evidence: [], gap: 'The demo runs in Sydney on synthetic data, and the developer is outside the UAE. Phase 0: move and re-test in the UAE; vendor access only through the operator’s UAE jump host; UAE-based support.' },
  { c: '3.1.5.1.1', req: 'Diverse test data (age, gender, other factors)', does: 'Held-out questions are asked by women and men, in four language forms, at three reading levels.', evidence: [['/proof', 'Evaluation']], gap: 'Age and education are not yet varied on purpose; the pilot reports by both.' },
  { c: '3.1.5.1.2', req: 'Representativeness and subgroup gaps', does: 'Understanding (teach-back) and explainer safety are reported by language and reading level.', evidence: [['/programme', 'Understanding by language'], ['/proof', 'By dialect']], gap: 'In v4, Gulf-dialect and Arabizi questions got a checked model answer less often than English ones (most were Arabic answers our own wording checks refused). The fixes after v4 target this, and each run reports helpfulness by dialect.' },
  { c: '3.1.6.1.1', req: 'Tell patients when AI contributes', does: 'The question screen says an AI writes the answers, that they are checked, and that they can be wrong.', evidence: [['/demo', 'Ask a question']] },
  { c: '3.1.6.1.3', req: 'Right to opt out of AI', does: '“I’d rather ask a person” on the question screen books a counsellor instead. Nothing else in the app uses AI.', evidence: [['/demo', 'Ask a question']] },
  { c: '3.1.6.2.3', req: 'Traceability of inputs, outputs and versions', does: 'The model id is pinned and counted in monitoring; every desk action is in an HMAC-keyed, sealed audit chain.', evidence: [['/desk', 'Audit trail'], ['#monitoring', 'Monitoring']], gap: 'Question text is deliberately not logged, for privacy. A pilot needs consented, access-controlled logging; this trade-off goes to the DoH conformity assessment.' },
  { c: '3.1.6.3.3', req: 'Plain-language patient outputs', does: 'Simple, standard and detailed versions in Arabic and English; readability measured on every answer in the evaluation.', evidence: [['/proof', 'Readability']], gap: 'Readability is measured by formula, and Arabic formulas are less established than English ones; no reading level has yet been tested with couples for comprehension. Phase 0 tests each level with couples recruited through screening centres.' },
  { c: '3.1.7.2.2–3', req: 'Clinicians keep final authority; override and audit', does: 'Options are unranked; no clinical step without a counsellor; withdrawal erases shared data and seals notes.', evidence: [['/desk', 'Desk']], gap: 'A counsellor can’t yet see or correct an explainer answer a person was given (question text is not stored, for privacy), and where the language-model judges disagree in an evaluation no person decides yet. Human adjudication of evaluation disagreements is planned in phase 0.' },
  { c: '3.1.7.1.1–2', req: 'Named owners for monitoring, review and reporting', does: 'Interim owner for every risk and role: the founder.', evidence: [['#risks', 'Risk register']], gap: 'Clinical lead, operator and DoH reporting owners are named in phase 0.' },
  { c: '3.2.3.1.1', req: 'Data clinically validated by domain experts', does: 'Every fact and condition card cites its source and is versioned, ready for sign-off. In phase 0 the operator’s genetic counsellors sign off each version, and no version reaches patients without that sign-off.', evidence: [['#data-card', 'Data card']], gap: 'Clinical sign-off of every fact, condition card and Arabic string by the operator’s genetic counsellors is a phase-0 gate before launch; 131 panel genes have short cards generated from the panel data until then.' },
  { c: '3.2.5.3', req: 'Datasheets or data cards', does: 'Data card below; sources and rights on the Proof page.', evidence: [['#data-card', 'Data card'], ['/proof#sources', 'Sources']] },
  { c: '3.2.4.1', req: 'Versioned, traceable datasets', does: 'Facts, condition cards and the gene panel are versioned in git; the evaluation’s held-out questions are frozen with a published SHA-256 before each run.', evidence: [['https://github.com/RohanGlitched/twokeys', 'Repository']] },
  { c: '3.3.1.1.2', req: 'Risk register with owners', does: 'Register below.', evidence: [['#risks', 'Risk register']] },
  { c: '3.3.1.2.2.2', req: 'High risk: conformity assessment before and after deployment', does: 'We classify the explainer as high risk and plan the assessment with the DoH Data and Digital Governance Office.', evidence: [['#tier', 'Risk tier']], gap: 'Assessment not yet done; it is a gate before the pilot.' },
  { c: '3.3.1.4.1', req: 'Risk communication to stakeholders and DoH', does: 'This page, the deck and /proof publish the tier, register, evaluation and misses.', evidence: [['/proof', 'Proof']], gap: 'Formal reporting to DoH starts with the conformity assessment.' },
  { c: '3.4.1', req: 'AI literacy for staff', does: 'The desk tells counsellors what the explainer can and can’t do.', evidence: [['/desk', 'Desk']], gap: 'A short counsellor guide to the explainer’s limits and failure modes, in phase 0.' },
];

const FLOWS: string[][] = [
  ['Carrier results', 'The screening lab, as today', 'Lab staff', 'Decree-Law 49/2023 Arts. 6, 7', 'Lab’s existing policy', 'Must stay in the UAE (Art. 7)'],
  ['One-time tokens', 'Phone memory, one pairing', 'Nobody can read them', 'Part of screening', 'Gone when the page closes', 'None'],
  ['Locked lists (relay)', 'Relay, encrypted', 'Nobody: key never reaches a server', 'Part of screening', 'Unreadable after 10 minutes; deleted within 48 hours', 'Demo: Sydney. Production: UAE'],
  ['Who paired, that both confirmed, and the genes the lab named to them (with what each match means)', 'Lab store (in the demo, Two Keys’ own database)', 'Lab', 'Lawful basis: both partners’ explicit consent to the comparison (Decree-Law 49/2023 Art. 6). Prevents reuse and impersonation; a booking copies the named genes from here', '1 day; then only a used-link marker with no names, 30 days. A failed comparison leaves one record with the day, the seat and a pseudonym (key changes yearly), no genes, 1 year', 'Demo: Sydney. Production: UAE, lab-operated'],
  ['Choice to see everything', 'Lab store', 'Lab; partner’s results released only when both chose', 'Lawful basis: both partners’ explicit choice (Art. 6)', '1 day, with the pairing', 'Demo: Sydney. Production: UAE'],
  ['Booked case (ticked items only; own results only if ticked), with a keyed code of the pairing, never the pairing itself, so the desk can see whether the partner booked too. A shared gene is the booker’s own result too; the partner is never named on the case', 'Desk store (operator’s system in production)', 'Named counsellors, every view logged; the queue shows no genes and no exact clock', 'Lawful basis: explicit consent (Art. 6), withdrawable (Art. 8), for the booker’s own care; consent ' + CONSENT_VERSION, 'Demo 60 days (2 hours for cases booked by shared demo identities); production per health-records law. Withdrawal erases what was shared and the pairing code at once', 'Demo: Sydney. Production: UAE'],
  ['Family notes', 'Store, encrypted on the sender’s phone; no sender kept with the note (the server sees the signed-in sender only while handling the request; pseudonymous per-person counters: 5 notes a day in the demo, where identities are shared; only a person’s first 5 notes of the year enter programme counts)', 'Only someone with the link; read and booked acknowledgements need a token made from the link', 'Lawful basis: the sender’s choice to tell relatives about their own result (Art. 6); a relative consents when tested', '30 days; the per-person counters end with their day or year', 'Demo: Sydney. Production: UAE'],
  ['Explainer question', 'Sent to the model, not stored', 'Model provider, processing only', 'Person’s request', 'Not stored', 'Demo: Amazon Bedrock APAC cross-region profile (may route within Asia-Pacific). Production: UAE region'],
  ['Programme and monitoring counts', 'Store', 'Health authority (noisy weekly aggregates)', 'Lawful basis: the health authority’s oversight of the screening programme; only noised aggregates leave the store', 'Counts only, 1 year. Released weeks (an append-only ledger, with any correction notes beside it) are kept permanently, so no week is released twice. Pseudonymous “already counted” markers use a key that changes every year and are deleted when the year ends, so each person is counted once a year and no marker outlives its year', 'Demo: Sydney. Production: UAE'],
  ['Desk queue reads', 'Desk store', 'Operator audit', 'Accountability', '60 days', 'Demo: Sydney. Production: UAE'],
];

const RISKS: string[][] = [
  ['Explainer gives a wrong or falsely reassuring answer', 'Grounded facts; number, odds, X-linked and milder-match checks; fallback; counsellor button; held-out evaluation', '3', '4', 'High (sets the tier)', 'Founder (interim); clinical lead'],
  ['Distress is missed', 'Keyword and model crisis checks in English, Arabic, Gulf and Arabizi; fails closed if the check can’t run; help line and same-day call offered. v4 measured 7 of 146 held-out answers missing distress, v5 5 of 146 and v6 3 of 178, which sets the likelihood', '3', '5', 'High (sets the tier)', 'Founder (interim); clinical lead'],
  ['Someone else joins a pairing, or blocks it', 'Atomic seats; the creator confirms the joiner by name first, and a “no” frees the seat for the right person; no tokens until both confirm; relay writes need the link’s write key, so seeing a mailbox id isn’t enough to fill or block it', '2', '4', 'Low', 'Founder (interim)'],
  ['Partner or family sees a result through the phone itself', 'Couple-only default; results sealed until opened; decoy-padded tokens; nothing in notifications', '3', '3', 'Medium', 'Product owner'],
  ['Health data leaves the UAE', 'Synthetic data only in the demo; in-country hosting and UAE-only access are a pilot gate', '5', '4', 'High until moved', 'Operator'],
  ['Counsellor over-access', 'Consent per item; queue without genes; logged case views and queue reads; compare-and-swap writes so a withdrawal can’t be undone', '2', '3', 'Low', 'Operator'],
  ['Audit trail rolled back by an insider', 'Keyed, sealed chain detects edits and truncation by anyone without the audit key; production anchors the chain head outside the database (write-once storage)', '1', '4', 'Medium until anchored', 'Operator'],
  ['Server keys compromised', 'Demo: one root key on one server, with a separate HKDF subkey for each purpose (tokens, identity, audit, lab signing, noise, limits). Production: separate keys in a KMS/HSM held by the lab and operator; rotation', '2', '5', 'Medium', 'Lab and operator'],
  ['Teach-back overstates understanding', 'Counted as first-try scores only; validated instrument in the pilot', '3', '2', 'Low', 'Evaluation lead'],
  ['The desk store doesn’t scale', 'The demo store keeps one partition per record type and reads the whole queue with a full scan, paged to the end, that refuses past 20,000 items rather than truncate silently. Phase 2: an index on status and due time (DynamoDB GSI) and paged queue reads', '3', '3', 'Medium until indexed', 'Founder (interim)'],
  ['Script injection in the web app', 'Strict security headers; no third-party scripts; every input validated. The Content-Security-Policy still allows \'unsafe-inline\' scripts and styles (the framework’s inline bootstrap); phase 0 moves to per-request nonces and drops it', '2', '4', 'Medium until nonces', 'Founder (interim)'],
];

const FAILURES: string[][] = [
  ['Model unavailable or slow', 'A fixed safe reply and the counsellor button; the rest of the app works', 'Fallback count in monitoring', 'Retries with backoff; review when the weekly fallback rate is 5 points above the latest evaluation’s (read from monitoring by hand; automated alerts are not built yet)'],
  ['Intent check can’t run', 'Retried once; then a neutral message and the counsellor button (help numbers too if the person sounds distressed), never an unchecked answer', 'Counted as a check failure', 'Fails closed by design; not marked urgent, so an outage can’t flood the same-day queue'],
  ['Answer breaks a check twice', 'A fixed safe reply', 'Fallback count; over-refusal in each evaluation', 'Review the check or the facts; re-run the evaluation'],
  ['Wrong odds pass every check', 'A wrong number on screen', 'Held-out evaluation; “report a problem”', 'Fix the fact or check, add a regression test, re-run on a new set'],
  ['Distress phrase not recognised', 'No crisis card; the counsellor button is still on every answer', 'Held-out misses; reports; counsellor feedback', 'Add the phrase and a regression test the same day'],
  ['A phone tampers with the comparison', 'Nothing is named; both are asked to pair again', 'The lab refuses and logs the mismatch: a daily count, and one record per pairing with the seat and a pseudonym, no genes', 'Investigate repeated failures for one person'],
  ['Partner never confirms', 'Nothing issued or named; the pairing expires', 'Timeout on the phone', 'Start a new pairing'],
  ['A partner stops or says no', 'Nothing is named; the other phone is told “Your partner stopped this comparison”', 'A sealed stop message in the relay, and the lab answers “stopped”', 'Start a new pairing; a creator who said no can wait for the right person on the same link'],
  ['Desk store write conflict', 'Retried automatically; a 409 asks to try again', 'Conflict responses', 'None needed unless frequent'],
  ['Counsellor misses a clock', 'The case turns overdue on the desk', 'Overdue count in the programme view', 'Operator escalation rota'],
];

const CLAUSE_HEAD: L[] = [
  { en: 'Clause', ar: 'البند' }, { en: 'Requirement', ar: 'المتطلب' }, { en: 'What Two Keys does', ar: 'ما يفعله مفتاحان' },
  { en: 'Evidence', ar: 'الدليل' }, { en: 'Gap', ar: 'الفجوة' },
];
const FLOW_HEAD: L[] = [
  { en: 'Data', ar: 'البيانات' }, { en: 'Where', ar: 'أين تُحفظ' }, { en: 'Who can read it', ar: 'من يستطيع قراءتها' },
  { en: 'Basis', ar: 'الأساس القانوني' }, { en: 'Kept for', ar: 'مدة الحفظ' }, { en: 'Location', ar: 'الموقع' },
];
const RISK_HEAD: L[] = [
  { en: 'Risk', ar: 'الخطر' }, { en: 'Controls', ar: 'الضوابط' }, { en: 'Likelihood (1–5)', ar: 'الاحتمال (1–5)' },
  { en: 'Impact (1–5)', ar: 'الأثر (1–5)' }, { en: 'Residual', ar: 'الخطر المتبقي' }, { en: 'Owner', ar: 'المسؤول' },
];
const FAILURE_HEAD: L[] = [
  { en: 'Failure', ar: 'الإخفاق' }, { en: 'Effect on the person', ar: 'الأثر على الشخص' }, { en: 'Detection', ar: 'الكشف' }, { en: 'Response', ar: 'الاستجابة' },
];

export default async function GovernancePage({ params }: PageProps<'/[lang]/governance'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (l: L) => l[lang];
  const ar = lang === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const ev = evalAsk as unknown as {
    version?: number; built: string; models: { product: string; judges?: Record<string, string>; heldoutAuthor?: string };
    summary: Record<string, Record<string, { cases: number; safe: number; helpful: number; safeHelpful?: number; strictSafe?: number }>>;
    cost?: { usdPerAnswer: number; inputTokensPerAnswer: number; outputTokensPerAnswer: number };
    misses?: { id: string; flags: string[] }[];
  };
  const tk = ev.summary?.heldout?.twokeys;
  const href = (h: string) => (h.startsWith('http') || h.startsWith('#') ? h : `/${lang}${h}`);
  const genes = (panel as { genes: unknown[] }).genes.length;

  return (
    <>
      <Nav lang={lang} path="/governance" />
      <main id="main" className="mx-auto max-w-[1240px] px-6 pt-6 md:px-8">
        <h1 className="max-w-3xl text-[clamp(32px,3.6vw,48px)] font-semibold leading-tight tracking-tight">{t({ en: 'Governance pack', ar: 'ملف الحوكمة' })}</h1>
        <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-2">{t({ en: 'What a Department of Health reviewer would ask for, mapped to the Abu Dhabi Responsible AI Standard (DoH/ST/DDGO/RAI/V1/2025, October 2025). Where we fall short, the gap is written down next to the clause.', ar: 'ما قد يطلبه مراجع في دائرة الصحة، مرتبطاً بمعيار الذكاء الاصطناعي المسؤول في أبوظبي (DoH/ST/DDGO/RAI/V1/2025، أكتوبر 2025). وحيث نقصّر، تُكتب الفجوة بجانب البند.' })}</p>

        <section id="tier" className="mt-12 grid gap-6 border-t-[1.5px] border-ink pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Risk tier: high', ar: 'فئة المخاطر: عالية' })}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{t({ en: 'Clause 3.3.1.2.2.2', ar: 'البند 3.3.1.2.2.2' })}</p>
          </div>
          <div className="space-y-3 text-[16px] leading-relaxed text-ink-2">
            <p>{t({ en: 'The explainer talks directly to patients about results that can shape reproductive decisions, in two languages, and could cause harm if it reassured wrongly or missed distress. Even after the controls below, we rate the residual risk high, so we treat it as high risk, which means a conformity assessment with the DoH Data and Digital Governance Office before the pilot and again after it.', ar: 'يتحدث الشارح مباشرة مع المرضى عن نتائج قد تؤثر في قرارات الإنجاب، بلغتين، وقد يسبب ضرراً إن طمأن خطأً أو فاته ضيق. لذلك نعدّه عالي المخاطر، أي تقييم مطابقة مع مكتب حوكمة البيانات والرقمنة في الدائرة قبل التجربة وبعدها.' })}</p>
            <p>{t({ en: 'The private matching and the counsellor desk are not AI. They fall under the health-data and genetic-testing laws (Decree-Law 49/2023, Federal Law 2/2019) and ADHICS, and are covered by the same DPIA.', ar: 'المطابقة الخاصة ومكتب المرشد الوراثي ليسا ذكاءً اصطناعياً، ويخضعان لقوانين البيانات الصحية والفحص الجيني (المرسوم بقانون 49/2023 والقانون الاتحادي 2/2019) ولمعيار ADHICS، ويشملهما تقييم الأثر نفسه.' })}</p>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Clause by clause', ar: 'بنداً بنداً' })}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[14px]" dir={dir}>
              <thead><tr className="border-b-[1.5px] border-ink text-start">
                {CLAUSE_HEAD.map((h, i) => <th key={h.en} scope="col" className={`py-2.5 text-start font-semibold ${i < CLAUSE_HEAD.length - 1 ? 'pe-4' : ''}`}>{t(h)}</th>)}
              </tr></thead>
              <tbody>
                {CLAUSES.map((r) => {
                  const a = ar ? CLAUSES_AR[r.c] : undefined;
                  const gap = a ? a.gap : r.gap;
                  return (
                    <tr key={r.c} className="border-b border-rule align-top">
                      <th scope="row" className="whitespace-nowrap py-3 pe-4 text-start font-mono text-[13px] font-medium"><span dir="ltr">{r.c}</span></th>
                      <td className="py-3 pe-4 font-medium">{a ? a.req : r.req}</td>
                      <td className="py-3 pe-4 leading-relaxed text-ink-2">{a ? a.does : r.does}</td>
                      <td className="py-3 pe-4">{r.evidence.length ? r.evidence.map(([h, l], i) => <Link key={h + l} href={href(h)} className="block text-indigo underline underline-offset-2">{a ? a.ev[i] : l}</Link>) : <span className="text-ink-2">—</span>}</td>
                      <td className={`py-3 leading-relaxed ${gap ? 'text-alert' : 'text-ink-2'}`}>{gap ?? t({ en: 'None known', ar: 'لا فجوة معروفة' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 grid gap-10 md:grid-cols-2">
          <div className="rounded-[3px] border border-ink bg-paper p-6">
            <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'Model card: the explainer', ar: 'بطاقة النموذج: الشارح' })}</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[14px]" dir={dir}>
              <dt className="text-ink-2">{t({ en: 'Intended use', ar: 'الاستخدام المقصود' })}</dt><dd>{t({ en: 'Answer a couple’s questions about genes they both carry, from vetted facts, in English or Arabic, at three reading levels.', ar: 'الإجابة عن أسئلة الزوجين حول جينات يحمل كلاهما تغيّراً فيها، من معلومات موثَّقة، بالإنجليزية أو العربية، وبثلاثة مستويات للقراءة.' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Out of scope', ar: 'خارج النطاق' })}</dt><dd>{t({ en: 'Diagnosis, recommending a decision, religious rulings, anything about a partner beyond shared genes, emergencies (handed to people).', ar: 'التشخيص، والتوصية بقرار، والفتاوى الدينية، وأي شيء عن الشريك يتجاوز الجينات المشتركة، والطوارئ (تُحال إلى أشخاص).' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Model', ar: 'النموذج' })}</dt><dd><bdi className="font-mono text-[13px]">{ev.models.product}</bdi>{t({ en: ', pinned; temperature 0.1', ar: '، نسخة مثبَّتة؛ درجة الحرارة 0.1' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Safety layers', ar: 'طبقات الأمان' })}</dt><dd>{ar ? `حواجز بالكلمات المفتاحية (الإنجليزية والفصحى والخليجية والعربيزي)، وفحص للنية بالنموذج، وتوجيه مرتكز على معلومات موثَّقة (عددها ${FACTS.length}) وبطاقة لكل جين في القائمة، وفحوص برمجية للأرقام والاحتمالات والقرابة والتغطية والدور الذي يتحدث به واللغة والصياغة، وبديل ثابت. وتخضع الإجابات العربية لتصحيحات ثابتة في الصياغة (أسماء البرامج بالحروف العربية، والمثنى للزوجين، والمصطلحات المعتمدة) قبل الفحوص، ويُحتسب كل تصحيح في المراقبة والتقييم.` : `Keyword guards (English, MSA, Gulf dialect, Arabizi), model intent check, grounded prompt with ${FACTS.length} facts and a card for every panel gene, code checks on numbers, odds, relatedness, cover, persona, language and framing, fixed fallback. Arabic answers get deterministic wording repairs (plan names in Arabic script, the dual for the couple, agreed terms) before the checks; each repair is counted in monitoring and the evaluation.`}</dd>
              <dt className="text-ink-2">{t({ en: 'Held-out result', ar: 'النتيجة على المجموعة المحجوزة' })}</dt><dd>{ar
                ? `${tk ? `آمنة ومفيدة معاً: ${tk.safeHelpful ?? tk.helpful} من ${tk.cases}؛ وآمنة: ${tk.safe}${tk.strictSafe != null ? `، وآمنة بالعدّ الصارم: ${tk.strictSafe}` : ''}` : 'انظر صفحة الإثبات'}${ev.misses ? `؛ ونُشرت الأخطاء (عددها ${ev.misses.length})` : ''}`
                : `${tk ? `safe and helpful ${tk.safeHelpful ?? tk.helpful} of ${tk.cases}; safe ${tk.safe}${tk.strictSafe != null ? `, strictly safe ${tk.strictSafe}` : ''}` : 'see Proof'}${ev.misses ? `; ${ev.misses.length} misses published` : ''}`}</dd>
              <dt className="text-ink-2">{t({ en: 'Judges', ar: 'النماذج المقيِّمة' })}</dt><dd><bdi className="font-mono text-[12px]">{ev.models.judges ? Object.values(ev.models.judges).join(', ') : '—'}</bdi> {t({ en: '(language models)', ar: '(نماذج لغوية)' })}</dd>
              {ev.models.heldoutAuthor && <><dt className="text-ink-2">{t({ en: 'Held-out author', ar: 'كاتب الأسئلة المحجوزة' })}</dt><dd><bdi className="font-mono text-[12px]">{ev.models.heldoutAuthor}</bdi>{t({ en: ', neither the product model nor a judge; set frozen with its SHA-256 before the run', ar: '، ليس نموذج المنتج ولا أحد المقيِّمين؛ وجُمِّدت المجموعة مع بصمة SHA-256 قبل التشغيل' })}</dd></>}
              {ev.cost && <><dt className="text-ink-2">{t({ en: 'Cost', ar: 'التكلفة' })}</dt><dd>{ar
                ? `وحدات نصية (tokens) لكل إجابة: نحو ${Math.round(ev.cost.inputTokensPerAnswer)} للإدخال و${Math.round(ev.cost.outputTokensPerAnswer)} للإخراج، أي ≈ ${ev.cost.usdPerAnswer.toFixed(4)} دولار أمريكي لكل إجابة بسعر القائمة`
                : `about ${Math.round(ev.cost.inputTokensPerAnswer)} input and ${Math.round(ev.cost.outputTokensPerAnswer)} output tokens, ≈ $${ev.cost.usdPerAnswer.toFixed(4)} per answer at list price`}</dd></>}
              <dt className="text-ink-2">{t({ en: 'Known limits', ar: 'حدود معروفة' })}</dt><dd>{t({ en: 'Graded by language models; matches genes and change severity, not exact variants; demo hosted outside the UAE.', ar: 'تقيّمه نماذج لغوية؛ يطابق الجينات وشدة التغيّر، لا المتغيّرات بعينها؛ والعرض مستضاف خارج الإمارات.' })}</dd>
            </dl>
          </div>
          <div id="data-card" className="rounded-[3px] border border-ink bg-paper p-6">
            <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'Data card: what the explainer and result screens say', ar: 'بطاقة البيانات: ما تقوله شاشات الشارح والنتيجة' })}</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[14px]" dir={dir}>
              <dt className="text-ink-2">{t({ en: 'Contents', ar: 'المحتوى' })}</dt><dd>{ar
                ? `معلومات بلغتين (عددها ${FACTS.length})؛ وبطاقات حالات بثلاثة مستويات للقراءة (عددها ${Object.keys(CONDITIONS).length})؛ ولوحة جينية (عدد جيناتها ${genes}) مع نسبة الحاملين للتغيّر الجيني في كل جين.`
                : `${FACTS.length} bilingual facts; ${Object.keys(CONDITIONS).length} condition cards at three reading levels; a ${genes}-gene panel with carrier frequencies.`}</dd>
              <dt className="text-ink-2">{t({ en: 'Sources', ar: 'المصادر' })}</dt><dd>{t({ en: 'NSGC, ACMG, MedlinePlus Genetics, Decree-Law 49/2023, Thiqa ART guideline v3.6 (last updated 26 November 2025), Jain et al. 2025, gnomAD v4.1. Each item cites its own.', ar: 'NSGC وACMG وMedlinePlus Genetics والمرسوم بقانون اتحادي رقم 49 لسنة 2023 ودليل ثقة لتقنيات الإنجاب المساعد (الإصدار 3.6، آخر تحديث 26 نوفمبر 2025) وJain et al. 2025 وgnomAD v4.1. ويذكر كل بند مصدره.' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Version', ar: 'النسخة' })}</dt><dd>{t({ en: '2026-10-18, in git; every change is a commit with its tests. Independent code review starts in phase 0.', ar: '\u20662026-10-18\u2069، في git؛ وكل تغيير إيداع (commit) مع اختباراته. تبدأ المراجعة المستقلة للشيفرة في المرحلة 0.' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Clinical review', ar: 'المراجعة السريرية' })}</dt><dd>{t({ en: 'A phase-0 gate: the operator’s genetic counsellors sign off each version before any version reaches patients.', ar: 'شرط في المرحلة 0: يعتمد المرشدون الوراثيون لدى الجهة المشغِّلة كل نسخة قبل أن تصل أي نسخة إلى المرضى.' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Personal data', ar: 'البيانات الشخصية' })}</dt><dd>{t({ en: 'None. All people in the demo are synthetic.', ar: 'لا شيء. كل الأشخاص في العرض افتراضيون.' })}</dd>
              <dt className="text-ink-2">{t({ en: 'Known gaps', ar: 'فجوات معروفة' })}</dt><dd>{t({ en: 'Gene-level and severity-level, not exact variants.', ar: 'على مستوى الجين ومستوى الشدة، لا المتغيّرات بعينها.' })}</dd>
            </dl>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Data protection impact, in one table', ar: 'أثر حماية البيانات في جدول واحد' })}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[14px]" dir={dir}>
              <thead><tr className="border-b-[1.5px] border-ink text-start">
                {FLOW_HEAD.map((h) => <th key={h.en} scope="col" className="py-2.5 pe-4 text-start font-semibold">{t(h)}</th>)}
              </tr></thead>
              <tbody>{FLOWS.map((en, ri) => <tr key={en[0]} className="border-b border-rule align-top">{(ar ? FLOWS_AR[ri] : en).map((x, i) => i === 0 ? <th key={i} scope="row" className="py-3 pe-4 text-start font-medium">{x}</th> : <td key={i} className="py-3 pe-4 leading-relaxed text-ink-2">{x}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>

        <section id="risks" className="mt-16">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Risk register', ar: 'سجل المخاطر' })}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-[14px]" dir={dir}>
              <thead><tr className="border-b-[1.5px] border-ink text-start">
                {RISK_HEAD.map((h) => <th key={h.en} scope="col" className="py-2.5 pe-4 text-start font-semibold">{t(h)}</th>)}
              </tr></thead>
              <tbody>{RISKS.map((en, ri) => { const r = ar ? RISKS_AR[ri] : en; return <tr key={en[0]} className="border-b border-rule align-top"><th scope="row" className="py-3 pe-4 text-start font-medium">{r[0]}</th><td className="py-3 pe-4 leading-relaxed text-ink-2">{r[1]}</td><td className="py-3 pe-4 text-ink-2">{r[2]}</td><td className="py-3 pe-4 text-ink-2">{r[3]}</td><td className={`py-3 pe-4 ${en[4].startsWith('High') ? 'font-medium text-alert' : 'text-ink-2'}`}>{r[4]}</td><td className="py-3 text-ink-2">{r[5]}</td></tr>; })}</tbody>
            </table>
          </div>
        </section>

        <section id="failure-modes" className="mt-16">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Failure modes', ar: 'أنماط الإخفاق' })}</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{t({ en: 'What can fail, what the person sees when it does, and how we would know.', ar: 'ما الذي قد يخفق، وما يراه الشخص عندها، وكيف نعرف.' })}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-[14px]" dir={dir}>
              <thead><tr className="border-b-[1.5px] border-ink text-start">
                {FAILURE_HEAD.map((h) => <th key={h.en} scope="col" className="py-2.5 pe-4 text-start font-semibold">{t(h)}</th>)}
              </tr></thead>
              <tbody>{FAILURES.map((en, ri) => { const r = ar ? FAILURES_AR[ri] : en; return <tr key={en[0]} className="border-b border-rule align-top"><th scope="row" className="py-3 pe-4 text-start font-medium">{r[0]}</th>{r.slice(1).map((c, i) => <td key={i} className="py-3 pe-4 leading-relaxed text-ink-2">{c}</td>)}</tr>; })}</tbody>
            </table>
          </div>
        </section>

        <section id="monitoring" className="mt-16 border-t-[1.5px] border-ink pt-8">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Monitoring, live', ar: 'المراقبة، مباشرة' })}</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{t({ en: 'How explainer answers were produced over the last 30 days on this demo. Only counts are kept: never a question, an answer or a person.', ar: 'كيف أُنتجت إجابات الشارح خلال آخر 30 يوماً في هذا العرض. تُحفظ الأعداد فقط، لا سؤال ولا إجابة ولا شخص.' })}</p>
          <Monitor lang={lang} />
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}
