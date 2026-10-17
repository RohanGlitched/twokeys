// Condition facts for the explainer, for every gene on the panel. The cards are the same ones the phone,
// the desk and the letters show (conditionFor: the full cards in conditions.ts, the shorter panel cards in
// panelcards.ts), so a shared gene is never silently dropped and the explainer never reads other text.
import 'server-only';
import panel from '../../data/panel.json';
import { conditionFor, type Condition } from './conditions';

type PanelGene = { gene: string; inheritance: string };
const PANEL = new Map((panel as { genes: PanelGene[] }).genes.map((g) => [g.gene, g]));
const key = (gene: string) => (/^HBA[12]?$/i.test(gene) ? 'HBA' : gene.toUpperCase());

/** Every gene the lab can report: the panel, plus HBA for the two alpha-globin genes. */
export const onPanel = (gene: string) => PANEL.has(key(gene)) || !!conditionFor(gene);
export const isXLinked = (gene: string) => PANEL.get(key(gene))?.inheritance === 'XL';
export const canonical = key;

export function cardFor(gene: string): Condition | null {
  return conditionFor(gene);
}

const BAND: Record<Condition['severity'], string> = {
  profound: 'profound', severe: 'severe', moderate: 'moderate', mild: 'mild', variable: 'variable (depends on the exact changes)',
};

/**
 * One line of grounding for the model, from the same card the person sees, with its severity band and,
 * for X-linked genes, what it means for a man. The explainer cites it as [cond:GENE].
 */
export function cardFacts(gene: string): string | null {
  const c = conditionFor(gene);
  if (!c) return null;
  const k = key(gene);
  return [
    `[cond:${k}] ${c.name.en} (Arabic: ${c.name.ar}).`,
    `Severity band: ${BAND[c.severity]}.`,
    `Simple: ${c.what.simple.en} Standard: ${c.what.standard.en} Detailed: ${c.what.detailed.en}`,
    `Care today: ${c.care.en}`,
    c.carrierNote ? `Carriers${isXLinked(k) ? ' (women)' : ''}: ${c.carrierNote.en}` : '',
    c.maleNote ? `For a man with this result: ${c.maleNote.en}` : '',
  ].filter(Boolean).join(' ');
}
