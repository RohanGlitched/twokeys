// Synthetic people for the demo. None of them is real; their findings are drawn to match published
// Emirati carrier patterns (CYP21A2, HBB, MEFV, ABCA4, USH2A, GJB2…). Server-side only: a phone
// never receives another person's findings.
import type { Finding, Sex } from './lab';
import type { Relationship } from './risk';

export interface Person {
  id: string;
  name: { en: string; ar: string };
  sex: Sex;
  age: number;
  findings: Finding[];
}

export interface Couple {
  id: string;
  a: string; // she
  b: string; // he
  relationship: Relationship;
  story: { en: string; ar: string };
}

const ar = (gene: string, severity: 'severe' | 'mild' = 'severe'): Finding => ({ gene, inheritance: 'AR', severity });
const xl = (gene: string): Finding => ({ gene, inheritance: 'XL', severity: 'severe' });

export const PEOPLE: Person[] = [
  { id: 'mariam', name: { en: 'Mariam', ar: 'مريم' }, sex: 'F', age: 24, findings: [ar('CYP21A2'), ar('HBB')] },
  { id: 'saeed', name: { en: 'Saeed', ar: 'سعيد' }, sex: 'M', age: 27, findings: [ar('CYP21A2'), ar('MEFV')] },
  { id: 'noura', name: { en: 'Noura', ar: 'نورة' }, sex: 'F', age: 26, findings: [ar('ABCA4')] },
  { id: 'khalid', name: { en: 'Khalid', ar: 'خالد' }, sex: 'M', age: 29, findings: [ar('USH2A'), ar('HBA2', 'mild')] },
  { id: 'hessa', name: { en: 'Hessa', ar: 'حصة' }, sex: 'F', age: 23, findings: [ar('HBB'), ar('GJB2', 'mild'), xl('G6PD')] },
  { id: 'rashid', name: { en: 'Rashid', ar: 'راشد' }, sex: 'M', age: 25, findings: [ar('HBB'), ar('GJB2'), ar('CYP1B1')] },
  { id: 'latifa', name: { en: 'Latifa', ar: 'لطيفة' }, sex: 'F', age: 25, findings: [ar('GJB2', 'mild'), ar('SMN1')] },
  { id: 'ahmed', name: { en: 'Ahmed', ar: 'أحمد' }, sex: 'M', age: 28, findings: [ar('GJB2', 'mild'), ar('CYP1B1')] },
];

export const COUPLES: Couple[] = [
  { id: 'mariam-saeed', a: 'mariam', b: 'saeed', relationship: 'first-cousins',
    story: { en: 'First cousins. Their fathers are brothers.', ar: 'ابنا عمّ من الدرجة الأولى: أبوها وأبوه أخوان.' } },
  { id: 'noura-khalid', a: 'noura', b: 'khalid', relationship: 'unrelated',
    story: { en: 'Not related. They met at university.', ar: 'لا قرابة بينهما، تعارفا في الجامعة.' } },
  { id: 'hessa-rashid', a: 'hessa', b: 'rashid', relationship: 'double-first-cousins',
    story: { en: 'Double first cousins: two brothers married two sisters.', ar: 'ابنا عمّ وابنا خالة في آن واحد: أخوان تزوجا أختين.' } },
  { id: 'latifa-ahmed', a: 'latifa', b: 'ahmed', relationship: 'second-cousins',
    story: { en: 'Second cousins. Their grandmothers are sisters.', ar: 'قريبان من الدرجة الثانية: جدّتاهما أختان.' } },
];

export const personById = (id: string) => PEOPLE.find((p) => p.id === id) ?? null;
export const coupleOf = (personId: string) => COUPLES.find((c) => c.a === personId || c.b === personId) ?? null;
/** Public profile: what any screen may show about a person (never findings). */
export const publicPerson = (p: Person) => ({ id: p.id, name: p.name, sex: p.sex, age: p.age });
