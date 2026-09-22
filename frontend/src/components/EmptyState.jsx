import { Inbox } from 'lucide-react';

/**
 * Etat vide enrichi : icone legere + message clair + action suggeree optionnelle.
 */
export default function EmptyState({ icon: Icon = Inbox, titre, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true"><Icon size={22} /></span>
      {titre && <div className="empty-state-title">{titre}</div>}
      {message && <div className="empty-state-message">{message}</div>}
      {action}
    </div>
  );
}
