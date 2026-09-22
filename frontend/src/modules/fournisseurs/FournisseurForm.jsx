import { useEffect, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

const VIDE = { nom_fournisseur: '', fiabilite_score: 0.8, contact: '' };

export default function FournisseurForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const estModification = Boolean(initial);

  useEffect(() => {
    setForm(initial ? {
      nom_fournisseur: initial.nom_fournisseur,
      fiabilite_score: initial.fiabilite_score,
      contact: initial.contact || '',
    } : VIDE);
    setErreurs({});
  }, [initial]);

  function valider(donnees) {
    const err = {};
    if (!donnees.nom_fournisseur.trim()) err.nom_fournisseur = 'Le nom est requis';
    const score = Number(donnees.fiabilite_score);
    if (Number.isNaN(score) || score < 0 || score > 1) err.fiabilite_score = 'Doit etre entre 0 et 1';
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
      await onSubmit({ ...form, fiabilite_score: Number(form.fiabilite_score) });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">{estModification ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.nom_fournisseur ? ' has-error' : ''}`}>
          <label htmlFor="four-nom">Nom du fournisseur<span className="required-mark">*</span></label>
          <input id="four-nom" value={form.nom_fournisseur} onChange={(e) => majChamp('nom_fournisseur', e.target.value)} required
            aria-invalid={Boolean(erreurs.nom_fournisseur)} aria-describedby={erreurs.nom_fournisseur ? 'four-nom-err' : undefined} />
          {erreurs.nom_fournisseur && <span className="field-error" id="four-nom-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.nom_fournisseur}</span>}
        </div>
        <div className={`form-field${erreurs.fiabilite_score ? ' has-error' : ''}`}>
          <label htmlFor="four-fiabilite">Score de fiabilite (0 a 1)<span className="required-mark">*</span></label>
          <input id="four-fiabilite" type="number" min="0" max="1" step="0.01" value={form.fiabilite_score} onChange={(e) => majChamp('fiabilite_score', e.target.value)} required
            aria-invalid={Boolean(erreurs.fiabilite_score)} aria-describedby={erreurs.fiabilite_score ? 'four-fiabilite-err' : undefined} />
          {erreurs.fiabilite_score && <span className="field-error" id="four-fiabilite-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.fiabilite_score}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="four-contact">Contact</label>
          <input id="four-contact" value={form.contact} onChange={(e) => majChamp('contact', e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
          {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          {estModification ? 'Enregistrer' : 'Creer'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
          <X size={15} aria-hidden="true" /> Annuler
        </button>
      </div>
    </form>
  );
}
