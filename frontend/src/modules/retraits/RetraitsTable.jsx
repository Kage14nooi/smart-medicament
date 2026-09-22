import { Trash2 } from 'lucide-react';
import EmptyState from '../../components/EmptyState.jsx';

const MOTIF_LABELS = { PEREME: 'Perime', NON_UTILISE: 'Non utilise', NON_CONFORME: 'Non conforme' };

export default function RetraitsTable({ retraits }) {
  if (retraits.length === 0) {
    return <EmptyState icon={Trash2} titre="Aucun retrait enregistre" message="Aucun retrait/destruction n'a ete enregistre pour le moment." />;
  }
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Lot</th>
            <th>Medicament</th>
            <th>Motif</th>
            <th className="col-num">Quantite retiree</th>
            <th>Justification</th>
            <th>Responsable</th>
          </tr>
        </thead>
        <tbody>
          {retraits.map((r) => (
            <tr key={r.id_retrait}>
              <td>{new Date(r.date_retrait).toLocaleString('fr-FR')}</td>
              <td>{r.numero_lot}</td>
              <td>{r.nom_medicament}</td>
              <td>{MOTIF_LABELS[r.motif]}</td>
              <td className="col-num">{r.quantite_retiree}</td>
              <td>{r.justification}</td>
              <td>{r.nom_utilisateur}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
