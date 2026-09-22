/**
 * Etats de chargement coherents : cartes de stats et lignes de tableau,
 * a afficher pendant l'attente d'une reponse API (au lieu d'un ecran vide).
 */
export function SkeletonCards({ count = 4 }) {
  return (
    <div className="card-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <span className="skeleton skeleton-text skeleton-line-40" />
          <span className="skeleton skeleton-card" style={{ height: 28, marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

export function SkeletonLines({ count = 3 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skeleton skeleton-text skeleton-line-70" />
      ))}
    </div>
  );
}
