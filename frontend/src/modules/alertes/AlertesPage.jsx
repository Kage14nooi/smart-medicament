import { useEffect, useState } from 'react';
import { BellOff, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonCards } from '../../components/Skeleton.jsx';

const RISQUE_LABELS = { FAIBLE: 'Faible', MOYEN: 'Moyen', ELEVE: 'Eleve', CRITIQUE: 'Critique' };

export default function AlertesPage() {
  const [alertes, setAlertes] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('OUVERTE');
  const [aTraiter, setATraiter] = useState(null);
  const [traitementEnCours, setTraitementEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const query = filtreStatut ? `?statut=${filtreStatut}` : '';
      setAlertes(await api.get(`/alertes${query}`));
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    setChargement(true);
    charger();
    const interval = setInterval(charger, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreStatut]);

  async function confirmerTraitement() {
    setTraitementEnCours(true);
    try {
      await api.put(`/alertes/${aTraiter.id_alerte}/traiter`);
      showToast(`Alerte sur "${aTraiter.nom_medicament}" marquee comme traitee.`);
      setATraiter(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setTraitementEnCours(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Alertes</h2>
      <p className="page-subtitle">Liste triee par niveau de risque - mise a jour automatique toutes les 5 secondes</p>

      <div className="filter-bar">
        <label htmlFor="filtre-alertes" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          Filtrer par statut
        </label>
        <select id="filtre-alertes" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="OUVERTE">Ouvertes</option>
          <option value="TRAITEE">Traitees</option>
          <option value="">Toutes</option>
        </select>
      </div>

      {chargement ? (
        <SkeletonCards count={3} />
      ) : alertes.length === 0 ? (
        <div className="card">
          <EmptyState icon={BellOff} titre="Aucune alerte" message="Aucune alerte a afficher pour ce filtre." />
        </div>
      ) : (
        alertes.map((a) => (
          <div key={a.id_alerte} className={`alert-card risque-${a.niveau_risque}`}>
            <div>
              <strong>{a.nom_medicament}</strong>
              <div className="alert-card-meta">
                Score final : {a.score_final ?? '-'} - Cree le {new Date(a.date_creation).toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="alert-card-actions">
              <span className={`badge badge-${a.niveau_risque.toLowerCase()}`}>{RISQUE_LABELS[a.niveau_risque]}</span>
              <span className={`badge badge-${a.statut_alerte.toLowerCase()}`}>{a.statut_alerte === 'OUVERTE' ? 'Ouverte' : 'Traitee'}</span>
              {a.statut_alerte === 'OUVERTE' && (
                <button className="btn btn-primary btn-small" onClick={() => setATraiter(a)}>
                  <ShieldCheck size={13} aria-hidden="true" /> Traiter
                </button>
              )}
            </div>
          </div>
        ))
      )}

      <ConfirmDialog
        open={Boolean(aTraiter)}
        titre="Traiter l'alerte"
        message={aTraiter ? `Confirmer le traitement de l'alerte sur "${aTraiter.nom_medicament}" ?` : ''}
        confirmLabel="Confirmer le traitement"
        onConfirm={confirmerTraitement}
        onCancel={() => setATraiter(null)}
        enCours={traitementEnCours}
      />
    </div>
  );
}
