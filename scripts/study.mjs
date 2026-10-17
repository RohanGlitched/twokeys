// Summarises the small user study (data/study/*.csv) into data/study/summary.json for the proof page.
//   node scripts/study.mjs
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../data/study');
const csv = (f) => {
  const [head, ...rows] = fs.readFileSync(path.join(dir, f), 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const count = (rows, k) => rows.reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] ?? 0) + 1 }), {});
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

const tb = csv('teachback-2026-10-17.csv');
const sv = csv('survey-2026-10-17.csv');
const group = (k) => Object.fromEntries(Object.entries(Object.groupBy(tb, (r) => r[k])).map(([v, rs]) => [v, { people: rs.length, allThree: rs.filter((r) => r.first_try_score === '3').length }]));

const summary = {
  collected: '2026-10-17',
  method: 'Convenience sample of the team’s friends and family, who agreed to their anonymous answers being used. Each used the live demo with synthetic results, answered the three teach-back questions, then a five-question survey. Not representative; a pilot would recruit through screening centres.',
  teachback: {
    people: tb.length,
    allThree: tb.filter((r) => r.first_try_score === '3').length,
    medianMinutes: median(tb.map((r) => Number(r.minutes))),
    maxMinutes: Math.max(...tb.map((r) => Number(r.minutes))),
    byLanguage: group('language'),
    byLevel: group('reading_level'),
  },
  survey: {
    people: sv.length,
    emirati: count(sv, 'emirati'),
    language: count(sv, 'language'),
    firstToSee: count(sv, 'first_to_see_result'),
    visibility: count(sv, 'result_visibility'),
    ai: count(sv, 'ai_preference'),
    family: count(sv, 'family_notification'),
  },
};
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
