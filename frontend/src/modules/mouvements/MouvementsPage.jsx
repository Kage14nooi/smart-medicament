import { useEffect, useState } from 'react';
import { TrendingDown, AlertTriangle, History } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import MouvementForm from './MouvementForm.jsx';

const TYPE_LABELS = { ENTREE: 'Entree', DISTRIBUTION: 'Distribution', AJUSTEMENT: 'Ajustement', RETRAIT: 'Retrait' };

export default function MouvementsPage() {
  const [medicaments, setMedicaments] = useState([]);
  const [mouvements, setMouvements] = useState([]);
  const [dernierResultat, setDernierResultat] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const [meds, mvts] = await Promise.all([
        api.get('/medicaments?actif=true'),
        api.get('/mouvements'),
      ]);
      setMedicaments(meds);
      setMouvements(mvts);
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleCreer(payload) {
    try {
      const result = await api.post('/mouvements', payload);
      setDernierResultat(result);

      const verif = result.verification_stock;
      if (verif && verif.sous_seuil_critique) {
        showToast(
          `Mouvement enregistre. Stock sous le seuil critique pour "${verif.nom_medicament}" -> pipeline SMA declenche (verifiez les alertes dans ~5-10s).`,
          'info'
        );
      } else {
        showToast('Mouvement enregistre avec succes. Stock au-dessus du seuil de securite.');
      }
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Mouvements</h2>
      <p className="page-subtitle">Simulateur de mouvements de stock - point d'entree du pipeline SMA</p>

      <MouvementForm medicaments={medicaments} onSubmit={handleCreer} />

      {dernierResultat && dernierResultat.verification_stock && (
        <div className="card">
          <div className="section-title">Resultat de la verification de stock (agent Monitoring)</div>
          <div className="score-breakdown">
            <div className="score-item">
              <div className="score-label">Stock actuel</div>
              <div className="score-value">{dernierResultat.verification_stock.stock_actuel}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Consommation moy./jour</div>
              <div className="score-value">{dernierResultat.verification_stock.consommation_moyenne_journaliere}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Jours de stock restant</div>
              <div className="score-value">{dernierResultat.verification_stock.jours_de_stock_restant ?? '-'}</div>
            </div>
            <div className="score-item">
              <div className="score-label">Sous seuil critique ?</div>
              <div
                className="score-value"
                style={{ color: dernierResultat.verification_stock.sous_seuil_critique ? '#c0392b' : '#2e8b57', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {dernierResultat.verification_stock.sous_seuil_critique
                  ? <><TrendingDown size={16} aria-hidden="true" /> Oui - alerte declenchee</>
                  : 'Non'}
              </div>
            </div>
          </div>
          {dernierResultat.verification_stock.sous_seuil_critique && (
            <p style={{ color: '#667085', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-warning)' }} />
              <span>
                Le pipeline SMA a ete declenche en arriere-plan (Redis -&gt; agent Prediction -&gt; agent Decision).
                Consultez l'ecran Alertes ou Commandes dans quelques secondes pour voir le resultat.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="card">
        <div className="section-title">Historique recent des mouvements</div>
        {chargement ? <SkeletonTable rows={5} /> : mouvements.length === 0 ? (
          <EmptyState icon={History} titre="Aucun mouvement" message="Aucun mouvement enregistre." />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Medicament</th><th>Type</th><th className="col-num">Quantite</th><th>Source</th></tr>
              </thead>
              <tbody>
                {mouvements.map((m) => (
                  <tr key={m.id_mouvement}>
                    <td>{new Date(m.date_mouvement).toLocaleString('fr-FR')}</td>
                    <td>{m.nom_medicament}</td>
                    <td>{TYPE_LABELS[m.type_mouvement]}</td>
                    <td className="col-num">{m.quantite_mouvement}</td>
                    <td>{m.source_mouvement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
