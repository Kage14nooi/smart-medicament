import { useEffect, useRef, useState } from 'react';
import { AlertCircle, KeyRound, Save, X } from 'lucide-react';

export default function ResetPasswordDialog({ utilisateur, onSubmit, onCancel }) {
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const open = Boolean(utilisateur);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && boxRef.current) {
        const focusables = boxRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) {
      setNouveauMotDePasse('');
      setErreur('');
    }
  }, [open]);

  if (!utilisateur) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (nouveauMotDePasse.length < 4) {
      setErreur('Le mot de passe doit comporter au moins 4 caracteres');
      return;
    }
    setEnvoiEnCours(true);
    try {
      await onSubmit(nouveauMotDePasse);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function majMotDePasse(valeur) {
    setNouveauMotDePasse(valeur);
    if (erreur) {
      setErreur(valeur.length < 4 ? 'Le mot de passe doit comporter au moins 4 caracteres' : '');
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="modal-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        <h3 id="reset-password-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={18} aria-hidden="true" />
          Reinitialiser le mot de passe
        </h3>
        <p>Definir un nouveau mot de passe pour {utilisateur.nom_utilisateur}.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className={`form-field${erreur ? ' has-error' : ''}`}>
            <label htmlFor="reset-nouveau-mdp">Nouveau mot de passe<span className="required-mark">*</span></label>
            <input
              id="reset-nouveau-mdp"
              ref={inputRef}
              type="text"
              value={nouveauMotDePasse}
              onChange={(e) => majMotDePasse(e.target.value)}
              required
              aria-invalid={Boolean(erreur)}
              aria-describedby={erreur ? 'reset-nouveau-mdp-err' : undefined}
            />
            {erreur && <span className="field-error" id="reset-nouveau-mdp-err"><AlertCircle size={13} aria-hidden="true" />{erreur}</span>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={envoiEnCours}>
              <X size={15} aria-hidden="true" /> Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={envoiEnCours}>
              {envoiEnCours ? <span className="btn-spinner" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              Reinitialiser
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
