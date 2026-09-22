import { Pencil, Archive, RotateCcw, Pill } from 'lucide-react';
import EmptyState from '../../components/EmptyState.jsx';

const VED_LABELS = { V: 'Vital', E: 'Essentiel', D: 'Discretionnaire' };

export default function MedicamentsTable({ medicaments, onEdit, onArchiver, onReactiver }) {
  if (medicaments.length === 0) {
    return <EmptyState icon={Pill} titre="Aucun medicament" message="Aucun medicament ne correspond a ce filtre pour le moment." />;
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>DCI</th>
            <th>VED</th>
            <th>ABC</th>
            <th>Profil saisonnier</th>
            <th className="col-num">Stock actuel</th>
            <th className="col-num">Stock securite (j)</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {medicaments.map((m) => (
            <tr key={m.id_medicament}>
              <td>{m.code_essentiel}</td>
              <td>{m.nom_medicament}</td>
              <td>{m.dci}</td>
              <td>{VED_LABELS[m.categorie_ved]}</td>
              <td>{m.categorie_abc}</td>
              <td>{m.nom_profil_saisonnier || '-'}</td>
              <td className="col-num">{m.stock_actuel}</td>
              <td className="col-num">{m.stock_securite_jours}</td>
              <td>{m.actif ? <span className="badge badge-livree">Actif</span> : <span className="badge badge-annulee">Archive</span>}</td>
              <td>
                <div className="toolbar-actions">
                  <button className="btn btn-secondary btn-small" onClick={() => onEdit(m)}>
                    <Pencil size={13} aria-hidden="true" /> Modifier
                  </button>
                  {m.actif ? (
                    <button className="btn btn-danger btn-small" onClick={() => onArchiver(m)}>
                      <Archive size={13} aria-hidden="true" /> Archiver
                    </button>
                  ) : (
                    <button className="btn btn-secondary btn-small" onClick={() => onReactiver(m)}>
                      <RotateCcw size={13} aria-hidden="true" /> Reactiver
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
