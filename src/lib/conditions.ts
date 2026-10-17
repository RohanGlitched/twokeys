// Plain-language condition cards for the genes in the demo. Every card cites its source; wording is
// non-directive and avoids stigma ("carrier is not a disease"). Three reading levels per language.
import type { Locale } from '@/i18n/locales';

type L = { en: string; ar: string };
export type Level = 'simple' | 'standard' | 'detailed';

export interface Condition {
  gene: string;
  name: L;
  /** One line: what it does to the body. */
  what: Record<Level, L>;
  /** ACMG-style severity band and what care looks like today. */
  severity: 'profound' | 'severe' | 'moderate' | 'mild' | 'variable';
  care: L;
  source: { label: string; url: string };
}

export const CONDITIONS: Record<string, Condition> = {
  CYP21A2: {
    gene: 'CYP21A2',
    name: { en: 'Congenital adrenal hyperplasia (CAH)', ar: 'تضخم الغدة الكظرية الخلقي' },
    what: {
      simple: {
        en: 'The body cannot make enough of some hormones from the adrenal glands. Babies are checked for it at birth.',
        ar: 'لا يصنع الجسم ما يكفي من بعض الهرمونات التي تفرزها الغدة الكظرية. يُفحص المواليد له عند الولادة.',
      },
      standard: {
        en: 'An enzyme the adrenal glands need to make cortisol is missing or weak. Without treatment, salt-wasting crises can be dangerous in the first weeks of life. Lifelong hormone medicine works well.',
        ar: 'يغيب أو يضعف إنزيم تحتاجه الغدة الكظرية لصنع الكورتيزول. من دون علاج قد تحدث أزمات فقدان الأملاح في الأسابيع الأولى من الحياة، وهي خطيرة. ويفيد الدواء الهرموني مدى الحياة كثيراً.',
      },
      detailed: {
        en: '21-hydroxylase deficiency. Classic forms (salt-wasting and simple virilising) are found by UAE newborn screening; non-classic forms are milder and common. Treatment is glucocorticoid and, if needed, mineralocorticoid replacement.',
        ar: 'نقص إنزيم 21-هيدروكسيلاز. الأشكال التقليدية (المُضيّعة للملح والمُذكِّرة البسيطة) يكشفها فحص حديثي الولادة في الإمارات، أما الشكل غير التقليدي فأخف وشائع. العلاج بتعويض الغلوكوكورتيكويد، والمينرالوكورتيكويد عند الحاجة.',
      },
    },
    severity: 'severe',
    care: { en: 'Treatable with daily medicine; found by newborn screening.', ar: 'قابل للعلاج بدواء يومي، ويُكشف بفحص حديثي الولادة.' },
    source: { label: 'MedlinePlus Genetics: congenital adrenal hyperplasia', url: 'https://medlineplus.gov/genetics/condition/21-hydroxylase-deficiency/' },
  },
  HBB: {
    gene: 'HBB',
    name: { en: 'Beta thalassaemia and sickle cell disease', ar: 'الثلاسيميا بيتا وفقر الدم المنجلي' },
    what: {
      simple: {
        en: 'Red blood cells cannot carry oxygen well. Some children need regular blood transfusions.',
        ar: 'لا تحمل خلايا الدم الحمراء الأكسجين جيداً. يحتاج بعض الأطفال إلى نقل دم منتظم.',
      },
      standard: {
        en: 'HBB makes part of haemoglobin. Two changed copies can cause beta thalassaemia major (severe anaemia from early childhood) or sickle cell disease (pain crises, infections). Which one depends on the exact changes both parents carry.',
        ar: 'يصنع جين HBB جزءاً من الهيموغلوبين. قد تسبب نسختان متغيرتان الثلاسيميا بيتا الكبرى (فقر دم شديد منذ الطفولة المبكرة) أو فقر الدم المنجلي (نوبات ألم والتهابات). ويعتمد ذلك على التغيّرات المحددة التي يحملها الوالدان.',
      },
      detailed: {
        en: 'Compound or homozygous HBB variants: β0/β+ thalassaemia, HbS/HbS, HbS/β-thal, HbS/HbC and others. Severity varies with genotype and with co-inherited alpha-globin changes. Care ranges from folic acid to transfusion and iron chelation; stem-cell transplant and gene therapy can cure some cases.',
        ar: 'متغيرات HBB المتماثلة أو المركّبة: ثلاسيميا β0/β+، وHbS/HbS، وHbS/ثلاسيميا بيتا، وHbS/HbC وغيرها. تتفاوت الشدة بحسب التركيب الجيني ووجود تغيّرات في جينات ألفا غلوبين. وتتراوح الرعاية من حمض الفوليك إلى نقل الدم وإزالة الحديد، وقد تشفي زراعة الخلايا الجذعية والعلاج الجيني بعض الحالات.',
      },
    },
    severity: 'severe',
    care: { en: 'Lifelong care; some cases curable by transplant or gene therapy.', ar: 'رعاية مدى الحياة، وبعض الحالات قابلة للشفاء بالزراعة أو العلاج الجيني.' },
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
        ar: 'تضعف الرؤية المركزية تدريجياً، عادة منذ الطفولة أو المراهقة، وتبقى الرؤية الجانبية.',
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
    name: { en: 'Usher syndrome type 2 / retinitis pigmentosa', ar: 'متلازمة أشر من النوع الثاني / التهاب الشبكية الصباغي' },
    what: {
      simple: {
        en: 'Hearing loss from birth and night and side vision that fade over the years.',
        ar: 'فقدان سمع منذ الولادة، ورؤية ليلية وجانبية تضعف مع السنين.',
      },
      standard: {
        en: 'Moderate to severe hearing loss from birth, helped by hearing aids, with retinitis pigmentosa that narrows vision from the teens. Some USH2A changes cause the eye condition alone.',
        ar: 'فقدان سمع متوسط إلى شديد منذ الولادة تساعده السماعات، مع التهاب الشبكية الصباغي الذي يضيّق مجال الرؤية منذ المراهقة. وبعض تغيّرات USH2A تسبب حالة العين وحدها.',
      },
      detailed: {
        en: 'Usher syndrome 2A or non-syndromic autosomal recessive RP, depending on alleles. Hearing aids or cochlear implants; RNA and gene therapies are in trials.',
        ar: 'متلازمة أشر 2A أو التهاب الشبكية الصباغي المتنحي غير المتلازمي بحسب المتغيرات. السماعات أو زراعة القوقعة، والعلاجات الجينية والـ RNA قيد التجارب.',
      },
    },
    severity: 'moderate',
    care: { en: 'Hearing support; vision care; therapies in trials.', ar: 'دعم السمع ورعاية البصر وعلاجات قيد التجارب.' },
    source: { label: 'MedlinePlus Genetics: Usher syndrome', url: 'https://medlineplus.gov/genetics/condition/usher-syndrome/' },
  },
  HBA2: {
    gene: 'HBA2',
    name: { en: 'Alpha thalassaemia', ar: 'الثلاسيميا ألفا' },
    what: {
      simple: {
        en: 'Most changes in this gene cause no illness. A few combinations cause anaemia.',
        ar: 'معظم التغيّرات في هذا الجين لا تسبب مرضاً، وبعض التركيبات تسبب فقر الدم.',
      },
      standard: {
        en: 'There are four alpha-globin gene copies. Losing one or two is common in the UAE and usually silent. Losing three causes HbH disease; losing all four is very severe.',
        ar: 'لدى الإنسان أربع نسخ من جين ألفا غلوبين. فقدان نسخة أو اثنتين شائع في الإمارات ولا يسبب أعراضاً غالباً. فقدان ثلاث يسبب مرض HbH، وفقدان الأربع شديد جداً.',
      },
      detailed: {
        en: 'HBA1/HBA2 deletions (−α3.7, −α4.2, −−MED, −−SEA) and point variants. Risk depends on cis versus trans arrangement, which short-read sequencing can miss; confirmation needs dedicated testing.',
        ar: 'حذف في HBA1/HBA2 (−α3.7، −α4.2، −−MED، −−SEA) ومتغيرات نقطية. يعتمد الخطر على ترتيب الحذف على الكروموسوم نفسه أو على الكروموسومين، وقد لا يكشفه التسلسل القصير، فيلزم فحص تأكيدي خاص.',
      },
    },
    severity: 'variable',
    care: { en: 'Often silent; severe forms need specialist care.', ar: 'غالباً بلا أعراض، والأشكال الشديدة تحتاج رعاية متخصصة.' },
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
        en: 'Red blood cells can break down after eating fava beans or taking some medicines. Avoiding these keeps most people well.',
        ar: 'قد تتكسر خلايا الدم الحمراء بعد أكل الفول أو تناول بعض الأدوية. تجنّب ذلك يحفظ صحة معظم الناس.',
      },
      standard: {
        en: 'X-linked: boys are affected more often. Most people have no symptoms unless exposed to a trigger. Newborns are screened in the UAE.',
        ar: 'مرتبط بالكروموسوم X: يتأثر الذكور أكثر. لا تظهر أعراض عند معظم الناس إلا عند التعرض لمحفّز. ويُفحص المواليد في الإمارات.',
      },
      detailed: {
        en: 'Acute haemolysis after oxidative triggers (fava beans, some antimalarials, sulfonamides, infections). Neonatal jaundice may need treatment. Common in the Gulf.',
        ar: 'انحلال دموي حاد بعد المحفزات المؤكسدة (الفول، بعض أدوية الملاريا، السلفوناميدات، العدوى). قد يحتاج يرقان حديثي الولادة إلى علاج. شائع في الخليج.',
      },
    },
    severity: 'mild',
    care: { en: 'Avoid triggers; usually no treatment needed.', ar: 'تجنّب المحفزات، ولا يلزم علاج عادة.' },
    source: { label: 'MedlinePlus Genetics: G6PD deficiency', url: 'https://medlineplus.gov/genetics/condition/glucose-6-phosphate-dehydrogenase-deficiency/' },
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
        ar: 'CYP1B1 هو الجين الرئيس للزرق الخلقي الأولي المتنحي، وهو أشيع في المجتمعات ذات زواج الأقارب. وجراحة فتح الزاوية أو التربيقيات هي الخيار الأول.',
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
        en: 'Nerves that move the muscles weaken. New medicines work best when started very early.',
        ar: 'تضعف الأعصاب التي تحرك العضلات. وتعمل الأدوية الحديثة أفضل ما يكون عند البدء بها مبكراً جداً.',
      },
      standard: {
        en: 'Motor neurons in the spinal cord are lost, causing weakness that can affect breathing and swallowing. Gene and drug therapies now change the outlook, especially when given before symptoms.',
        ar: 'تُفقد الخلايا العصبية الحركية في الحبل الشوكي، فيحدث ضعف قد يؤثر على التنفس والبلع. غيّرت العلاجات الجينية والدوائية التوقعات، خصوصاً عند إعطائها قبل ظهور الأعراض.',
      },
      detailed: {
        en: 'Homozygous SMN1 loss (usually exon 7 deletion); SMN2 copy number modifies severity. Treatments: nusinersen, risdiplam, onasemnogene abeparvovec. Carrier testing must count SMN1 copies (2+0 “silent” carriers are missed).',
        ar: 'فقدان SMN1 المتماثل (غالباً حذف الإكسون 7)، ويعدّل عدد نسخ SMN2 الشدة. العلاجات: نوسينيرسن، ريسديبلام، أوناسيمنوجين. يجب أن يعدّ فحص الحمل نسخ SMN1 (حاملو 2+0 "الصامتون" قد يُغفلون).',
      },
    },
    severity: 'profound',
    care: { en: 'New treatments; best started before symptoms.', ar: 'علاجات حديثة، والأفضل البدء بها قبل الأعراض.' },
    source: { label: 'MedlinePlus Genetics: spinal muscular atrophy', url: 'https://medlineplus.gov/genetics/condition/spinal-muscular-atrophy/' },
  },
};

export const conditionFor = (gene: string) => CONDITIONS[gene.toUpperCase()] ?? null;
export const tr = (l: L, lang: Locale) => l[lang];
