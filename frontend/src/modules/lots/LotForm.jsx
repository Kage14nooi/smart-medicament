import { useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

export default function LotForm({ medicaments, fournisseurs, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    id_medicament: '', id_fournisseur: '', numero_lot: '', date_peremption: '', quantite_lot: 1,
  });
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(donnees) {
    const err = {};
    if (!donnees.id_medicament) err.id_medicament = 'Le medicament est requis';
    if (!donnees.numero_lot.trim()) err.numero_lot = 'Le numero de lot est requis';
    if (!donnees.date_peremption) err.date_peremption = 'La date de peremption est requise';
    if (Number(donnees.quantite_lot) <= 0) err.quantite_lot = 'Doit etre superieur a 0';
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
        numero_lot: form.numero_lot,
        date_peremption: form.date_peremption,
        quantite_lot: Number(form.quantite_lot),
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">Reception d'un nouveau lot</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.id_medicament ? ' has-error' : ''}`}>
          <label htmlFor="lot-medicament">Medicament<span className="required-mark">*</span></label>
          <select id="lot-medicament" value={form.id_medicament} onChange={(e) => majChamp('id_medicament', e.target.value)} required
            aria-invalid={Boolean(erreurs.id_medicament)} aria-describedby={erreurs.id_medicament ? 'lot-medicament-err' : undefined}>
            <option value="">Selectionner...</option>
            {medicaments.map((m) => <option key={m.id_medicament} value={m.id_medicament}>{m.nom_medicament}</option>)}
          </select>
          {erreurs.id_medicament && <span className="field-error" id="lot-medicament-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.id_medicament}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="lot-fournisseur">Fournisseur</label>
          <select id="lot-fournisseur" value={form.id_fournisseur} onChange={(e) => majChamp('id_fournisseur', e.target.value)}>
            <option value="">Non specifie</option>
            {fournisseurs.map((f) => <option key={f.id_fournisseur} value={f.id_fournisseur}>{f.nom_fournisseur}</option>)}
          </select>
        </div>
        <div className={`form-field${erreurs.numero_lot ? ' has-error' : ''}`}>
          <label htmlFor="lot-numero">Numero de lot<span className="required-mark">*</span></label>
          <input id="lot-numero" value={form.numero_lot} onChange={(e) => majChamp('numero_lot', e.target.value)} required
            aria-invalid={Boolean(erreurs.numero_lot)} aria-describedby={erreurs.numero_lot ? 'lot-numero-err' : undefined} />
          {erreurs.numero_lot && <span className="field-error" id="lot-numero-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.numero_lot}</span>}
        </div>
        <div className={`form-field${erreurs.date_peremption ? ' has-error' : ''}`}>
          <label htmlFor="lot-date-peremption">Date de peremption<span className="required-mark">*</span></label>
          <input id="lot-date-peremption" type="date" value={form.date_peremption} onChange={(e) => majChamp('date_peremption', e.target.value)} required
            aria-invalid={Boolean(erreurs.date_peremption)} aria-describedby={erreurs.date_peremption ? 'lot-date-peremption-err' : undefined} />
          {erreurs.date_peremption && <span className="field-error" id="lot-date-peremption-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.date_peremption}</span>}
        </div>
        <div className={`form-field${erreurs.quantite_lot ? ' has-error' : ''}`}>
          <label htmlFor="lot-quantite">Quantite receptionnee<span className="required-mark">*</span></label>
          <input id="lot-quantite" type="number" min="1" value={form.quantite_lot} onChange={(e) => majChamp('quantite_lot', e.target.value)} required
            aria-invalid={Boolean(erreurs.quantite_lot)} aria-describedby={erreurs.quantite_lot ? 'lot-quantite-err' : undefined} />
          {erreurs.quantite_lot && <span className="field-error" id="lot-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.quantite_lot}</span>}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Receptionner
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
