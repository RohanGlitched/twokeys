// Plain-language condition cards for the genes in the demo. Every card cites its source; wording is
// non-directive and avoids stigma ("carrier is not a disease"). Three reading levels per language.
import type { Locale } from '@/i18n/locales';

/** `arF`: Arabic addressed to a woman, where it differs. */
type L = { en: string; ar: string; arF?: string };
export type Level = 'simple' | 'standard' | 'detailed';

export interface Condition {
  gene: string;
  name: L;
  /** One line: what it does to the body. */
  what: Record<Level, L>;
  /** ACMG-style severity band and what care looks like today. */
  severity: 'profound' | 'severe' | 'moderate' | 'mild' | 'variable';
  care: L;
  /** What being a carrier can mean for the carrier's own health, where that matters. */
  carrierNote?: L;
  source: { label: string; url: string };
}

export const CONDITIONS: Record<string, Condition> = {
  CYP21A2: {
    gene: 'CYP21A2',
    name: { en: 'Congenital adrenal hyperplasia (CAH)', ar: 'تضخم الغدة الكظرية الخلقي' },
    what: {
      simple: {
        en: 'Small glands above the kidneys cannot make enough of some hormones, and a daily medicine treats it. If you know of the chance, tell the team at the birth: a baby can become very ill from losing salt in the first two weeks, sometimes before the newborn test result is back. Boys are the ones most often missed, because nothing shows at birth.',
        ar: 'غدد صغيرة فوق الكليتين لا تصنع ما يكفي من بعض الهرمونات، ويعالجها دواء يومي. إن كنتما تعرفان بهذا الاحتمال فأخبرا فريق الولادة، فقد يمرض المولود بشدة من فقدان الأملاح في الأسبوعين الأولين، وأحياناً قبل وصول نتيجة فحص حديثي الولادة. والأولاد هم الأكثر عرضة لأن يفوت اكتشافهم، لأن شيئاً لا يظهر عليهم عند الولادة.',
      },
      standard: {
        en: 'An enzyme the adrenal glands need to make cortisol is missing or weak. Without treatment, a salt-wasting crisis can come in the first two weeks of life, sometimes before newborn screening results are back, so if you know of the chance, tell the birth team and the baby can be checked in the first days. Boys are the ones most often missed, because nothing shows at birth. Girls may be born with genitals that look different, which doctors can explain and care for. Lifelong hormone medicine works well.',
        ar: 'يغيب أو يضعف إنزيم تحتاجه الغدة الكظرية لصنع الكورتيزول. من دون علاج قد تحدث أزمة فقدان الأملاح في الأسبوعين الأولين من العمر، وأحياناً قبل وصول نتيجة فحص حديثي الولادة، لذا إن كنتما تعرفان بالاحتمال فأخبرا فريق الولادة ليُفحص المولود في أيامه الأولى. والأولاد هم الأكثر عرضة لأن يفوت اكتشافهم، لأن شيئاً لا يظهر عليهم عند الولادة. وقد تولد البنات بأعضاء تناسلية يختلف مظهرها، ويستطيع الأطباء شرح ذلك ورعايته. ويفيد الدواء الهرموني مدى الحياة كثيراً.',
      },
      detailed: {
        en: '21-hydroxylase deficiency. Classic forms (salt-wasting and simple virilising) are found by UAE newborn screening, but a salt-wasting crisis can come in the first two weeks, occasionally within the first five days, before results are back. So if you know of the chance, tell the birth team: the baby can be tested at once. 46,XY boys look typical at birth and are the ones most often missed; 46,XX infants may have atypical genitalia. Prenatal options and their timing are for a genetic counsellor. Non-classic forms are milder and common. Treatment is glucocorticoid and, if needed, mineralocorticoid replacement.',
        ar: 'نقص إنزيم 21-هيدروكسيلاز. الأشكال التقليدية (المُضيّعة للملح والمُذكِّرة البسيطة) يكشفها فحص حديثي الولادة في الإمارات، لكن أزمة فقدان الملح قد تأتي في الأسبوعين الأولين، وأحياناً في الأيام الخمسة الأولى، قبل وصول النتيجة. لذا إن كنتما تعرفان بالاحتمال فأخبرا فريق الولادة ليُفحص المولود فوراً. يبدو الأولاد (46,XY) طبيعيين عند الولادة وهم الأكثر عرضة لأن يفوت اكتشافهم، وقد تكون الأعضاء التناسلية لدى المواليد 46,XX غير نمطية. وخيارات ما قبل الولادة وتوقيتها يشرحها المرشد الوراثي. والشكل غير التقليدي أخف وشائع. العلاج بتعويض الغلوكوكورتيكويد، والمينرالوكورتيكويد عند الحاجة.',
      },
    },
    severity: 'severe',
    care: { en: 'Treatable with daily medicine. If you know of the chance, tell the team at the birth, so the baby is checked in the first days rather than waiting for screening results.', ar: 'قابل للعلاج بدواء يومي. إن كنتما تعرفان بالاحتمال فأخبرا الفريق عند الولادة، ليُفحص المولود في الأيام الأولى دون انتظار نتيجة الفحص.' },
    source: { label: 'MedlinePlus Genetics: congenital adrenal hyperplasia', url: 'https://medlineplus.gov/genetics/condition/21-hydroxylase-deficiency/' },
  },
  HBB: {
    gene: 'HBB',
    name: { en: 'Beta thalassaemia and sickle cell disease', ar: 'الثلاسيميا بيتا وفقر الدم المنجلي' },
    what: {
      simple: {
        en: 'The blood cannot carry oxygen well, so the child tires easily, and some children need a blood transfusion every few weeks. Your premarital blood test shows the exact change each of you has, and a counsellor checks whether your two changes together are serious.',
        ar: 'لا ينقل الدم الأكسجين جيداً، فيتعب الطفل، ويحتاج بعض الأطفال إلى نقل دم كل بضعة أسابيع. ويبيّن فحص الدم قبل الزواج التغيّر المحدد لدى كل منكما، ويتحقق المرشد الوراثي إن كان اجتماع التغيّرين خطيراً.',
      },
      standard: {
        en: 'HBB makes part of haemoglobin. Your premarital blood test (HPLC) shows each partner’s exact change; a counsellor checks whether the pair is serious. Serious pairs are sickle with sickle, sickle with beta-thalassaemia, beta-thalassaemia with beta-thalassaemia, HbE with beta-thalassaemia, HbS with HbC, and HbS with HbD-Punjab or HbO-Arab. They can cause beta thalassaemia major (severe anaemia from early childhood) or sickle cell disease (pain crises, infections). Two HbE changes usually cause only mild anaemia.',
        ar: 'يصنع جين HBB جزءاً من الهيموغلوبين. ويبيّن فحص الدم قبل الزواج (HPLC) التغيّر المحدد لدى كل من الزوجين، ويتحقق المرشد الوراثي إن كان اجتماعهما خطيراً. والأزواج الخطيرة هي: منجلي مع منجلي، ومنجلي مع ثلاسيميا بيتا، وثلاسيميا بيتا مع ثلاسيميا بيتا، وHbE مع ثلاسيميا بيتا، وHbS مع HbC، وHbS مع HbD-Punjab أو HbO-Arab. وقد تسبب الثلاسيميا بيتا الكبرى (فقر دم شديد منذ الطفولة المبكرة) أو فقر الدم المنجلي (نوبات ألم والتهابات). أما اجتماع تغيّرين من نوع HbE فلا يسبب عادة إلا فقر دم خفيفاً.',
      },
      detailed: {
        en: 'Pairs for which the UK screening programme offers prenatal diagnosis: HbS/HbS, HbS/β-thalassaemia (β0, β+, δβ, Lepore), β-thalassaemia/β-thalassaemia, HbE/β-thalassaemia, HbS/HbC, HbS/HbD-Punjab and HbS/HbO-Arab. HbE/HbE and HbC/HbC are mild, and prenatal diagnosis is not indicated. The UAE premarital blood count and HPLC show each partner’s haemoglobin type; DNA testing settles unclear pairs. Severity varies with genotype and with co-inherited alpha-globin changes. Care ranges from folic acid to transfusion and iron chelation; stem-cell transplant and gene therapy can cure some cases.',
        ar: 'الأزواج التي يعرض لها برنامج الفحص البريطاني التشخيص قبل الولادة: HbS/HbS، وHbS/ثلاسيميا بيتا (β0 وβ+ وδβ وLepore)، وثلاسيميا بيتا/ثلاسيميا بيتا، وHbE/ثلاسيميا بيتا، وHbS/HbC، وHbS/HbD-Punjab، وHbS/HbO-Arab. أما HbE/HbE وHbC/HbC فخفيفان ولا يُعرض لهما التشخيص قبل الولادة. ويبيّن تعداد الدم وHPLC في فحص ما قبل الزواج في الإمارات نوع الهيموغلوبين لدى كل شريك، ويحسم الفحص الجيني الأزواج غير الواضحة. وتتفاوت الشدة بحسب التركيب الجيني ووجود تغيّرات في جينات ألفا غلوبين. وتتراوح الرعاية من حمض الفوليك إلى نقل الدم وإزالة الحديد، وقد تشفي زراعة الخلايا الجذعية والعلاج الجيني بعض الحالات.',
      },
    },
    severity: 'severe',
    care: { en: 'Lifelong care; some cases curable by transplant or gene therapy.', ar: 'رعاية مدى الحياة، وبعض الحالات قابلة للشفاء بالزراعة أو العلاج الجيني.' },
    carrierNote: {
      en: 'Beta-thalassaemia carriers can have small red cells and a slightly low blood count, which is harmless; tell your doctor, so it isn’t mistaken for iron deficiency. Sickle-cell carriers should drink well and rest in heat or hard exercise, and mention it before an anaesthetic.',
      ar: 'قد تكون خلايا الدم الحمراء أصغر لدى حامل تغيّر بيتا ثلاسيميا، مع انخفاض بسيط في الدم غير ضار؛ أخبر طبيبك كي لا يُظن أنه نقص حديد. وعلى حامل تغيّر فقر الدم المنجلي أن يشرب الماء جيداً ويرتاح في الحر أو الجهد الشديد، وأن يذكر ذلك قبل أي تخدير.',
      arF: 'قد تكون خلايا الدم الحمراء أصغر لدى حاملة تغيّر بيتا ثلاسيميا، مع انخفاض بسيط في الدم غير ضار؛ أخبري طبيبك كي لا يُظن أنه نقص حديد. وعلى حاملة تغيّر فقر الدم المنجلي أن تشرب الماء جيداً وترتاح في الحر أو الجهد الشديد، وأن تذكر ذلك قبل أي تخدير.',
    },
    source: { label: 'MedlinePlus Genetics: beta thalassemia', url: 'https://medlineplus.gov/genetics/condition/beta-thalassemia/' },
  },
  MEFV: {
    gene: 'MEFV',
    name: { en: 'Familial Mediterranean fever (FMF)', ar: 'حمى البحر الأبيض المتوسط العائلية' },
    what: {
      simple: {
        en: 'Repeated bouts of fever and pain in the belly, chest or joints. A daily medicine prevents most attacks.',
        ar: 'نوبات متكررة من الحمى والألم في البطن أو الصدر أو المفاصل. يمنع دواء يومي معظم النوبات.',
      },
      standard: {
        en: 'An inflammatory condition that causes episodes of fever with pain, usually starting in childhood. Colchicine taken every day prevents attacks and protects the kidneys.',
        ar: 'حالة التهابية تسبب نوبات حمى مع ألم، تبدأ عادة في الطفولة. يمنع الكولشيسين اليومي النوبات ويحمي الكلى.',
      },
      detailed: {
        en: 'Usually autosomal recessive (some single-variant cases occur). Untreated, repeated inflammation can cause AA amyloidosis of the kidneys. Colchicine is first-line; IL-1 blockers for resistant cases.',
        ar: 'وراثة متنحية في الغالب (وتظهر بعض الحالات بمتغير واحد). من دون علاج قد يسبب الالتهاب المتكرر داء النشواني AA في الكلى. الكولشيسين هو الخيار الأول، ومثبطات IL-1 للحالات المقاومة.',
      },
    },
    severity: 'moderate',
    care: { en: 'Well controlled with daily colchicine.', ar: 'يُضبط جيداً بالكولشيسين اليومي.' },
    source: { label: 'MedlinePlus Genetics: familial Mediterranean fever', url: 'https://medlineplus.gov/genetics/condition/familial-mediterranean-fever/' },
  },
  ABCA4: {
    gene: 'ABCA4',
    name: { en: 'Stargardt disease (inherited macular dystrophy)', ar: 'مرض ستارغاردت (ضمور البقعة الصفراء الوراثي)' },
    what: {
      simple: {
        en: 'Central vision slowly gets worse, usually from childhood or the teens. Side vision stays.',
        ar: 'يضعف وسط النظر ببطء، عادة منذ الطفولة أو المراهقة، ويبقى النظر من الجانبين.',
      },
      standard: {
        en: 'Waste builds up in the retina and damages the macula, the part used for reading and faces. There is no cure yet; low-vision aids help, and trials are under way.',
        ar: 'تتراكم فضلات في الشبكية فتتلف البقعة الصفراء المسؤولة عن القراءة ورؤية الوجوه. لا علاج شافياً بعد، وتساعد أدوات ضعف البصر، وتُجرى تجارب سريرية.',
      },
      detailed: {
        en: 'ABCA4 retinopathy spans Stargardt disease to cone-rod dystrophy depending on allele severity; some alleles are hypomorphic and cause late-onset disease.',
        ar: 'يتراوح اعتلال الشبكية المرتبط بـ ABCA4 من مرض ستارغاردت إلى ضمور المخاريط والعصي بحسب شدة المتغيرات، وبعضها ضعيف الأثر ويسبب مرضاً متأخر الظهور.',
      },
    },
    severity: 'moderate',
    care: { en: 'No cure yet; vision support and clinical trials.', ar: 'لا علاج شافياً بعد، مع دعم بصري وتجارب سريرية.' },
    source: { label: 'MedlinePlus Genetics: Stargardt macular degeneration', url: 'https://medlineplus.gov/genetics/condition/stargardt-macular-degeneration/' },
  },
  USH2A: {
    gene: 'USH2A',
    name: { en: 'Usher syndrome type 2 / retinitis pigmentosa', ar: 'متلازمة أشر من النوع الثاني / التنكس الشبكي الصباغي' },
    what: {
      simple: {
        en: 'Hearing loss from birth and night and side vision that fade over the years.',
        ar: 'فقدان سمع منذ الولادة، ورؤية ليلية وجانبية تضعف مع السنين.',
      },
      standard: {
        en: 'Moderate to severe hearing loss from birth, helped by hearing aids, with retinitis pigmentosa that narrows vision from the teens. Some USH2A changes cause the eye condition alone.',
        ar: 'فقدان سمع متوسط إلى شديد منذ الولادة تساعده السماعات، مع التنكس الشبكي الصباغي الذي يضيّق مجال الرؤية منذ المراهقة. وبعض تغيّرات USH2A تسبب حالة العين وحدها.',
      },
      detailed: {
        en: 'Usher syndrome 2A or non-syndromic autosomal recessive RP, depending on alleles. Hearing aids or cochlear implants; RNA and gene therapies are in trials.',
        ar: 'متلازمة أشر 2A أو التنكس الشبكي الصباغي المتنحي غير المتلازمي بحسب المتغيرات. السماعات أو زراعة القوقعة، والعلاجات الجينية والـ RNA قيد التجارب.',
      },
    },
    severity: 'moderate',
    care: { en: 'Hearing support; vision care; therapies in trials.', ar: 'دعم السمع ورعاية البصر وعلاجات قيد التجارب.' },
    source: { label: 'MedlinePlus Genetics: Usher syndrome', url: 'https://medlineplus.gov/genetics/condition/usher-syndrome/' },
  },
  HBA: {
    gene: 'HBA',
    name: { en: 'Alpha thalassaemia', ar: 'الثلاسيميا ألفا' },
    what: {
      simple: {
        en: 'Everyone has four alpha genes, two from each parent. Missing one or two is common here and usually causes no illness. What a child could inherit depends on the exact genes each of you has on each side, so a counsellor checks your results. The most serious form, before birth, is possible only if both of you carry a change that removes two genes together.',
        ar: 'لكل إنسان أربعة جينات ألفا، اثنان من كل والد. وغياب جين أو اثنين شائع هنا ولا يسبب مرضاً عادة. وما قد يرثه الطفل يعتمد على الجينات المحددة لدى كل منكما على كل جانب، لذا يراجع المرشد الوراثي نتيجتيكما. والشكل الأخطر، قبل الولادة، لا يحدث إلا إذا حمل كلاكما تغيّراً يحذف جينين معاً.',
      },
      standard: {
        en: 'There are four alpha-globin genes, two on the chromosome from each parent. Each chromosome can be αα (both work), −α (one missing, the alpha-plus type common in the UAE) or −− (both missing, the alpha-zero type). A child of two −α parents can at most inherit −α/−α, which is usually silent. HbH disease, a lifelong anaemia, comes from three genes lost (−−/−α) or from some changes that stop a gene working without deleting it: two copies of αT-Saudi can cause HbH disease even though each parent carries only an alpha-plus change, and Hb Constant Spring makes HbH disease more severe. Hb Bart’s hydrops before birth needs −− from both parents, so it cannot happen when only alpha-plus changes are involved. A counsellor checks each of your two copies.',
        ar: 'هناك أربعة جينات لألفا غلوبين، اثنان على الكروموسوم الآتي من كل والد. وقد يكون كل كروموسوم αα (يعمل الجينان) أو −α (غياب جين، وهو نوع ألفا+ الشائع في الإمارات) أو −− (غياب الجينين، وهو نوع ألفا صفر). وطفل والدين لدى كل منهما −α يرث في أقصى حال −α/−α، ولا يسبب ذلك أعراضاً عادة. ومرض الهيموغلوبين H، وهو فقر دم مدى الحياة، ينتج عن فقدان ثلاثة جينات (−−/−α) أو عن تغيّرات توقف الجين دون حذفه: فنسختان من αT-Saudi قد تسببان مرض الهيموغلوبين H مع أن كل والد لا يحمل إلا تغيّراً من نوع ألفا+، وHb Constant Spring يجعل مرض الهيموغلوبين H أشد. أما استسقاء الجنين بخضاب بارت قبل الولادة فيتطلب −− من الوالدين كليهما، فلا يحدث حين تقتصر التغيّرات على نوع ألفا+. ويراجع المرشد الوراثي النسختين لدى كل منكما.',
      },
      detailed: {
        en: 'Haplotypes: αα, −α (α+: −α3.7, −α4.2), −− (α0: −−MED, −−SEA) and non-deletional α+ variants (αTα, e.g. αT-Saudi, HBA2 c.*94A>G in the poly(A) signal; Hb Constant Spring). −α/−α or −−/αα gives trait; −−/−α gives deletional HbH disease; −−/αCSα gives HbH-Constant Spring, often transfusion-dependent; αT-Saudi homozygosity (αTα/αTα) gives HbH disease without any α0 allele; −−/−− gives Hb Bart’s hydrops (with maternal pre-eclampsia risk). So Hb Bart’s needs an α0 allele from each partner. Cis versus trans arrangement decides it, and short-read sequencing can miss deletions and non-deletional variants; confirmation needs gap-PCR, MLPA or sequencing of HBA1/HBA2.',
        ar: 'الأنماط: αα، و−α (ألفا+: −α3.7، −α4.2)، و−− (ألفا صفر: −−MED، −−SEA)، ومتغيرات ألفا+ غير الحذفية (αTα، مثل αT-Saudi وهو HBA2 c.*94A>G في إشارة poly(A)؛ وHb Constant Spring). −α/−α أو −−/αα يعطي السمة؛ و−−/−α يعطي مرض الهيموغلوبين H الحذفي؛ و−−/αCSα يعطي HbH-Constant Spring وكثيراً ما يحتاج نقل دم؛ وتماثل αT-Saudi (αTα/αTα) يعطي مرض الهيموغلوبين H دون أي أليل ألفا صفر؛ و−−/−− يعطي استسقاء الجنين بخضاب بارت (مع خطر تسمم الحمل على الأم). فخضاب بارت يتطلب أليل ألفا صفر من كل شريك. ويحدد ذلك ترتيب الحذف على الكروموسوم نفسه أو على الكروموسومين، وقد يفوت التسلسل القصير الحذوف والمتغيرات غير الحذفية، فيلزم تأكيد بـ gap-PCR أو MLPA أو تسلسل HBA1/HBA2.',
      },
    },
    severity: 'variable',
    care: { en: 'Often silent. HbH disease needs specialist care; Hb Bart’s hydrops needs specialist care in pregnancy.', ar: 'غالباً بلا أعراض. ويحتاج مرض الهيموغلوبين H إلى رعاية متخصصة، ويحتاج استسقاء الجنين بخضاب بارت إلى رعاية متخصصة أثناء الحمل.' },
    carrierNote: {
      en: 'Carriers can have small red cells and a slightly low blood count, which is harmless; tell your doctor, so it isn’t mistaken for iron deficiency.',
      ar: 'قد تكون خلايا الدم الحمراء أصغر لدى حامل هذا التغيّر، مع انخفاض بسيط في الدم غير ضار؛ أخبر طبيبك كي لا يُظن أنه نقص حديد.',
      arF: 'قد تكون خلايا الدم الحمراء أصغر لدى حاملة هذا التغيّر، مع انخفاض بسيط في الدم غير ضار؛ أخبري طبيبك كي لا يُظن أنه نقص حديد.',
    },
    source: { label: 'MedlinePlus Genetics: alpha thalassemia', url: 'https://medlineplus.gov/genetics/condition/alpha-thalassemia/' },
  },
  GJB2: {
    gene: 'GJB2',
    name: { en: 'Inherited hearing loss (GJB2)', ar: 'فقدان السمع الوراثي (GJB2)' },
    what: {
      simple: {
        en: 'A child may be born hard of hearing or deaf. Hearing is checked at birth, and early support works well.',
        ar: 'قد يولد الطفل بضعف في السمع أو صمم. يُفحص السمع عند الولادة، ويفيد الدعم المبكر كثيراً.',
      },
      standard: {
        en: 'The most common genetic cause of hearing loss present at birth. Hearing aids, cochlear implants and sign language all help children thrive.',
        ar: 'أشيع سبب وراثي لفقدان السمع الخلقي. تساعد السماعات وزراعة القوقعة ولغة الإشارة الأطفال على النمو بشكل جيد.',
      },
      detailed: {
        en: 'Connexin 26. Severity ranges from mild (e.g. two copies of p.Val37Ile) to profound (e.g. c.35delG). Newborn hearing screening detects most cases.',
        ar: 'الكونيكسين 26. تتراوح الشدة من خفيفة (مثل p.Val37Ile الذي يسبب غالباً فقداناً خفيفاً) إلى عميقة (مثل c.35delG). يكشف فحص سمع حديثي الولادة معظم الحالات.',
      },
    },
    severity: 'moderate',
    care: { en: 'Early hearing support; implants for profound loss.', ar: 'دعم سمعي مبكر، وزراعة قوقعة للفقدان العميق.' },
    source: { label: 'MedlinePlus Genetics: nonsyndromic hearing loss', url: 'https://medlineplus.gov/genetics/condition/nonsyndromic-hearing-loss/' },
  },
  G6PD: {
    gene: 'G6PD',
    name: { en: 'G6PD deficiency', ar: 'نقص إنزيم G6PD (أنيميا الفول)' },
    what: {
      simple: {
        en: 'Red blood cells can break down after eating fava beans, being near mothballs or taking some medicines. Avoiding these keeps most people well.',
        ar: 'قد تتكسر خلايا الدم الحمراء بعد أكل الفول أو التعرض لكرات النفثالين (كرات العثّ) أو تناول بعض الأدوية. تجنّب ذلك يحفظ صحة معظم الناس.',
      },
      standard: {
        en: 'X-linked: boys are affected more often, and some girls who carry it are affected too. Most people have no symptoms unless exposed to a trigger: fava beans, some medicines such as certain antimalarials and sulfonamide (sulfa) medicines, naphthalene in mothballs, and infections. Telling any doctor, dentist or pharmacist avoids most problems. It can also cause jaundice in newborns.',
        ar: 'مرتبط بالكروموسوم X: يتأثر الذكور أكثر، وتتأثر أيضاً بعض الإناث اللواتي يحملنه. لا تظهر أعراض عند معظم الناس إلا عند التعرض لمحفّز: الفول، وبعض الأدوية مثل بعض أدوية الملاريا وأدوية السلفوناميد (السلفا)، والنفثالين في كرات العثّ، والعدوى. وإخبار أي طبيب أو طبيب أسنان أو صيدلي يجنّب معظم المشكلات. وقد يسبب أيضاً اليرقان لدى حديثي الولادة.',
      },
      detailed: {
        en: 'Acute haemolysis after oxidative triggers: fava beans, naphthalene, antimalarials (primaquine, quinine and others), sulfonamides including co-trimoxazole, dapsone, nitrofurantoin, quinolones, rasburicase, methylene blue, high-dose aspirin, and infections. Neonatal jaundice may need treatment. Heterozygous females can be affected through skewed X-inactivation. Common in the Gulf; Abu Dhabi newborn screening has included it.',
        ar: 'انحلال دموي حاد بعد المحفزات المؤكسدة: الفول، والنفثالين، وأدوية الملاريا (البريماكين والكينين وغيرهما)، والسلفوناميدات ومنها الكوتريموكسازول، والدابسون، والنتروفورانتوين، والكينولونات، والراسبوريكاز، وأزرق الميثيلين، والأسبرين بجرعات عالية، والعدوى. وقد يحتاج يرقان حديثي الولادة إلى علاج. وقد تتأثر الإناث الحاملات بسبب عدم تكافؤ تعطيل الكروموسوم X. شائع في الخليج، وقد شمله فحص حديثي الولادة في أبوظبي.',
      },
    },
    severity: 'mild',
    care: { en: 'Avoid triggers; usually no treatment needed.', ar: 'تجنّب المحفزات، ولا يلزم علاج عادة.' },
    carrierNote: { en: 'Some women who carry it have symptoms too; avoiding the same triggers is sensible.', ar: 'قد تظهر أعراض لدى بعض النساء اللواتي يحملن هذا التغيّر، فمن المفيد تجنّب المحفزات نفسها.' },
    source: { label: 'MedlinePlus: G6PD deficiency, with the triggers to avoid', url: 'https://medlineplus.gov/ency/article/000528.htm' },
  },
  CYP1B1: {
    gene: 'CYP1B1',
    name: { en: 'Primary congenital glaucoma', ar: 'الزرق (الجلوكوما) الخلقي الأولي' },
    what: {
      simple: {
        en: 'Pressure builds inside a baby’s eye. Found early, surgery can protect sight.',
        ar: 'يرتفع الضغط داخل عين الرضيع. عند اكتشافه مبكراً تحمي الجراحة البصر.',
      },
      standard: {
        en: 'The eye’s drainage system does not form properly, so pressure rises in the first years of life. Large, cloudy or watery eyes are early signs. Surgery in infancy usually saves vision.',
        ar: 'لا يتكوّن نظام تصريف السائل في العين بشكل سليم، فيرتفع الضغط في السنوات الأولى. العيون الكبيرة أو الغائمة أو الدامعة علامات مبكرة. والجراحة في الرضاعة تنقذ البصر غالباً.',
      },
      detailed: {
        en: 'CYP1B1 is the main gene for autosomal recessive primary congenital glaucoma, which is more common in consanguineous populations. Goniotomy or trabeculotomy are first-line.',
        ar: 'CYP1B1 هو الجين الرئيس للزرق الخلقي الأولي المتنحي، وهو أشيع في المجتمعات ذات زواج الأقارب. وجراحة بضع الزاوية أو بضع التربيق هي الخيار الأول.',
      },
    },
    severity: 'severe',
    care: { en: 'Early surgery usually protects sight.', ar: 'الجراحة المبكرة تحمي البصر غالباً.' },
    source: { label: 'MedlinePlus Genetics: primary congenital glaucoma', url: 'https://medlineplus.gov/genetics/condition/primary-congenital-glaucoma/' },
  },
  SMN1: {
    gene: 'SMN1',
    name: { en: 'Spinal muscular atrophy (SMA)', ar: 'ضمور العضلات الشوكي' },
    what: {
      simple: {
        en: 'The child’s muscles weaken, and breathing and swallowing can become hard. New medicines help most when started before any sign shows.',
        ar: 'تضعف عضلات الطفل، وقد يصعب عليه التنفس والبلع. تساعد الأدوية الجديدة أكثر إذا بدأت قبل ظهور أي علامة.',
      },
      standard: {
        en: 'Motor neurons in the spinal cord are lost, causing weakness that can affect breathing and swallowing. Gene and drug therapies now change the outlook, especially when given before symptoms.',
        ar: 'تُفقد الخلايا العصبية الحركية في الحبل الشوكي، فيحدث ضعف قد يؤثر على التنفس والبلع. غيّرت العلاجات الجينية والدوائية التوقعات، خصوصاً عند إعطائها قبل ظهور الأعراض.',
      },
      detailed: {
        en: 'Homozygous SMN1 loss (usually exon 7 deletion); SMN2 copy number modifies severity. Treatments: nusinersen, risdiplam, onasemnogene abeparvovec. Carrier testing must count SMN1 copies (2+0 “silent” carriers are missed).',
        ar: 'فقدان SMN1 المتماثل (غالباً حذف الإكسون 7)، ويعدّل عدد نسخ SMN2 الشدة. العلاجات: نوسينيرسن، ريسديبلام، أوناسيمنوجين. يجب أن يعدّ فحص الكشف عن الصفة الوراثية نسخ SMN1 (فمن يحملون نمط 2+0 "الصامت" قد يُغفلون).',
      },
    },
    severity: 'profound',
    care: { en: 'New treatments; best started before symptoms.', ar: 'علاجات حديثة، والأفضل البدء بها قبل الأعراض.' },
    source: { label: 'MedlinePlus Genetics: spinal muscular atrophy', url: 'https://medlineplus.gov/genetics/condition/spinal-muscular-atrophy/' },
  },
  // Cards below cover the next most common shared genes in the calibration model (data/calibration.json,
  // geneShareTop40), in order. Each cites the public page its wording was checked against.
  MCCC2: {
    gene: 'MCCC2',
    name: { en: '3-MCC deficiency (3-methylcrotonyl-CoA carboxylase deficiency)', ar: 'نقص إنزيم 3-MCC (ميثيل كروتونيل مرافق الإنزيم A كربوكسيلاز)' },
    what: {
      simple: {
        en: 'The body has trouble breaking down part of protein. Many children with it never have any problem. A few become unwell during an illness or after a long time without food.',
        ar: 'يجد الجسم صعوبة في تفكيك جزء من البروتين. كثير من الأطفال المصابين به لا يواجهون أي مشكلة أبداً، وقلة منهم يتوعّكون أثناء مرض أو بعد مدة طويلة دون طعام.',
      },
      standard: {
        en: 'An enzyme that breaks down leucine, a building block of protein, does not work well. Many people with this condition never have symptoms. Others, usually as babies or young children, have feeding difficulties, vomiting, tiredness or weak muscles, often after an infection, a long gap without food or a high-protein diet. Avoiding long fasts, especially during illness, helps prevent episodes.',
        ar: 'لا يعمل جيداً إنزيم يفكك الليوسين، وهو من مكوّنات البروتين. كثير من المصابين بهذه الحالة لا تظهر عليهم أعراض أبداً. وتظهر لدى آخرين، غالباً في الرضاعة أو الطفولة المبكرة، صعوبة في الرضاعة أو تقيؤ أو تعب أو ضعف في العضلات، وكثيراً ما يكون ذلك بعد عدوى أو انقطاع طويل عن الطعام أو نظام غذائي غني بالبروتين. ويساعد تجنّب الصيام الطويل، خصوصاً أثناء المرض، على منع النوبات.',
      },
      detailed: {
        en: 'Biallelic MCCC2 (or MCCC1) variants reduce leucine catabolism. The spectrum is wide: most people identified never develop signs, while a minority have episodes of vomiting, lethargy and hypotonia, or developmental delay, typically triggered by infection, fasting or a protein load. Management is preventive: avoid prolonged fasting, have an illness plan, and moderate protein where a metabolic team advises it.',
        ar: 'تقلّل المتغيرات في نسختي MCCC2 (أو MCCC1) تفكيك الليوسين. والطيف واسع: معظم من يُكتشفون لا تظهر عليهم علامات أبداً، بينما تحدث لدى قلة نوبات تقيؤ وخمول وارتخاء عضلي، أو تأخر في النمو، تثيرها عادة العدوى أو الصيام أو حمل البروتين. والرعاية وقائية: تجنّب الصيام الطويل، وخطة للتعامل مع المرض، والاعتدال في البروتين حين ينصح بذلك فريق الأمراض الاستقلابية.',
      },
    },
    severity: 'variable',
    care: { en: 'Often needs no treatment; avoiding long fasts during illness helps.', ar: 'كثيراً ما لا يحتاج إلى علاج، ويساعد تجنّب الصيام الطويل أثناء المرض.' },
    source: { label: 'MedlinePlus Genetics: 3-methylcrotonyl-CoA carboxylase deficiency', url: 'https://medlineplus.gov/genetics/condition/3-methylcrotonyl-coa-carboxylase-deficiency/' },
  },
  PAH: {
    gene: 'PAH',
    name: { en: 'Phenylketonuria (PKU)', ar: 'بيلة الفينيل كيتون' },
    what: {
      simple: {
        en: 'The body cannot break down phenylalanine, found in protein foods. The newborn test finds it, and a special diet started early protects the brain.',
        ar: 'لا يستطيع الجسم تفكيك الفينيل ألانين الموجود في الأطعمة البروتينية. يكشفه فحص حديثي الولادة، ويحمي نظام غذائي خاص يبدأ مبكراً الدماغ.',
      },
      standard: {
        en: 'Without treatment, phenylalanine builds up and harms the developing brain. Newborn screening finds most cases soon after birth, so treatment starts quickly. A low-phenylalanine diet, which limits high-protein foods and the sweetener aspartame and is planned with a dietitian, lets children grow and learn well. Some forms are milder and need little or no treatment.',
        ar: 'من دون علاج يتراكم الفينيل ألانين ويضر الدماغ النامي. يكشف فحص حديثي الولادة معظم الحالات بعد الولادة بقليل، فيبدأ العلاج سريعاً. ونظام غذائي قليل الفينيل ألانين، يحدّ من الأطعمة الغنية بالبروتين ومن المُحلّي أسبارتام ويُخطَّط مع اختصاصي تغذية، يتيح للأطفال أن ينموا ويتعلموا جيداً. وبعض الأشكال أخف ولا تحتاج إلا قليلاً من العلاج أو لا تحتاجه.',
      },
      detailed: {
        en: 'Phenylalanine hydroxylase deficiency, from classic PKU to mild hyperphenylalaninaemia depending on the two alleles (for example, A403V is mild). Lifelong dietary management; sapropterin helps some, and pegvaliase is another option. Women with PKU need good control before and during pregnancy, because high levels harm the baby (maternal PKU).',
        ar: 'نقص إنزيم فينيل ألانين هيدروكسيلاز، من بيلة الفينيل كيتون التقليدية إلى ارتفاع فينيل ألانين الدم الخفيف بحسب الأليلين (A403V مثلاً خفيف). الرعاية الغذائية مدى الحياة، ويفيد السابروبترين بعض المرضى، والبيغفاليز خيار آخر. وتحتاج المرأة المصابة إلى ضبط جيد قبل الحمل وأثناءه، لأن ارتفاع المستوى يضر الجنين (بيلة الفينيل كيتون الأمومية).',
      },
    },
    severity: 'severe',
    care: { en: 'Treatable with a lifelong special diet; found by newborn screening.', ar: 'قابل للعلاج بنظام غذائي خاص مدى الحياة، ويكشفه فحص حديثي الولادة.' },
    source: { label: 'MedlinePlus Genetics: phenylketonuria', url: 'https://medlineplus.gov/genetics/condition/phenylketonuria/' },
  },
  SGCG: {
    gene: 'SGCG',
    name: { en: 'Limb-girdle muscular dystrophy (gamma-sarcoglycan)', ar: 'الحثل العضلي الحزامي (غاما ساركوغليكان)' },
    what: {
      simple: {
        en: 'The muscles around the hips and shoulders slowly weaken, often from childhood. Over the years, walking can become hard.',
        ar: 'تضعف ببطء العضلات حول الوركين والكتفين، وكثيراً ما يبدأ ذلك في الطفولة. ومع السنين قد يصعب المشي.',
      },
      standard: {
        en: 'One of the limb-girdle muscular dystrophies. Weakness starts in the muscles around the hips and shoulders, can appear in childhood, and worsens over time; early signs include a waddling walk, toe-walking or trouble running, and some people later need a wheelchair. The heart and the breathing muscles can be affected, so regular checks matter. There is no cure yet; physiotherapy and heart and breathing care help.',
        ar: 'أحد أنواع الحثل العضلي الحزامي. يبدأ الضعف في العضلات حول الوركين والكتفين، وقد يظهر في الطفولة ويزداد مع الوقت؛ ومن العلامات المبكرة المشي المتمايل أو على أطراف الأصابع أو صعوبة الركض، ويحتاج بعض المصابين لاحقاً إلى كرسي متحرك. وقد يتأثر القلب وعضلات التنفس، لذا تهم الفحوص المنتظمة. لا علاج شافياً بعد، ويساعد العلاج الطبيعي ورعاية القلب والتنفس.',
      },
      detailed: {
        en: 'Gamma-sarcoglycanopathy (LGMD R5, formerly LGMD 2C), from biallelic SGCG variants; one of more than 30 genes behind limb-girdle muscular dystrophy, mostly autosomal recessive. Proximal weakness progresses; cardiomyopathy and respiratory muscle weakness can occur, and some people need ventilation, so cardiac and respiratory surveillance is part of care. Treatment is supportive.',
        ar: 'اعتلال غاما ساركوغليكان (LGMD R5، وسابقاً LGMD 2C)، من متغيرات في نسختي SGCG؛ وهو أحد أكثر من 30 جيناً وراء الحثل العضلي الحزامي، وأغلبها متنحٍّ. يتقدم الضعف القريب من الجذع، وقد يحدث اعتلال عضلة القلب وضعف عضلات التنفس، ويحتاج بعض المرضى إلى التنفس الاصطناعي، لذا تشمل الرعاية متابعة القلب والتنفس. والعلاج داعم.',
      },
    },
    severity: 'moderate',
    care: { en: 'No cure yet; physiotherapy, heart and breathing checks.', ar: 'لا علاج شافياً بعد؛ علاج طبيعي وفحوص للقلب والتنفس.' },
    source: { label: 'MedlinePlus Genetics: limb-girdle muscular dystrophy', url: 'https://medlineplus.gov/genetics/condition/limb-girdle-muscular-dystrophy/' },
  },
  DONSON: {
    gene: 'DONSON',
    name: { en: 'Microcephaly-micromelia syndrome (DONSON)', ar: 'متلازمة صغر الرأس وقصر الأطراف (DONSON)' },
    what: {
      simple: {
        en: 'A rare condition in which a baby grows very little in the womb, with a small head and short arms and legs. Sadly, babies with this condition have not survived long after birth. A genetic counsellor can explain the choices open to you.',
        ar: 'حالة نادرة ينمو فيها الجنين قليلاً جداً في الرحم، مع صغر في الرأس وقصر في الذراعين والساقين. ومن المؤسف أن الأطفال المصابين بها لم يعيشوا طويلاً بعد الولادة. ويستطيع المرشد الوراثي أن يشرح لكما الخيارات المتاحة.',
      },
      standard: {
        en: 'The baby grows very little before birth, with a small head and short arms and legs, often with missing thumbs or forearm bones. In the families reported so far, babies died before or shortly after birth. It has been reported in an Emirati family. Carriers are healthy. A genetic counsellor can explain what testing is possible in a pregnancy and the other options, such as IVF with embryo testing.',
        ar: 'ينمو الجنين قليلاً جداً قبل الولادة، مع صغر في الرأس وقصر في الذراعين والساقين، وكثيراً ما تغيب الإبهامان أو عظام الساعد. وفي الأسر التي وُصفت حتى الآن توفي الأطفال قبل الولادة أو بعدها بقليل. وقد وُصفت الحالة في أسرة إماراتية. والحاملون للتغيّر أصحّاء. ويستطيع المرشد الوراثي أن يشرح ما يمكن فحصه أثناء الحمل والخيارات الأخرى، مثل أطفال الأنابيب مع فحص الأجنة.',
      },
      detailed: {
        en: 'Microcephaly-micromelia syndrome (MIMIS) from biallelic loss-of-function DONSON variants: the founder c.1047-9A>G (reported in Cree and Saudi families) and c.763C>T (p.Gln255*) in an Emirati first-cousin family. Severe growth restriction, microcephaly, upper-limb-predominant reduction defects (absent radius or ulna and thumbs), short legs with fibular hypoplasia; anophthalmia in the Emirati newborns. Outcome is intrauterine or perinatal death. Prenatal diagnosis and PGT-M are options for a genetic counsellor to discuss.',
        ar: 'متلازمة صغر الرأس وقصر الأطراف (MIMIS) من متغيرات فاقدة للوظيفة في نسختي DONSON: المتغير المؤسِّس c.1047-9A>G (وُصف في أسر من الكري ومن السعودية) وc.763C>T (p.Gln255*) في أسرة إماراتية الوالدان فيها أبناء عمومة. تأخر نمو شديد، وصغر الرأس، وعيوب نقص تغلب في الأطراف العلوية (غياب الكعبرة أو الزند والإبهامين)، وساقان قصيرتان مع نقص تنسّج الشظية؛ وغياب العينين لدى المولودين الإماراتيين. والنتيجة وفاة داخل الرحم أو حول الولادة. والتشخيص قبل الولادة وفحص الأجنة (PGT-M) خياران يناقشهما المرشد الوراثي.',
      },
    },
    severity: 'profound',
    care: { en: 'No treatment; a genetic counsellor explains the options before and during pregnancy.', ar: 'لا علاج له؛ ويشرح المرشد الوراثي الخيارات قبل الحمل وأثناءه.' },
    source: { label: 'Molecular Syndromology 2019: DONSON microcephaly-micromelia syndrome in an Emirati family', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6528082/' },
  },
  F7: {
    gene: 'F7',
    name: { en: 'Factor VII deficiency (a bleeding disorder)', ar: 'نقص العامل السابع (اضطراب نزفي)' },
    what: {
      simple: {
        en: 'The blood takes longer to clot. Many people have only mild bleeding or none; a few have serious bleeding from babyhood. Bleeding can be treated.',
        ar: 'يستغرق تجلط الدم وقتاً أطول. لدى كثير من الناس نزف خفيف فقط أو لا نزف، ولدى قلة نزف خطير منذ الرضاعة. ويمكن علاج النزف.',
      },
      standard: {
        en: 'Factor VII is one of the proteins that make blood clot. Up to a third of people with the condition never have bleeding problems. Others have nosebleeds, bleeding gums, easy bruising, heavy periods, or long bleeding after injury or surgery. The most severe cases show in infancy and can include bleeding inside the head or gut. A clotting-factor medicine treats bleeding and covers surgery.',
        ar: 'العامل السابع أحد البروتينات التي تجعل الدم يتجلط. ما يصل إلى ثلث المصابين لا يعانون أبداً من مشكلات نزف. ولدى آخرين نزف من الأنف أو اللثة، أو كدمات بسهولة، أو دورة شهرية غزيرة، أو نزف طويل بعد إصابة أو جراحة. وتظهر أشد الحالات في الرضاعة وقد تشمل نزفاً داخل الرأس أو الأمعاء. ويعالج دواء من عوامل التجلط النزفَ ويغطي الجراحة.',
      },
      detailed: {
        en: 'Congenital factor VII deficiency from biallelic F7 variants. Bleeding ranges from none to severe; severe cases present in infancy with intracranial or gastrointestinal haemorrhage, and a few people have thrombosis instead. Recombinant activated factor VII treats bleeding and is used around surgery.',
        ar: 'نقص العامل السابع الخلقي من متغيرات في نسختي F7. يتراوح النزف من لا شيء إلى الشديد؛ وتظهر الحالات الشديدة في الرضاعة بنزف داخل القحف أو في الجهاز الهضمي، ولدى قلة خثار بدل النزف. ويعالج العامل السابع المنشَّط المؤتلف النزفَ ويُستخدم حول الجراحة.',
      },
    },
    severity: 'variable',
    care: { en: 'Treatable: clotting-factor medicine for bleeding and before surgery.', ar: 'قابل للعلاج: دواء من عوامل التجلط للنزف وقبل الجراحة.' },
    source: { label: 'MedlinePlus Genetics: factor VII deficiency', url: 'https://medlineplus.gov/genetics/condition/factor-vii-deficiency/' },
  },
  ABCA12: {
    gene: 'ABCA12',
    name: { en: 'Congenital ichthyosis (ABCA12), including harlequin ichthyosis', ar: 'السماك الخلقي (ABCA12)، ومنه السماك المهرّجي' },
    what: {
      simple: {
        en: 'The skin does not form its protective layer properly, so a baby is born with thick, hard or scaly skin. Babies need special care in hospital, and lifelong skin care.',
        ar: 'لا تتكوّن الطبقة الواقية للجلد بشكل سليم، فيولد الطفل بجلد سميك أو قاسٍ أو متقشر. ويحتاج الرضيع إلى رعاية خاصة في المستشفى، وإلى عناية بالجلد مدى الحياة.',
      },
      standard: {
        en: 'ABCA12 helps build the skin’s barrier. Depending on the two changes, a baby can be born with harlequin ichthyosis, with hard, thick plates of skin that make it hard to keep fluids in and raise the risk of infection, or with a milder form with red, scaly skin. Babies with the severe form need intensive newborn care. Retinoid medicines and careful skin care help.',
        ar: 'يساعد جين ABCA12 على بناء حاجز الجلد. وبحسب التغيّرين قد يولد الطفل بالسماك المهرّجي، بصفائح جلدية سميكة قاسية تُصعّب الحفاظ على سوائل الجسم وتزيد خطر العدوى، أو بشكل أخف بجلد أحمر متقشر. ويحتاج الرضّع المصابون بالشكل الشديد إلى رعاية مركّزة لحديثي الولادة. وتساعد أدوية الريتينويد والعناية الدقيقة بالجلد.',
      },
      detailed: {
        en: 'ABCA12 transports lipids in the epidermis. Variants that abolish the protein cause harlequin ichthyosis, and infants without any ABCA12 protein often do not survive infancy, from dehydration and infection; other variants cause nonbullous congenital ichthyosiform erythroderma or lamellar ichthyosis type 2, which are milder. Care: neonatal intensive care, oral retinoids, emollients.',
        ar: 'ينقل ABCA12 الدهون في البشرة. والمتغيرات التي تلغي البروتين تسبب السماك المهرّجي، وكثيراً ما لا ينجو الرضّع الذين يغيب لديهم البروتين تماماً، بسبب الجفاف والعدوى؛ ومتغيرات أخرى تسبب الحمامى الجلدية السماكية الخلقية غير الفقاعية أو السماك الصفائحي من النوع 2، وهما أخف. الرعاية: عناية مركّزة لحديثي الولادة، وريتينويدات فموية، ومرطبات.',
      },
    },
    severity: 'variable',
    care: { en: 'Intensive newborn care for the severe form; lifelong skin care and retinoids.', ar: 'رعاية مركّزة لحديثي الولادة في الشكل الشديد، وعناية بالجلد وريتينويدات مدى الحياة.' },
    source: { label: 'MedlinePlus Genetics: harlequin ichthyosis', url: 'https://medlineplus.gov/genetics/condition/harlequin-ichthyosis/' },
  },
  SLC26A4: {
    gene: 'SLC26A4',
    name: { en: 'Pendred syndrome and inherited hearing loss (SLC26A4)', ar: 'متلازمة بندريد وفقدان السمع الوراثي (SLC26A4)' },
    what: {
      simple: {
        en: 'A child may be born deaf or hard of hearing. Hearing is checked at birth, and early support works well. Some people later get a swelling of the thyroid in the neck.',
        ar: 'قد يولد الطفل بصمم أو ضعف في السمع. يُفحص السمع عند الولادة، ويفيد الدعم المبكر كثيراً. وقد يظهر لدى بعضهم لاحقاً تضخم في الغدة الدرقية في الرقبة.',
      },
      standard: {
        en: 'Hearing loss, usually severe to profound and present at birth, linked to a differently shaped inner ear (an enlarged vestibular aqueduct). Some people have balance problems. In Pendred syndrome a goitre (an enlarged thyroid) often forms between late childhood and early adulthood, usually with normal thyroid function. Hearing aids, cochlear implants and sign language help children thrive.',
        ar: 'فقدان سمع، غالباً شديد إلى عميق وموجود منذ الولادة، مرتبط باختلاف في شكل الأذن الداخلية (اتساع القناة الدهليزية). ولدى بعضهم مشكلات في التوازن. وفي متلازمة بندريد كثيراً ما يتكوّن تضخم في الغدة الدرقية بين أواخر الطفولة وبداية البلوغ، وتبقى وظيفة الدرقية عادة طبيعية. وتساعد السماعات وزراعة القوقعة ولغة الإشارة الأطفال على النمو بشكل جيد.',
      },
      detailed: {
        en: 'SLC26A4 (pendrin) causes Pendred syndrome or nonsyndromic DFNB4, with an enlarged vestibular aqueduct, often with a Mondini cochlea. The goitre is usually euthyroid; a few people have thyroid hypoplasia and congenital hypothyroidism. Care: hearing aids or cochlear implants, vestibular assessment, thyroid follow-up.',
        ar: 'يسبب SLC26A4 (البندرين) متلازمة بندريد أو فقدان السمع غير المتلازمي DFNB4، مع اتساع القناة الدهليزية، وكثيراً مع قوقعة موندينية. ويكون تضخم الدرقية عادة مع وظيفة طبيعية، ولدى قلة نقص تنسّج الدرقية وقصورها الخلقي. الرعاية: سماعات أو زراعة قوقعة، وتقييم التوازن، ومتابعة الدرقية.',
      },
    },
    severity: 'moderate',
    care: { en: 'Early hearing support; thyroid checks.', ar: 'دعم سمعي مبكر وفحوص للغدة الدرقية.' },
    source: { label: 'MedlinePlus Genetics: Pendred syndrome', url: 'https://medlineplus.gov/genetics/condition/pendred-syndrome/' },
  },
  ITGB3: {
    gene: 'ITGB3',
    name: { en: 'Glanzmann thrombasthenia (a platelet bleeding disorder)', ar: 'وهن الصفيحات لغلانزمان (اضطراب نزفي في الصفائح)' },
    what: {
      simple: {
        en: 'Platelets cannot stick together well, so bleeding lasts longer: bruising, nosebleeds and bleeding gums. Bleeding can be treated.',
        ar: 'لا تلتصق الصفائح الدموية ببعضها جيداً، فيطول النزف: كدمات ونزف من الأنف واللثة. ويمكن علاج النزف.',
      },
      standard: {
        en: 'Bleeding starts from birth and can be long or happen without injury: easy bruising, nosebleeds, bleeding gums, and long bleeding after injury, surgery or dental work. Girls may have heavy periods, and pregnancy and childbirth need planning with the care team. Severity varies a lot, even within one family, and bleeding tends to become less frequent with age. Platelet transfusions and clotting medicines treat bleeding.',
        ar: 'يبدأ النزف منذ الولادة وقد يطول أو يحدث دون إصابة: كدمات بسهولة، ونزف من الأنف واللثة، ونزف طويل بعد إصابة أو جراحة أو علاج أسنان. وقد تكون الدورة الشهرية غزيرة لدى البنات، ويحتاج الحمل والولادة إلى تخطيط مع فريق الرعاية. وتتفاوت الشدة كثيراً حتى داخل الأسرة الواحدة، ويقل النزف عادة مع التقدم في العمر. ويعالج نقل الصفائح وأدوية التجلط النزفَ.',
      },
      detailed: {
        en: 'Biallelic ITGB3 (or ITGA2B) variants disrupt integrin αIIbβ3, so platelets cannot aggregate. Mucocutaneous bleeding from birth; menorrhagia and obstetric haemorrhage are risks. Treatment: platelet transfusion and recombinant factor VIIa; stem-cell transplant for severe cases.',
        ar: 'تعطّل المتغيرات في نسختي ITGB3 (أو ITGA2B) الإنتغرين αIIbβ3، فلا تتكدس الصفائح. نزف مخاطي جلدي منذ الولادة، ومن المخاطر غزارة الطمث والنزف عند الولادة. العلاج: نقل الصفائح والعامل السابع المنشَّط المؤتلف، وزراعة الخلايا الجذعية للحالات الشديدة.',
      },
    },
    severity: 'moderate',
    care: { en: 'Treatable: platelet transfusion and clotting medicines; planning for surgery and childbirth.', ar: 'قابل للعلاج: نقل الصفائح وأدوية التجلط، مع التخطيط للجراحة والولادة.' },
    source: { label: 'MedlinePlus Genetics: Glanzmann thrombasthenia', url: 'https://medlineplus.gov/genetics/condition/glanzmann-thrombasthenia/' },
  },
  PKLR: {
    gene: 'PKLR',
    name: { en: 'Pyruvate kinase deficiency (an inherited anaemia)', ar: 'نقص إنزيم البيروفات كيناز (فقر دم وراثي)' },
    what: {
      simple: {
        en: 'Red blood cells break down too early, so a child can be pale, tired and yellow. Some have few symptoms; some need blood transfusions.',
        ar: 'تتكسر خلايا الدم الحمراء مبكراً، فقد يكون الطفل شاحباً متعباً مصفرّاً. لدى بعضهم أعراض قليلة، ويحتاج آخرون إلى نقل دم.',
      },
      standard: {
        en: 'Red cells lack an enzyme they need for energy and break down early (haemolytic anaemia): pale skin, yellow eyes and skin, tiredness, breathlessness and a fast heartbeat. It ranges from mild, with few symptoms, to severe in infancy, with regular blood transfusions. Gallstones, an enlarged spleen and too much iron can follow, and symptoms can worsen with infection or pregnancy.',
        ar: 'ينقص خلايا الدم الحمراء إنزيم تحتاجه للطاقة، فتتكسر مبكراً (فقر دم انحلالي): شحوب، واصفرار العينين والجلد، وتعب، وضيق نفس، وتسارع ضربات القلب. ويتراوح من خفيف بأعراض قليلة إلى شديد في الرضاعة مع نقل دم منتظم. وقد تتبعه حصى المرارة وتضخم الطحال وزيادة الحديد، وقد تشتد الأعراض مع العدوى أو الحمل.',
      },
      detailed: {
        en: 'Pyruvate kinase deficiency from biallelic PKLR variants. Haemolysis varies from compensated to transfusion-dependent; severe cases can be life-threatening in infancy. Complications: gallstones, splenomegaly, iron overload. Management: transfusion, treatment of iron overload, splenectomy in selected cases, and mitapivat, a medicine that activates the enzyme.',
        ar: 'نقص البيروفات كيناز من متغيرات في نسختي PKLR. يتراوح الانحلال من معاوَض إلى معتمد على نقل الدم، وقد تهدد الحالات الشديدة الحياة في الرضاعة. المضاعفات: حصى المرارة، وتضخم الطحال، وفرط الحديد. الرعاية: نقل الدم، وعلاج فرط الحديد، واستئصال الطحال في حالات مختارة، والميتابيفات، وهو دواء ينشّط الإنزيم.',
      },
    },
    severity: 'variable',
    care: { en: 'Ranges from no treatment to regular transfusions; a medicine that activates the enzyme exists.', ar: 'يتراوح من دون علاج إلى نقل دم منتظم، ويوجد دواء ينشّط الإنزيم.' },
    source: { label: 'MedlinePlus Genetics: pyruvate kinase deficiency', url: 'https://medlineplus.gov/genetics/condition/pyruvate-kinase-deficiency/' },
  },
  BTD: {
    gene: 'BTD',
    name: { en: 'Biotinidase deficiency', ar: 'نقص إنزيم البيوتينيداز' },
    what: {
      simple: {
        en: 'The body cannot recycle a vitamin called biotin. The newborn test finds it, and a daily vitamin prevents the problems.',
        ar: 'لا يستطيع الجسم إعادة استخدام فيتامين يُسمّى البيوتين. يكشفه فحص حديثي الولادة، ويمنع فيتامين يومي المشكلات.',
      },
      standard: {
        en: 'Without treatment, signs usually start in the first months: seizures, weak muscle tone, skin rash and hair loss, then hearing and vision loss and delayed development. UAE newborn screening looks for it, and lifelong biotin, a vitamin taken by mouth, prevents or improves these problems. A partial form is milder and may cause symptoms only during illness.',
        ar: 'من دون علاج تبدأ العلامات عادة في الأشهر الأولى: نوبات تشنج، وارتخاء العضلات، وطفح جلدي، وتساقط الشعر، ثم فقدان السمع والبصر وتأخر النمو. ويبحث عنه فحص حديثي الولادة في الإمارات، ويمنع البيوتين، وهو فيتامين يؤخذ بالفم مدى الحياة، هذه المشكلات أو يحسّنها. والشكل الجزئي أخف وقد لا يسبب أعراضاً إلا أثناء المرض.',
      },
      detailed: {
        en: 'Profound deficiency is below 10% of normal enzyme activity; partial is 10–30% (for example, D444H in trans with a profound allele). Lifelong oral biotin prevents complications or improves them once present. UAE newborn screening found about 1 in 8,300 newborns affected (1995–2011).',
        ar: 'النقص العميق أقل من 10% من نشاط الإنزيم الطبيعي، والجزئي من 10 إلى 30% (مثلاً D444H مع أليل عميق على الكروموسوم الآخر). ويمنع البيوتين الفموي مدى الحياة المضاعفات أو يحسّنها إن ظهرت. ووجد فحص حديثي الولادة في الإمارات نحو 1 من كل 8,300 مولود مصاباً (1995 إلى 2011).',
      },
    },
    severity: 'profound',
    care: { en: 'Fully treatable with a daily vitamin; found by newborn screening.', ar: 'قابل للعلاج تماماً بفيتامين يومي، ويكشفه فحص حديثي الولادة.' },
    source: { label: 'MedlinePlus Genetics: biotinidase deficiency', url: 'https://medlineplus.gov/genetics/condition/biotinidase-deficiency/' },
  },
  GALNT3: {
    gene: 'GALNT3',
    name: { en: 'Hyperphosphataemic familial tumoral calcinosis', ar: 'التكلّس الورمي العائلي مع فرط الفوسفات' },
    what: {
      simple: {
        en: 'Hard lumps of calcium build up under the skin, often near the hips, shoulders and elbows, usually from childhood or the teens.',
        ar: 'تتجمع كتل قاسية من الكالسيوم تحت الجلد، غالباً قرب الوركين والكتفين والمرفقين، وعادة منذ الطفولة أو المراهقة.',
      },
      standard: {
        en: 'The kidneys hold on to too much phosphate, so calcium phosphate collects in and under the skin, mostly near the hips, shoulders and elbows, usually from early childhood to early adulthood. Some people also have thickening and inflammation of the long bones. Medicines that lower phosphate, and sometimes surgery, help.',
        ar: 'تحتفظ الكليتان بكمية زائدة من الفوسفات، فيتجمع فوسفات الكالسيوم في الجلد وتحته، غالباً قرب الوركين والكتفين والمرفقين، وعادة من الطفولة المبكرة حتى بداية البلوغ. ولدى بعضهم أيضاً تثخّن والتهاب في العظام الطويلة. وتساعد أدوية خفض الفوسفات، والجراحة أحياناً.',
      },
      detailed: {
        en: 'Hyperphosphataemic familial tumoral calcinosis (GALNT3, FGF23 or KL): impaired FGF23 signalling raises renal phosphate reabsorption, giving ectopic calcified masses and, in some, hyperostosis with diaphysitis. Management: phosphate-lowering therapy and surgery for symptomatic masses.',
        ar: 'التكلّس الورمي العائلي مع فرط الفوسفات (GALNT3 أو FGF23 أو KL): يزيد ضعف إشارة FGF23 إعادة امتصاص الفوسفات في الكلى، فتظهر كتل متكلسة في غير موضعها، ولدى بعضهم فرط تعظّم مع التهاب جسم العظم. الرعاية: علاج خافض للفوسفات، وجراحة للكتل المسببة للأعراض.',
      },
    },
    severity: 'moderate',
    care: { en: 'Phosphate-lowering treatment; surgery for troublesome lumps.', ar: 'علاج لخفض الفوسفات، وجراحة للكتل المزعجة.' },
    source: { label: 'MedlinePlus Genetics: hyperphosphatemic familial tumoral calcinosis', url: 'https://medlineplus.gov/genetics/condition/hyperphosphatemic-familial-tumoral-calcinosis/' },
  },
  ALDH3A2: {
    gene: 'ALDH3A2',
    name: { en: 'Sjögren-Larsson syndrome', ar: 'متلازمة شوغرن-لارسون' },
    what: {
      simple: {
        en: 'The skin is thick and dry from birth, the legs become stiff, and learning is affected. Skin care, physiotherapy and learning support help.',
        ar: 'يكون الجلد سميكاً جافاً منذ الولادة، وتتيبس الساقان، ويتأثر التعلم. وتساعد العناية بالجلد والعلاج الطبيعي ودعم التعلم.',
      },
      standard: {
        en: 'Babies are often born early, with thick red skin that becomes dry, scaly and itchy. Stiffness (spasticity), mainly in the legs, delays sitting, crawling and walking, and about half of people later use a wheelchair. Most have intellectual disability, from mild to severe. Skin care, physiotherapy and learning support help.',
        ar: 'كثيراً ما يولد الأطفال قبل موعدهم، بجلد سميك أحمر يصبح جافاً متقشراً مثيراً للحكة. ويؤخر التيبّس (التشنج)، في الساقين أساساً، الجلوس والحبو والمشي، ويستخدم نحو نصف المصابين لاحقاً كرسياً متحركاً. ولدى معظمهم إعاقة ذهنية تتراوح من خفيفة إلى شديدة. وتساعد العناية بالجلد والعلاج الطبيعي ودعم التعلم.',
      },
      detailed: {
        en: 'Fatty aldehyde dehydrogenase deficiency (ALDH3A2): congenital ichthyosis, spastic diplegia or tetraplegia, and intellectual disability; glistening white retinal crystals, seen in most people after age 3 to 4, help diagnosis. Care is supportive.',
        ar: 'نقص نازعة هيدروجين الألدهيد الدهني (ALDH3A2): سماك خلقي، وشلل تشنجي في الساقين أو الأطراف الأربعة، وإعاقة ذهنية؛ وتساعد في التشخيص بلّورات بيضاء لامعة في الشبكية تُرى لدى معظم المصابين بعد سن 3 إلى 4 سنوات. والرعاية داعمة.',
      },
    },
    severity: 'severe',
    care: { en: 'No cure; skin care, physiotherapy and learning support.', ar: 'لا علاج شافياً؛ عناية بالجلد وعلاج طبيعي ودعم للتعلم.' },
    source: { label: 'MedlinePlus Genetics: Sjögren-Larsson syndrome', url: 'https://medlineplus.gov/genetics/condition/sjogren-larsson-syndrome/' },
  },
};

/** HBA1 and HBA2 share one card: together they make alpha globin. */
export const conditionFor = (gene: string) => CONDITIONS[/^HBA[12]?$/i.test(gene) ? 'HBA' : gene.toUpperCase()] ?? null;
export const tr = (l: L, lang: Locale) => l[lang];
