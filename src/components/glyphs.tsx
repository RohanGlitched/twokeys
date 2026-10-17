// Pedigree-chart glyphs: the notation genetics itself uses. Diamond = a child of either sex;
// filled = affected, half-filled = carrier, outline = neither; a pale dashed fill = a mild form at most.
// Square = male, circle = female.
type Fill = 'affected' | 'mild' | 'carrier' | 'clear';

export function Diamond({ fill, size = 40, color = 'var(--madder)', label }: { fill: Fill; size?: number; color?: string; label?: string }) {
  const s = size, h = s / 2;
  const path = `M${h} 2 L${s - 2} ${h} L${h} ${s - 2} L2 ${h}Z`;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {fill === 'carrier' && <path d={`M${h} 2 L${h} ${s - 2} L2 ${h}Z`} fill={color} />}
      <path d={path} fill={fill === 'affected' ? color : fill === 'mild' ? color : 'none'} fillOpacity={fill === 'mild' ? 0.3 : 1} strokeDasharray={fill === 'mild' ? '4 3' : undefined} stroke={fill === 'clear' ? 'var(--ink-2)' : color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function Person({ sex, carrier, color, size = 28 }: { sex: 'F' | 'M'; carrier?: boolean; color: string; size?: number }) {
  const s = size, h = s / 2;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      {sex === 'F' ? (
        <>
          {carrier && <path d={`M${h} 2 a${h - 2} ${h - 2} 0 0 0 0 ${s - 4}Z`} fill={color} />}
          <circle cx={h} cy={h} r={h - 2} fill="none" stroke={color} strokeWidth={2} />
        </>
      ) : (
        <>
          {carrier && <rect x={2} y={2} width={h - 2} height={s - 4} fill={color} />}
          <rect x={2} y={2} width={s - 4} height={s - 4} fill="none" stroke={color} strokeWidth={2} />
        </>
      )}
    </svg>
  );
}

/** Four pregnancies, drawn the way a counsellor sketches them: 1 affected, 2 carriers, 1 neither. */
export function FourChildren({ labels }: { labels: { affected: string; carrier: string; clear: string } }) {
  const kids: Fill[] = ['affected', 'carrier', 'carrier', 'clear'];
  return (
    <div className="flex items-end gap-3" role="img" aria-label={`${labels.affected}; ${labels.carrier}; ${labels.clear}`}>
      {kids.map((k, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <Diamond fill={k} size={44} />
        </div>
      ))}
    </div>
  );
}

/** The mark: a square and a circle joined, the pedigree's couple. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <rect x="2" y="9" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="22" cy="15" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 13.5h1.6M14 16.5h1.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
