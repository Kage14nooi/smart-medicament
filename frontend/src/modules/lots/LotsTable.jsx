import { Pencil, PackageSearch } from 'lucide-react';
import EmptyState from '../../components/EmptyState.jsx';

const PILL_CLASS = { ROUGE: 'pill-rouge', ORANGE: 'pill-orange', VERT: 'pill-vert' };
const PILL_LABEL = { ROUGE: 'Urgent (<30j)', ORANGE: 'A surveiller (<90j)', VERT: 'OK' };

export default function LotsTable({ lots, onCorriger }) {
  if (lots.length === 0) {
    return <EmptyState icon={PackageSearch} titre="Aucun lot" message="Aucun lot a afficher." />;
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Numero de lot</th>
            <th>Medicament</th>
            <th>Fournisseur</th>
            <th className="col-num">Quantite</th>
            <th>Date de peremption</th>
            <th>Urgence</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((l) => (
            <tr key={l.id_lot}>
              <td>{l.numero_lot}</td>
              <td>{l.nom_medicament}</td>
              <td>{l.nom_fournisseur || '-'}</td>
              <td className="col-num">{l.quantite_lot}</td>
              <td>{new Date(l.date_peremption).toLocaleDateString('fr-FR')}</td>
              <td><span className={PILL_CLASS[l.urgence_peremption]}>{PILL_LABEL[l.urgence_peremption]}</span></td>
              <td>
                <button className="btn btn-secondary btn-small" onClick={() => onCorriger(l)}>
                  <Pencil size={13} aria-hidden="true" /> Corriger
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
