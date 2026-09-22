import { useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

export default function CorrectionForm({ lot, onSubmit, onCancel }) {
  const [quantite, setQuantite] = useState(lot.quantite_lot);
  const [datePeremption, setDatePeremption] = useState(lot.date_peremption.slice(0, 10));
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(valeur) {
    return Number(valeur) < 0 ? 'La quantite ne peut pas etre negative' : '';
  }

  function majQuantite(valeur) {
    setQuantite(valeur);
    // Validation en temps reel : si le champ etait en erreur, on le revalide a chaque frappe.
    if (erreur) {
      setErreur(valider(valeur));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = valider(quantite);
    setErreur(err);
    if (err) return;
    setEnvoiEnCours(true);
    try {
      await onSubmit({ quantite_lot: Number(quantite), date_peremption: datePeremption });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">Correction du lot {lot.numero_lot} ({lot.nom_medicament})</div>
      <div className="form-grid">
        <div className={`form-field${erreur ? ' has-error' : ''}`}>
          <label htmlFor="correction-quantite">Quantite corrigee<span className="required-mark">*</span></label>
          <input id="correction-quantite" type="number" min="0" value={quantite} onChange={(e) => majQuantite(e.target.value)} required
            aria-invalid={Boolean(erreur)} aria-describedby={erreur ? 'correction-quantite-err' : undefined} />
          {erreur && <span className="field-error" id="correction-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreur}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="correction-date-peremption">Date de peremption</label>
          <input id="correction-date-peremption" type="date" value={datePeremption} onChange={(e) => setDatePeremption(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Enregistrer la correction
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
