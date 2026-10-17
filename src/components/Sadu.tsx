// A woven Al Sadu band, drawn from rows of motifs. `lit` marks motifs that turn madder red:
// the only place colour means "shared". Deterministic from `seed`, so a band is the same every render.
type Props = { width?: number; height?: number; motifs?: number; lit?: number[]; seed?: number; tone?: 'dark' | 'light'; className?: string; label?: string };

export function Sadu({ width = 520, height = 72, motifs = 13, lit = [], seed = 3, tone = 'dark', className, label }: Props) {
  const bg = tone === 'dark' ? 'var(--ink)' : 'var(--wool-2)';
  const fg = tone === 'dark' ? 'var(--wool)' : 'var(--ink)';
  const w = width / motifs;
  const mid = height / 2;
  const band = height * 0.18;
  const items = [];
  for (let i = 0; i < motifs; i++) {
    const cx = w * i + w / 2;
    const on = lit.includes(i);
    const r = Math.min(w, height - band * 2) * 0.42;
    const variant = (i * 7 + seed) % 3;
    items.push(
      <g key={i}>
        <path d={`M${cx} ${mid - r} L${cx + r} ${mid} L${cx} ${mid + r} L${cx - r} ${mid}Z`} fill={on ? 'var(--madder)' : 'none'} stroke={on ? 'var(--wool)' : fg} strokeWidth={on ? 2.5 : 1.6} />
        {!on && variant === 0 && <path d={`M${cx} ${mid - r * 0.45} L${cx + r * 0.45} ${mid} L${cx} ${mid + r * 0.45} L${cx - r * 0.45} ${mid}Z`} fill={fg} />}
        {!on && variant === 1 && <circle cx={cx} cy={mid} r={r * 0.18} fill={fg} />}
        {!on && variant === 2 && <path d={`M${cx - r * 0.5} ${mid} H${cx + r * 0.5} M${cx} ${mid - r * 0.5} V${mid + r * 0.5}`} stroke={fg} strokeWidth={1.6} />}
      </g>,
    );
  }
  // Edge bands of small triangles (the "eyes" border of Sadu cloth).
  const teeth = [];
  const n = Math.round(width / (band * 1.2));
  for (let i = 0; i < n; i++) {
    const x = (width / n) * i;
    const tw = width / n;
    teeth.push(<path key={`t${i}`} d={`M${x} ${band} L${x + tw / 2} 2 L${x + tw} ${band}Z`} fill={fg} opacity={0.9} />);
    teeth.push(<path key={`b${i}`} d={`M${x} ${height - band} L${x + tw / 2} ${height - 2} L${x + tw} ${height - band}Z`} fill={fg} opacity={0.9} />);
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="none">
      <rect width={width} height={height} fill={bg} />
      {teeth}
      <line x1="0" y1={band + 3} x2={width} y2={band + 3} stroke={fg} strokeWidth="1" opacity="0.6" />
      <line x1="0" y1={height - band - 3} x2={width} y2={height - band - 3} stroke={fg} strokeWidth="1" opacity="0.6" />
      {items}
    </svg>
  );
}
