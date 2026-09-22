import { useEffect, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

const VIDE = { nom_utilisateur: '', email: '', role: 'GERANT' };

export default function UtilisateurForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const estModification = Boolean(initial);

  useEffect(() => {
    setForm(initial ? { nom_utilisateur: initial.nom_utilisateur, email: initial.email, role: initial.role } : VIDE);
    setErreurs({});
  }, [initial]);

  function valider(donnees) {
    const err = {};
    if (!donnees.nom_utilisateur.trim()) err.nom_utilisateur = 'Le nom est requis';
    if (!donnees.email.trim() || !donnees.email.includes('@')) err.email = 'Email invalide';
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
      await onSubmit(form);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="section-title">{estModification ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</div>
      <div className="form-grid">
        <div className={`form-field${erreurs.nom_utilisateur ? ' has-error' : ''}`}>
          <label htmlFor="util-nom">Nom complet<span className="required-mark">*</span></label>
          <input id="util-nom" value={form.nom_utilisateur} onChange={(e) => majChamp('nom_utilisateur', e.target.value)} required
            aria-invalid={Boolean(erreurs.nom_utilisateur)} aria-describedby={erreurs.nom_utilisateur ? 'util-nom-err' : undefined} />
          {erreurs.nom_utilisateur && <span className="field-error" id="util-nom-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.nom_utilisateur}</span>}
        </div>
        <div className={`form-field${erreurs.email ? ' has-error' : ''}`}>
          <label htmlFor="util-email">Email<span className="required-mark">*</span></label>
          <input id="util-email" type="email" value={form.email} onChange={(e) => majChamp('email', e.target.value)} required
            aria-invalid={Boolean(erreurs.email)} aria-describedby={erreurs.email ? 'util-email-err' : undefined} />
          {erreurs.email && <span className="field-error" id="util-email-err"><AlertCircle size={13} aria-hidden="true" />{erreurs.email}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="util-role">Role</label>
          <select id="util-role" value={form.role} onChange={(e) => majChamp('role', e.target.value)}>
            <option value="GERANT">Gerant</option>
            <option value="SUPERVISEUR">Superviseur de district</option>
          </select>
        </div>
      </div>
      <p style={{ color: '#667085', fontSize: 13 }}>
        Note : cette version ne comporte pas d'authentification reelle. Un mot de passe par defaut est attribue a la creation.
      </p>
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
