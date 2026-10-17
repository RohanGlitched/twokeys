// One parser for explainer requests, used by /api/ask and by the evaluation, so the evaluation runs the
// same path production runs: every panel gene reaches the explainer, and only signed turns count as history.
import 'server-only';
import type { AskInput } from './ask';
import { canonical, isXLinked, onPanel } from './cards';

const KINDS = new Set(['hplc', 'bart', 'hbh', 'hbh-severe', 'trait']);

export type Verify = (role: 'user' | 'assistant', text: string, sig: unknown) => boolean;

export function parseAskBody(b: Record<string, unknown>, verify: Verify): AskInput | { error: string } {
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  if (!question || question.length > 600) return { error: 'Ask a question of up to 600 characters.' };
  const genes = (xs: unknown) => (Array.isArray(xs) ? [...new Set(xs.filter((g): g is string => typeof g === 'string' && onPanel(g)).map(canonical))].slice(0, 8) : []);
  const all = [...genes(b.genes), ...genes(b.xl)];
  const strengths = b.strengths && typeof b.strengths === 'object'
    ? Object.fromEntries(Object.entries(b.strengths as Record<string, unknown>).filter(([g, v]) => onPanel(g) && [0, 1, 2].includes(Number(v))).map(([g, v]) => [canonical(g), Number(v)]))
    : undefined;
  return {
    lang: b.lang === 'ar' ? 'ar' : 'en',
    level: b.level === 'simple' || b.level === 'detailed' ? b.level : 'standard',
    // X-linked genes are told apart by the panel, whichever list the client put them in.
    genes: [...new Set(all.filter((g) => !isXLinked(g)))],
    xl: [...new Set(all.filter(isXLinked))],
    sex: b.sex === 'F' || b.sex === 'M' ? b.sex : undefined,
    strengths,
    kinds: b.kinds && typeof b.kinds === 'object'
      ? Object.fromEntries(Object.entries(b.kinds as Record<string, unknown>).filter(([g, v]) => onPanel(g) && typeof v === 'string' && KINDS.has(v)).map(([g, v]) => [canonical(g), v as string]))
      : undefined,
    chances: b.chances && typeof b.chances === 'object'
      ? Object.fromEntries(Object.entries(b.chances as Record<string, unknown>).filter(([g, v]) => onPanel(g) && (v === 'quarter' || v === 'half' || v === 'three-quarters' || v === 'all')).map(([g, v]) => [canonical(g), v as 'quarter' | 'half' | 'three-quarters' | 'all']))
      : undefined,
    related: !!b.related,
    question,
    history: Array.isArray(b.history)
      ? (b.history as { role?: string; text?: unknown; sig?: unknown }[])
        .filter((h) => h && typeof h.text === 'string' && (h.role === 'user' || h.role === 'assistant') && verify(h.role, h.text, h.sig))
        .map((h) => ({ role: h.role as 'user' | 'assistant', text: (h.text as string).slice(0, 800) })).slice(-6)
      : [],
  };
}
