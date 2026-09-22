import { useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

const MOTIFS = [
  { value: 'PEREME', label: 'Perime' },
  { value: 'NON_UTILISE', label: 'Non utilise' },
  { value: 'NON_CONFORME', label: 'Non conforme' },
];

export default function RetraitForm({ lots, utilisateurs, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    id_lot: '', id_utilisateur: '', motif: 'PEREME', quantite_retiree: 1, justification: '',
  });
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  function valider(donnees) {
    const err = {};
    if (!donnees.id_lot) err.id_lot = 'Le lot est requis';
    if (!donnees.id_utilisateur) err.id_utilisateur = "L'utilisateur responsable est requis";
    if (Number(donnees.quantite_retiree) <= 0) err.quantite_retiree = 'Doit etre superieur a 0';
    if (!donnees.justification.trim() || donnees.justification.trim().length < 3) {
      err.justification = 'La justification est requise (au moins 3 caracteres)';
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
        id_lot: Number(form.id_lot),
        id_utilisateur: Number(form.id_utilisateur),
        motif: form.motif,
        quantite_retiree: Number(form.quantite_retiree),
        justification: form.justification,
      });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">Nouveau retrait / destruction (processus de conformite trace)</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.id_lot ? ' has-error' : ''}`}>
          <label htmlFor="retrait-lot">Lot concerne<span className="required-mark">*</span></label>
          <select id="retrait-lot" value={form.id_lot} onChange={(e) => majChamp('id_lot', e.target.value)} required
            aria-invalid={Boolean(erreurs.id_lot)} aria-describedby={erreurs.id_lot ? 'retrait-lot-err' : undefined}>
            <option value="">Selectionner...</option>
            {lots.map((l) => (
              <option key={l.id_lot} value={l.id_lot}>
                {l.numero_lot} - {l.nom_medicament} (qte disponible : {l.quantite_lot})
              </option>
            ))}
          </select>
          {erreurs.id_lot && <span className="field-error" id="retrait-lot-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.id_lot}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="retrait-motif">Motif<span className="required-mark">*</span></label>
          <select id="retrait-motif" value={form.motif} onChange={(e) => majChamp('motif', e.target.value)}>
            {MOTIFS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className={`form-field${erreurs.quantite_retiree ? ' has-error' : ''}`}>
          <label htmlFor="retrait-quantite">Quantite a retirer<span className="required-mark">*</span></label>
          <input id="retrait-quantite" type="number" min="1" value={form.quantite_retiree} onChange={(e) => majChamp('quantite_retiree', e.target.value)} required
            aria-invalid={Boolean(erreurs.quantite_retiree)} aria-describedby={erreurs.quantite_retiree ? 'retrait-quantite-err' : undefined} />
          {erreurs.quantite_retiree && <span className="field-error" id="retrait-quantite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.quantite_retiree}</span>}
        </div>
        <div className={`form-field${erreurs.id_utilisateur ? ' has-error' : ''}`}>
          <label htmlFor="retrait-utilisateur">Utilisateur responsable<span className="required-mark">*</span></label>
          <select id="retrait-utilisateur" value={form.id_utilisateur} onChange={(e) => majChamp('id_utilisateur', e.target.value)} required
            aria-invalid={Boolean(erreurs.id_utilisateur)} aria-describedby={erreurs.id_utilisateur ? 'retrait-utilisateur-err' : undefined}>
            <option value="">Selectionner...</option>
            {utilisateurs.map((u) => <option key={u.id_utilisateur} value={u.id_utilisateur}>{u.nom_utilisateur}</option>)}
          </select>
          {erreurs.id_utilisateur && <span className="field-error" id="retrait-utilisateur-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.id_utilisateur}</span>}
        </div>
        <div className={`form-field${erreurs.justification ? ' has-error' : ''}`} style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="retrait-justification">Justification<span className="required-mark">*</span></label>
          <textarea id="retrait-justification" rows="3" maxLength="255" value={form.justification} onChange={(e) => majChamp('justification', e.target.value)} required
            aria-invalid={Boolean(erreurs.justification)} aria-describedby={erreurs.justification ? 'retrait-justification-err' : undefined} />
          {erreurs.justification && <span className="field-error" id="retrait-justification-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.justification}</span>}
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Enregistrer le retrait
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
