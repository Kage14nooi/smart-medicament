import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Archive, SlidersHorizontal, Truck } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import FournisseurForm from './FournisseurForm.jsx';
import ConditionsPanel from './ConditionsPanel.jsx';

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [medicaments, setMedicaments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [enModification, setEnModification] = useState(null);
  const [aArchiver, setAArchiver] = useState(null);
  const [archivageEnCours, setArchivageEnCours] = useState(false);
  const [conditionsDe, setConditionsDe] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const [four, meds] = await Promise.all([
        api.get('/fournisseurs'),
        api.get('/medicaments?actif=true'),
      ]);
      setFournisseurs(four);
      setMedicaments(meds);
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleCreer(payload) {
    try {
      await api.post('/fournisseurs', payload);
      showToast(`Fournisseur "${payload.nom_fournisseur}" cree avec succes.`);
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleModifier(payload) {
    try {
      await api.put(`/fournisseurs/${enModification.id_fournisseur}`, payload);
      showToast(`Fournisseur "${payload.nom_fournisseur}" mis a jour avec succes.`);
      setEnModification(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function confirmerArchivage() {
    setArchivageEnCours(true);
    try {
      await api.put(`/fournisseurs/${aArchiver.id_fournisseur}/archiver`);
      showToast(`Fournisseur "${aArchiver.nom_fournisseur}" archive avec succes.`);
      setAArchiver(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setArchivageEnCours(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Fournisseurs</h2>
      <p className="page-subtitle">Gestion des fournisseurs et des conditions par medicament (delai, prix)</p>

      <div className="toolbar">
        <div />
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => { setEnModification(null); setShowForm(!showForm); }}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Nouveau fournisseur'}
          </button>
        </div>
      </div>

      {(showForm || enModification) && (
        <FournisseurForm
          initial={enModification}
          onSubmit={enModification ? handleModifier : handleCreer}
          onCancel={() => { setShowForm(false); setEnModification(null); }}
        />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : fournisseurs.length === 0 ? (
          <EmptyState icon={Truck} titre="Aucun fournisseur" message="Aucun fournisseur enregistre pour le moment." />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Nom</th><th>Fiabilite</th><th>Contact</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {fournisseurs.map((f) => (
                  <tr key={f.id_fournisseur}>
                    <td>{f.nom_fournisseur}</td>
                    <td>{Number(f.fiabilite_score).toFixed(2)}</td>
                    <td>{f.contact || '-'}</td>
                    <td>{f.actif ? <span className="badge badge-livree">Actif</span> : <span className="badge badge-annulee">Archive</span>}</td>
                    <td>
                      <div className="toolbar-actions">
                        <button className="btn btn-secondary btn-small" onClick={() => setConditionsDe(f)}>
                          <SlidersHorizontal size={13} aria-hidden="true" /> Conditions
                        </button>
                        <button className="btn btn-secondary btn-small" onClick={() => { setEnModification(f); setShowForm(false); }}>
                          <Pencil size={13} aria-hidden="true" /> Modifier
                        </button>
                        {f.actif && (
                          <button className="btn btn-danger btn-small" onClick={() => setAArchiver(f)}>
                            <Archive size={13} aria-hidden="true" /> Archiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {conditionsDe && (
        <ConditionsPanel fournisseur={conditionsDe} medicaments={medicaments} onClose={() => setConditionsDe(null)} />
      )}

      <ConfirmDialog
        open={Boolean(aArchiver)}
        titre="Archiver le fournisseur"
        message={aArchiver ? `Confirmer l'archivage du fournisseur "${aArchiver.nom_fournisseur}" ?` : ''}
        confirmLabel="Archiver"
        onConfirm={confirmerArchivage}
        onCancel={() => setAArchiver(null)}
        enCours={archivageEnCours}
      />
    </div>
  );
}
