import { useState } from 'react';
import { AlertCircle, Save, X, Info } from 'lucide-react';

const STATUTS = [
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'LIVREE', label: 'Livree' },
  { value: 'EN_RETARD', label: 'En retard' },
  { value: 'ANNULEE', label: 'Annulee' },
];

/**
 * L'ajustement d'une commande EST la validation humaine : il n'y a pas de
 * bouton "valider" separe. Le gerant modifie quantite/statut/fournisseur
 * directement, ce qui vaut confirmation.
 */
export default function AjustementForm({ commande, fournisseurs, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    quantite_commandee: commande.quantite_commandee,
    statut_commande: commande.statut_commande,
    id_fournisseur: commande.id_fournisseur || '',
  });
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(donnees) {
    const err = {};
    if (Number(donnees.quantite_commandee) <= 0) {
      err.quantite_commandee = 'La quantite doit etre superieure a 0';
    }
    return err;
  }

  function majChamp(champ, valeur) {
    const next = { ...form, [champ]: valeur };
    setForm(next);
    // Validation en temps reel : si le champ etait en erreur, on le revalide a chaque frappe.
    if (erreurs[champ]) {
      setErreurs(valider(next));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = valider(form);
    setErreurs(err);
    if (Object.keys(err).length > 0) return;
    setEnvoiEnCours(true);
    try {
      await onSubmit({
        quantite_commandee: Number(form.quantite_commandee),
        statut_commande: form.statut_commande,
        id_fournisseur: form.id_fournisseur ? Number(form.id_fournisseur) : null,
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">
        Ajuster la commande #{commande.id_commande} ({commande.nom_medicament})
        {commande.source_commande === 'IA' && (
          <span className="badge badge-ia" style={{ marginLeft: 10 }}>Proposition IA</span>
        )}
      </div>
      <p className="page-subtitle" style={{ marginTop: -6 }}>
        L'ajustement de cette commande vaut validation humaine : il n'y a pas d'etape de validation separee.
      </p>
      <div className="form-grid">
        <div className={`form-field${erreurs.quantite_commandee ? ' has-error' : ''}`}>
          <label htmlFor="ajust-quantite">Quantite commandee<span className="required-mark">*</span></label>
          <input id="ajust-quantite" type="number" min="1" value={form.quantite_commandee} onChange={(e) => majChamp('quantite_commandee', e.target.value)} required
            aria-invalid={Boolean(erreurs.quantite_commandee)} aria-describedby={erreurs.quantite_commandee ? 'ajust-quantite-err' : undefined} />
          {erreurs.quantite_commandee && <span className="field-error" id="ajust-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.quantite_commandee}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="ajust-statut">Statut</label>
          <select id="ajust-statut" value={form.statut_commande} onChange={(e) => majChamp('statut_commande', e.target.value)}>
            {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="ajust-fournisseur">Fournisseur</label>
          <select id="ajust-fournisseur" value={form.id_fournisseur} onChange={(e) => majChamp('id_fournisseur', e.target.value)}>
            <option value="">Non specifie</option>
            {fournisseurs.map((f) => <option key={f.id_fournisseur} value={f.id_fournisseur}>{f.nom_fournisseur}</option>)}
          </select>
        </div>
      </div>
      {form.statut_commande === 'LIVREE' && (
        <p className="info-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: 'var(--color-success, #1e7145)', fontSize: 13 }}>
          <Info size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Passer au statut "Livree" creera automatiquement un mouvement d'entree et augmentera le stock du medicament.</span>
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Enregistrer l'ajustement
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
