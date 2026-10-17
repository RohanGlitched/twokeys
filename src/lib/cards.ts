// Condition facts for the explainer, for every gene on the panel. The ten demo genes have full,
// three-level cards (conditions.ts); any other panel gene gets a short card built from panel.json, so a
// shared gene is never silently dropped before the explainer sees it.
import 'server-only';
import panel from '../../data/panel.json';
import { CONDITIONS, type Condition } from './conditions';

type PanelGene = { gene: string; inheritance: string; condition: string; severity?: string; treatable?: boolean | string; treatable_note?: string; sources?: string[] };
const PANEL = new Map((panel as { genes: PanelGene[] }).genes.map((g) => [g.gene, g]));
const key = (gene: string) => (/^HBA[12]?$/i.test(gene) ? 'HBA' : gene.toUpperCase());

/** Every gene the lab can report: the panel, plus HBA for the two alpha-globin genes. */
export const onPanel = (gene: string) => PANEL.has(key(gene)) || key(gene) in CONDITIONS;
export const isXLinked = (gene: string) => PANEL.get(key(gene))?.inheritance === 'XL';
export const canonical = key;

const SEVERITY = new Set(['profound', 'severe', 'moderate', 'mild', 'variable']);

export function cardFor(gene: string): Condition | null {
  const k = key(gene);
  if (CONDITIONS[k]) return CONDITIONS[k];
  const p = PANEL.get(k);
  if (!p) return null;
  const xl = p.inheritance === 'XL';
  const line = {
    en: `${p.condition}. ${xl ? 'Inherited on the X chromosome.' : 'Inherited recessively: a child is affected only by inheriting a changed copy from both parents.'} A genetic counsellor can explain what it means for this gene.`,
    ar: `الحالة المرتبطة بالجين ${k}. ${xl ? 'تُورَّث عبر الكروموسوم X.' : 'تُورَّث وراثة متنحية: لا يصاب الطفل إلا إذا ورث نسخة متغيرة من كلا الوالدين.'} ويمكن للمرشد الوراثي شرح ما يعنيه ذلك لهذا الجين.`,
  };
  return {
    gene: k,
    name: { en: p.condition, ar: `الحالة المرتبطة بالجين ${k}` },
    what: { simple: line, standard: line, detailed: line },
    severity: (SEVERITY.has(p.severity ?? '') ? p.severity : 'variable') as Condition['severity'],
    care: p.treatable_note
      ? { en: `Care today: ${p.treatable_note}. A genetic counsellor can explain the details.`, ar: 'يمكن للمرشد الوراثي شرح الرعاية المتاحة اليوم لهذه الحالة.' }
      : { en: 'A genetic counsellor can explain the care available.', ar: 'يمكن للمرشد الوراثي شرح الرعاية المتاحة.' },
    source: { label: 'Two Keys carrier panel (data/panel.json)', url: p.sources?.[0] ?? '' },
  };
}
