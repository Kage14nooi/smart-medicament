import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Boite de confirmation avec message NOMME (jamais "Etes-vous sur ?" generique).
 * Accessible : role="dialog", aria-modal, fermeture avec Echap, focus pose sur
 * le bouton d'annulation a l'ouverture, focus trap basique (Tab/Shift+Tab
 * restent a l'interieur de la boite).
 * Usage : <ConfirmDialog open={...} titre="..." message="Confirmer le traitement de l'alerte sur Paracetamol sirop ?" onConfirm={...} onCancel={...} />
 */
export default function ConfirmDialog({ open, titre, message, onConfirm, onCancel, confirmLabel = 'Confirmer', enCours = false }) {
  const boxRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();

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

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div
        className="modal-box"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h3 id="confirm-dialog-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} aria-hidden="true" style={{ color: 'var(--color-warning)' }} />
          {titre}
        </h3>
        <p id="confirm-dialog-message">{message}</p>
        <div className="modal-actions">
          <button ref={cancelRef} className="btn btn-secondary" onClick={onCancel} disabled={enCours}>Annuler</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={enCours}>
            {enCours && <span className="btn-spinner" aria-hidden="true" />}
            {enCours ? 'Traitement...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
