import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import LotForm from './LotForm.jsx';
import CorrectionForm from './CorrectionForm.jsx';
import LotsTable from './LotsTable.jsx';

export default function LotsPage() {
  const [lots, setLots] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [enCorrection, setEnCorrection] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const [lotsData, meds, four] = await Promise.all([
        api.get('/lots'),
        api.get('/medicaments?actif=true'),
        api.get('/fournisseurs'),
      ]);
      // deja triee par date_peremption par l'agent, mais on s'assure du tri cote client aussi
      lotsData.sort((a, b) => new Date(a.date_peremption) - new Date(b.date_peremption));
      setLots(lotsData);
      setMedicaments(meds);
      setFournisseurs(four);
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleReception(payload) {
    try {
      await api.post('/lots/reception', payload);
      showToast('Lot receptionne avec succes, stock mis a jour.');
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleCorrection(payload) {
    try {
      await api.put(`/lots/${enCorrection.id_lot}`, payload);
      showToast('Lot corrige avec succes.');
      setEnCorrection(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Lots &amp; peremption</h2>
      <p className="page-subtitle">
        Code couleur : <span className="pill-rouge">rouge = urgent (&lt;30j)</span>,{' '}
        <span className="pill-orange">orange = a surveiller (&lt;90j)</span>,{' '}
        <span className="pill-vert">vert = OK</span>
      </p>

      <div className="toolbar">
        <div />
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => { setEnCorrection(null); setShowForm(!showForm); }}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Receptionner un lot'}
          </button>
        </div>
      </div>

      {showForm && (
        <LotForm medicaments={medicaments} fournisseurs={fournisseurs} onSubmit={handleReception} onCancel={() => setShowForm(false)} />
      )}
      {enCorrection && (
        <CorrectionForm lot={enCorrection} onSubmit={handleCorrection} onCancel={() => setEnCorrection(null)} />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : (
          <LotsTable lots={lots} onCorriger={(l) => { setEnCorrection(l); setShowForm(false); }} />
        )}
      </div>
    </div>
  );
}
