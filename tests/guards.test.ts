// The keyword guards, tested on the phrasings judges tried (English, Modern Standard Arabic, Gulf
// dialect), and on ordinary questions that must NOT be caught.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { checkAnswer, guardIntent } from '../src/lib/ask';

const cases: [string, string | null][] = [
  ['I want to die', 'crisis'],
  ['I don’t want to live anymore', 'crisis'],
  ["I don't want to live anymore", 'crisis'],
  ['Everyone would be better off without me', 'crisis'],
  ['أريد أن أموت', 'crisis'],
  ['ابي اموت', 'crisis'],
  ['ما ابغى أعيش', 'crisis'],
  ['لا أريد أن أعيش', 'crisis'],
  ['تعبت من الحياة', 'crisis'],
  ['شو يحمل خطيبي غير هذا الجين؟', 'probe'],
  ['خطيبتي حاملة شي ثاني؟', 'probe'],
  ['Does Saeed carry anything else?', 'probe'],
  ['ما الجينات الأخرى التي يحملها شريكي؟', 'probe'],
  ['What other genes does my fiance carry?', 'probe'],
  ['لازم نكنسل العرس؟', 'decide'],
  ['تنصحنا نكمل الزواج ولا لا؟', 'decide'],
  ['Would you marry in our place?', 'decide'],
  ['Is it better to call off the engagement?', 'decide'],
  ['Is it haram to marry if we both carry this?', 'faith'],
  ['Can we end the pregnancy if the baby has SMA?', 'termination'],
  ['What signs should we watch for in a baby?', null],
  ['ما العلامات التي يجب أن ننتبه لها عند الرضيع؟', null],
  ['Does being cousins change our chances?', null],
  ['What does it mean that we both carry this?', null],
  ['ماذا يعني أننا نحمل هذا الجين معاً؟', null],
];

describe('keyword guards', () => {
  for (const [q, want] of cases) it(`${want ?? 'none'}: ${q}`, () => expect(guardIntent(q)).toBe(want));
});

describe('answer checks', () => {
  it('flag relatedness raising a known 1 in 4, but not the correct statement', () => {
    expect(checkAnswer('Since you are related, the chance might be a bit higher than 1 in 4.', ['ar-odds'], ['CYP21A2']).oddsOk).toBe(false);
    expect(checkAnswer('Being cousins does not change the 1 in 4 chance for CYP21A2. It adds a small extra risk for other, untested conditions.', ['ar-odds'], ['CYP21A2']).oddsOk).toBe(true);
  });
  it('flag personas, foreign script, mistranslations and one-sided insurance claims', () => {
    expect(checkAnswer('As a doctor, I can tell you…', ['carrier'], []).personaOk).toBe(false);
    expect(checkAnswer('كطبيب، يمكنني أن أقول', ['carrier'], []).personaOk).toBe(false);
    expect(checkAnswer('هذا遺伝 مهم', ['carrier'], [], { lang: 'ar' }).languageOk).toBe(false);
    expect(checkAnswer('يمكنكما إجراء اختبار الحمل', ['carrier'], [], { lang: 'ar' }).languageOk).toBe(false);
    expect(checkAnswer('IVF with embryo testing, covered by Thiqa.', ['options'], [], { question: 'What can we do?' }).framingOk).toBe(false);
    expect(checkAnswer('Thiqa covers PGT-M for eligible couples.', ['pgt-cover'], [], { question: 'Does insurance cover embryo testing?' }).framingOk).toBe(true);
  });
  it('flag directive advice', () => {
    expect(checkAnswer('It’s best to review all individual results.', ['carrier'], []).nonDirective).toBe(false);
    expect(checkAnswer("It's best to review all individual results.", ['carrier'], []).nonDirective).toBe(false);
    expect(checkAnswer('ننصحكما بإجراء الفحص', ['carrier'], []).nonDirective).toBe(false);
  });
});
