import { useEffect, useState } from 'react';
import { X, Save, ListChecks } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';

export default function ConditionsPanel({ fournisseur, medicaments, onClose }) {
  const [conditions, setConditions] = useState([]);
  const [form, setForm] = useState({ id_medicament: '', delai_livraison_moyen_jours: 7, delai_livraison_max_jours: 14, prix_achat: 0 });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const { showToast } = useToast();

  async function charger() {
    try {
      const data = await api.get(`/fournisseurs/${fournisseur.id_fournisseur}/conditions`);
      setConditions(data);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  useEffect(() => { charger(); }, [fournisseur]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.id_medicament) {
      showToast('Veuillez selectionner un medicament', 'error');
      return;
    }
    setEnvoiEnCours(true);
    try {
      await api.post(`/fournisseurs/${fournisseur.id_fournisseur}/conditions`, {
        id_medicament: Number(form.id_medicament),
        delai_livraison_moyen_jours: Number(form.delai_livraison_moyen_jours),
        delai_livraison_max_jours: Number(form.delai_livraison_max_jours),
        prix_achat: Number(form.prix_achat),
      });
      showToast('Condition enregistree avec succes.');
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="section-title">Conditions pour {fournisseur.nom_fournisseur}</div>
        <button className="btn btn-secondary btn-small" onClick={onClose}>
          <X size={13} aria-hidden="true" /> Fermer
        </button>
      </div>

      {conditions.length === 0 ? (
        <EmptyState icon={ListChecks} titre="Aucune condition" message="Aucune condition definie pour ce fournisseur." />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Medicament</th><th className="col-num">Delai moyen (j)</th><th className="col-num">Delai max (j)</th><th className="col-num">Prix d'achat</th></tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c.id_medicament}>
                  <td>{c.nom_medicament}</td>
                  <td className="col-num">{c.delai_livraison_moyen_jours}</td>
                  <td className="col-num">{c.delai_livraison_max_jours}</td>
                  <td className="col-num">{c.prix_achat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }} noValidate>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="cond-medicament">Medicament</label>
            <select id="cond-medicament" value={form.id_medicament} onChange={(e) => setForm({ ...form, id_medicament: e.target.value })}>
              <option value="">Selectionner...</option>
              {medicaments.map((m) => <option key={m.id_medicament} value={m.id_medicament}>{m.nom_medicament}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="cond-delai-moyen">Delai moyen (jours)</label>
            <input id="cond-delai-moyen" type="number" min="1" value={form.delai_livraison_moyen_jours} onChange={(e) => setForm({ ...form, delai_livraison_moyen_jours: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="cond-delai-max">Delai max (jours)</label>
            <input id="cond-delai-max" type="number" min="1" value={form.delai_livraison_max_jours} onChange={(e) => setForm({ ...form, delai_livraison_max_jours: e.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="cond-prix">Prix d'achat</label>
            <input id="cond-prix" type="number" min="0" step="0.01" value={form.prix_achat} onChange={(e) => setForm({ ...form, prix_achat: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
            {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            Enregistrer la condition
          </button>
        </div>
      </form>
    </div>
  );
}
