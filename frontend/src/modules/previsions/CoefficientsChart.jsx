const MOIS_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Petit graphique SVG "fait main" (pas de lib externe) affichant les 12
 * coefficients saisonniers du profil, avec le mois courant mis en evidence.
 * Couleurs pilotees par variables CSS pour rester coherentes en mode sombre.
 */
export default function CoefficientsChart({ coefficients, moisCourant }) {
  const width = 720;
  const height = 220;
  const padding = 36;
  const values = coefficients.map((c) => Number(c.coefficient));
  const maxVal = Math.max(...values, 1.5);
  const minVal = Math.min(...values, 0.5);
  const rangeVal = maxVal - minVal || 1;

  const points = values.map((v, i) => {
    const x = padding + (i * (width - 2 * padding)) / (values.length - 1);
    const y = height - padding - ((v - minVal) / rangeVal) * (height - 2 * padding);
    return { x, y, v, mois: i + 1 };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const baselineY = height - padding - ((1 - minVal) / rangeVal) * (height - 2 * padding);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="chart-wrapper" role="img" aria-label="Coefficients saisonniers par mois">
      <defs>
        <linearGradient id="coef-area-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zone sous la courbe pour un rendu plus "SaaS" */}
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
        fill="url(#coef-area-gradient)"
        stroke="none"
      />
      {/* ligne de base a 1.00 */}
      <line
        x1={padding} x2={width - padding}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--color-border-strong)" strokeDasharray="4 4"
      />
      <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <g key={p.mois}>
          <circle
            cx={p.x} cy={p.y} r={p.mois === moisCourant ? 7 : 4}
            fill={p.mois === moisCourant ? 'var(--color-danger)' : 'var(--color-primary)'}
            stroke="var(--color-surface)"
            strokeWidth={p.mois === moisCourant ? 2 : 1}
          />
          <text x={p.x} y={height - 10} textAnchor="middle" fontSize="11" fill={p.mois === moisCourant ? 'var(--color-danger)' : 'var(--color-text-muted)'} fontWeight={p.mois === moisCourant ? '700' : '400'}>
            {MOIS_LABELS[p.mois - 1]}
          </text>
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fill="var(--color-text)">
            {p.v.toFixed(2)}
          </text>
        </g>
      ))}
    </svg>
  );
}
