import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, ArrowRight, Inbox } from 'lucide-react';
import { api } from '../../api/client.js';
import { SkeletonCards } from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';

const RISQUE_LABELS = { FAIBLE: 'Faible', MOYEN: 'Moyen', ELEVE: 'Eleve', CRITIQUE: 'Critique' };

export default function DashboardPage() {
  const [indicateurs, setIndicateurs] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargementInitial, setChargementInitial] = useState(true);

  async function charger() {
    try {
      const data = await api.get('/dashboard/indicateurs');
      setIndicateurs(data);
      setErreur(null);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargementInitial(false);
    }
  }

  useEffect(() => {
    charger();
    // Polling ~5s pour un affichage quasi temps reel des alertes/indicateurs
    const interval = setInterval(charger, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="page-title">Tableau de bord</h2>
      <p className="page-subtitle">Vue d'ensemble du depot - mise a jour automatique toutes les 5 secondes</p>

      {erreur && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <div>Erreur de chargement : {erreur}</div>
            <div className="error-banner-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={charger}>
                <RefreshCw size={13} aria-hidden="true" /> Reessayer
              </button>
            </div>
          </div>
        </div>
      )}

      {chargementInitial && !indicateurs && <SkeletonCards count={5} />}

      {indicateurs && (
        <>
          <div className="card-grid">
            <div className="stat-card">
              <div className="stat-label">Medicaments actifs</div>
              <div className="stat-value">{indicateurs.nb_medicaments_actifs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Medicaments sous seuil critique</div>
              <div className={`stat-value${indicateurs.nb_sous_seuil > 0 ? ' stat-value-alert' : ''}`}>
                {indicateurs.nb_sous_seuil}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Alertes ouvertes</div>
              <div className={`stat-value${indicateurs.nb_alertes_ouvertes > 0 ? ' stat-value-warning' : ''}`}>
                {indicateurs.nb_alertes_ouvertes}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Commandes en attente</div>
              <div className="stat-value">{indicateurs.nb_commandes_en_attente}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Lots proches peremption (&lt;30j)</div>
              <div className={`stat-value${indicateurs.nb_lots_peremption_proche > 0 ? ' stat-value-alert' : ''}`}>
                {indicateurs.nb_lots_peremption_proche}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Repartition des alertes ouvertes par niveau de risque</div>
            {indicateurs.repartition_risque.length === 0 ? (
              <EmptyState icon={Inbox} message="Aucune alerte ouverte actuellement." />
            ) : (
              <div className="card-grid">
                {indicateurs.repartition_risque.map((r) => (
                  <div key={r.niveau_risque} className="stat-card">
                    <div className="stat-label">{RISQUE_LABELS[r.niveau_risque]}</div>
                    <div className="stat-value">{r.total}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title">Dernieres alertes ouvertes</div>
            {indicateurs.dernieres_alertes.length === 0 ? (
              <EmptyState icon={Inbox} message="Aucune alerte a afficher." />
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Medicament</th><th>Niveau de risque</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {indicateurs.dernieres_alertes.map((a) => (
                      <tr key={a.id_alerte}>
                        <td>{a.nom_medicament}</td>
                        <td><span className={`badge badge-${a.niveau_risque.toLowerCase()}`}>{a.niveau_risque}</span></td>
                        <td>{new Date(a.date_creation).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <Link to="/alertes" className="link-button">Voir toutes les alertes <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Acces rapides</div>
            <div className="toolbar-actions">
              <Link to="/mouvements" className="btn btn-primary">Enregistrer un mouvement</Link>
              <Link to="/commandes" className="btn btn-secondary">Voir les commandes</Link>
              <Link to="/previsions" className="btn btn-secondary">Consulter les previsions</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
