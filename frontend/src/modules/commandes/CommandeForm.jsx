import { useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

export default function CommandeForm({ medicaments, fournisseurs, onSubmit, onCancel }) {
  const [form, setForm] = useState({ id_medicament: '', id_fournisseur: '', quantite_commandee: 1, date_livraison_prevue: '' });
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(donnees) {
    const err = {};
    if (!donnees.id_medicament) err.id_medicament = 'Le medicament est requis';
    if (Number(donnees.quantite_commandee) <= 0) err.quantite_commandee = 'Doit etre superieur a 0';
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
        id_medicament: Number(form.id_medicament),
        id_fournisseur: form.id_fournisseur ? Number(form.id_fournisseur) : null,
        quantite_commandee: Number(form.quantite_commandee),
        date_livraison_prevue: form.date_livraison_prevue || null,
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">Nouvelle commande manuelle</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.id_medicament ? ' has-error' : ''}`}>
          <label htmlFor="cmd-medicament">Medicament<span className="required-mark">*</span></label>
          <select id="cmd-medicament" value={form.id_medicament} onChange={(e) => majChamp('id_medicament', e.target.value)} required
            aria-invalid={Boolean(erreurs.id_medicament)} aria-describedby={erreurs.id_medicament ? 'cmd-medicament-err' : undefined}>
            <option value="">Selectionner...</option>
            {medicaments.map((m) => <option key={m.id_medicament} value={m.id_medicament}>{m.nom_medicament}</option>)}
          </select>
          {erreurs.id_medicament && <span className="field-error" id="cmd-medicament-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.id_medicament}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="cmd-fournisseur">Fournisseur</label>
          <select id="cmd-fournisseur" value={form.id_fournisseur} onChange={(e) => majChamp('id_fournisseur', e.target.value)}>
            <option value="">Non specifie</option>
            {fournisseurs.map((f) => <option key={f.id_fournisseur} value={f.id_fournisseur}>{f.nom_fournisseur}</option>)}
          </select>
        </div>
        <div className={`form-field${erreurs.quantite_commandee ? ' has-error' : ''}`}>
          <label htmlFor="cmd-quantite">Quantite<span className="required-mark">*</span></label>
          <input id="cmd-quantite" type="number" min="1" value={form.quantite_commandee} onChange={(e) => majChamp('quantite_commandee', e.target.value)} required
            aria-invalid={Boolean(erreurs.quantite_commandee)} aria-describedby={erreurs.quantite_commandee ? 'cmd-quantite-err' : undefined} />
          {erreurs.quantite_commandee && <span className="field-error" id="cmd-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.quantite_commandee}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="cmd-date-livraison">Date de livraison prevue</label>
          <input id="cmd-date-livraison" type="date" value={form.date_livraison_prevue} onChange={(e) => majChamp('date_livraison_prevue', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Creer la commande
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
