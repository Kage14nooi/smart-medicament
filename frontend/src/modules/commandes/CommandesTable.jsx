import { SlidersHorizontal, ClipboardList } from 'lucide-react';
import EmptyState from '../../components/EmptyState.jsx';

const STATUT_LABELS = { EN_ATTENTE: 'En attente', LIVREE: 'Livree', EN_RETARD: 'En retard', ANNULEE: 'Annulee' };

export default function CommandesTable({ commandes, onAjuster }) {
  if (commandes.length === 0) {
    return <EmptyState icon={ClipboardList} titre="Aucune commande" message="Aucune commande a afficher pour le moment." />;
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Medicament</th>
            <th>Fournisseur</th>
            <th className="col-num">Quantite</th>
            <th>Source</th>
            <th>Statut</th>
            <th>Date commande</th>
            <th>Livraison prevue</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((c) => (
            <tr key={c.id_commande}>
              <td>{c.id_commande}</td>
              <td>{c.nom_medicament}</td>
              <td>{c.nom_fournisseur || '-'}</td>
              <td className="col-num">{c.quantite_commandee}</td>
              <td>
                <span className={`badge ${c.source_commande === 'IA' ? 'badge-ia' : 'badge-manuelle'}`}>
                  {c.source_commande === 'IA' ? 'IA' : 'Manuelle'}
                </span>
              </td>
              <td><span className={`badge badge-${c.statut_commande.toLowerCase()}`}>{STATUT_LABELS[c.statut_commande]}</span></td>
              <td>{new Date(c.date_commande).toLocaleDateString('fr-FR')}</td>
              <td>{c.date_livraison_prevue ? new Date(c.date_livraison_prevue).toLocaleDateString('fr-FR') : '-'}</td>
              <td>
                <button className="btn btn-secondary btn-small" onClick={() => onAjuster(c)}>
                  <SlidersHorizontal size={13} aria-hidden="true" /> Ajuster
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
