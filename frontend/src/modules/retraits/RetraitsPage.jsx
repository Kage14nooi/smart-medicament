import { useEffect, useState } from 'react';
import { Plus, X, Info } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import RetraitForm from './RetraitForm.jsx';
import RetraitsTable from './RetraitsTable.jsx';

export default function RetraitsPage() {
  const [retraits, setRetraits] = useState([]);
  const [lots, setLots] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const [retraitsData, lotsData, users] = await Promise.all([
        api.get('/retraits'),
        api.get('/lots'),
        api.get('/utilisateurs'),
      ]);
      setRetraits(retraitsData);
      setLots(lotsData.filter((l) => l.quantite_lot > 0));
      setUtilisateurs(users.filter((u) => u.actif));
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleCreer(payload) {
    try {
      await api.post('/retraits', payload);
      showToast('Retrait/destruction enregistre avec succes, stock mis a jour.');
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Retrait / Destruction</h2>
      <p className="page-subtitle" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Info size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Processus de conformite trace (motif, justification, utilisateur responsable) - jamais une simple correction de stock.
          Consultation seule apres creation (pas de modification ni suppression).
        </span>
      </p>

      <div className="toolbar">
        <div />
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Nouveau retrait'}
          </button>
        </div>
      </div>

      {showForm && (
        <RetraitForm lots={lots} utilisateurs={utilisateurs} onSubmit={handleCreer} onCancel={() => setShowForm(false)} />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : <RetraitsTable retraits={retraits} />}
      </div>
    </div>
  );
}
