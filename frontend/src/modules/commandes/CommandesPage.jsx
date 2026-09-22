import { useEffect, useState } from 'react';
import { Plus, X, Info } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import CommandeForm from './CommandeForm.jsx';
import AjustementForm from './AjustementForm.jsx';
import CommandesTable from './CommandesTable.jsx';

export default function CommandesPage() {
  const [commandes, setCommandes] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [enAjustement, setEnAjustement] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const query = filtreStatut ? `?statut=${filtreStatut}` : '';
      const [cmds, meds, four] = await Promise.all([
        api.get(`/commandes${query}`),
        api.get('/medicaments?actif=true'),
        api.get('/fournisseurs'),
      ]);
      setCommandes(cmds);
      setMedicaments(meds);
      setFournisseurs(four);
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, [filtreStatut]);

  async function handleCreer(payload) {
    try {
      await api.post('/commandes', payload);
      showToast('Commande manuelle creee avec succes.');
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleAjuster(payload) {
    try {
      const result = await api.put(`/commandes/${enAjustement.id_commande}`, payload);
      showToast(
        result.mouvement_entree_cree
          ? 'Commande mise a jour : stock augmente automatiquement (livraison enregistree).'
          : 'Commande mise a jour avec succes.'
      );
      setEnAjustement(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Commandes</h2>
      <p className="page-subtitle" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Info size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Le SMA propose des commandes (badge IA) ; la decision finale reste toujours humaine.
          L'ajustement d'une commande EST la validation.
        </span>
      </p>

      <div className="toolbar">
        <div className="filter-bar">
          <label htmlFor="filtre-commandes" className="sr-only" style={{ display: 'none' }}>Filtrer par statut</label>
          <select id="filtre-commandes" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="LIVREE">Livree</option>
            <option value="EN_RETARD">En retard</option>
            <option value="ANNULEE">Annulee</option>
          </select>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => { setEnAjustement(null); setShowForm(!showForm); }}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Nouvelle commande manuelle'}
          </button>
        </div>
      </div>

      {showForm && (
        <CommandeForm medicaments={medicaments} fournisseurs={fournisseurs} onSubmit={handleCreer} onCancel={() => setShowForm(false)} />
      )}
      {enAjustement && (
        <AjustementForm commande={enAjustement} fournisseurs={fournisseurs} onSubmit={handleAjuster} onCancel={() => setEnAjustement(null)} />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : (
          <CommandesTable commandes={commandes} onAjuster={(c) => { setEnAjustement(c); setShowForm(false); }} />
        )}
      </div>
    </div>
  );
}
