import { useEffect, useState } from 'react';
import { RefreshCw, LineChart as LineChartIcon } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonLines } from '../../components/Skeleton.jsx';
import CoefficientsChart from './CoefficientsChart.jsx';

const RISQUE_LABELS = { FAIBLE: 'Faible', MOYEN: 'Moyen', ELEVE: 'Eleve', CRITIQUE: 'Critique' };

export default function PrevisionsPage() {
  const [medicaments, setMedicaments] = useState([]);
  const [profils, setProfils] = useState([]);
  const [idMedicament, setIdMedicament] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [calculEnCours, setCalculEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  const medicamentSelectionne = medicaments.find((m) => m.id_medicament === Number(idMedicament));
  const profilSelectionne = medicamentSelectionne
    ? profils.find((p) => p.id_profil === medicamentSelectionne.id_profil_saisonnier)
    : null;
  const derniere = predictions[0];
  const moisCourant = new Date().getMonth() + 1;

  async function chargerListes() {
    try {
      const [meds, prof] = await Promise.all([
        api.get('/medicaments?actif=true'),
        api.get('/medicaments/profils-saisonniers'),
      ]);
      setMedicaments(meds);
      setProfils(prof);
      if (meds.length > 0) setIdMedicament(String(meds[0].id_medicament));
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  async function chargerPredictions(id) {
    if (!id) return;
    try {
      setPredictions(await api.get(`/predictions/${id}`));
    } catch (err) {
      showToast(`Erreur de chargement des previsions : ${err.message}`, 'error');
    }
  }

  useEffect(() => { chargerListes(); }, []);
  useEffect(() => { if (idMedicament) chargerPredictions(idMedicament); }, [idMedicament]);

  async function handleRecalculer() {
    setCalculEnCours(true);
    try {
      await api.post(`/predictions/${idMedicament}/calculer`, {});
      showToast('Score de risque recalcule avec succes.');
      await chargerPredictions(idMedicament);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setCalculEnCours(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Previsions</h2>
      <p className="page-subtitle">Detail du score de risque de penurie par medicament (agent Prediction)</p>

      {chargement ? (
        <div className="card"><SkeletonLines count={2} /></div>
      ) : (
        <div className="card">
          <div className="form-field" style={{ maxWidth: 400 }}>
            <label htmlFor="prev-medicament">Medicament</label>
            <select id="prev-medicament" value={idMedicament} onChange={(e) => setIdMedicament(e.target.value)}>
              {medicaments.map((m) => <option key={m.id_medicament} value={m.id_medicament}>{m.nom_medicament}</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleRecalculer} disabled={calculEnCours || !idMedicament}>
              {calculEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
              {calculEnCours ? 'Calcul en cours...' : 'Recalculer maintenant'}
            </button>
          </div>
        </div>
      )}

      {derniere ? (
        <div className="card">
          <div className="section-title">
            Derniere prediction ({new Date(derniere.date_prediction).toLocaleString('fr-FR')})
            <span className={`badge badge-${derniere.niveau_risque.toLowerCase()}`}>
              {RISQUE_LABELS[derniere.niveau_risque]}
            </span>
          </div>
          <div className="score-breakdown">
            <div className="score-item">
              <div className="score-label">score_rop</div>
              <div className="score-value">{Number(derniere.score_rop).toFixed(3)}</div>
            </div>
            <div className="score-item">
              <div className="score-label">score_ml (avant ajustement)</div>
              <div className="score-value">{Number(derniere.score_ml).toFixed(3)}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Facteur saisonnier (mois courant)</div>
              <div className="score-value">{Number(derniere.facteur_saisonnier).toFixed(2)}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Poids VED ({medicamentSelectionne?.categorie_ved})</div>
              <div className="score-value">
                {medicamentSelectionne?.categorie_ved === 'V' ? '1.30' : medicamentSelectionne?.categorie_ved === 'E' ? '1.10' : '0.90'}
              </div>
            </div>
            <div className="score-item">
              <div className="score-label">score_final</div>
              <div className="score-value stat-value-alert">{Number(derniere.score_final).toFixed(3)}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Horizon (jours)</div>
              <div className="score-value">{derniere.horizon_jours}</div>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.75rem' }}>Version du modele : {derniere.modele_version}</p>
        </div>
      ) : !chargement && (
        <div className="card">
          <EmptyState icon={LineChartIcon} titre="Aucune prediction" message='Aucune prediction enregistree pour ce medicament. Cliquez sur "Recalculer maintenant".' />
        </div>
      )}

      {profilSelectionne && (
        <div className="card">
          <div className="section-title">
            Profil saisonnier : {profilSelectionne.nom_profil} - mois courant mis en evidence en rouge
          </div>
          <CoefficientsChart coefficients={profilSelectionne.coefficients} moisCourant={moisCourant} />
        </div>
      )}

      <div className="card">
        <div className="section-title">Historique des predictions</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Date</th><th className="col-num">score_rop</th><th className="col-num">score_ml</th><th className="col-num">Facteur saisonnier</th><th className="col-num">score_final</th><th>Niveau de risque</th></tr>
            </thead>
            <tbody>
              {predictions.length === 0 ? (
                <tr><td colSpan="6"><EmptyState message="Aucun historique." /></td></tr>
              ) : predictions.map((p) => (
                <tr key={p.id_prediction}>
                  <td>{new Date(p.date_prediction).toLocaleString('fr-FR')}</td>
                  <td className="col-num">{Number(p.score_rop).toFixed(3)}</td>
                  <td className="col-num">{Number(p.score_ml).toFixed(3)}</td>
                  <td className="col-num">{Number(p.facteur_saisonnier).toFixed(2)}</td>
                  <td className="col-num">{Number(p.score_final).toFixed(3)}</td>
                  <td><span className={`badge badge-${p.niveau_risque.toLowerCase()}`}>{RISQUE_LABELS[p.niveau_risque]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
