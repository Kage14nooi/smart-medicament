import { useEffect, useState } from 'react';
import { Plus, X, Pencil, KeyRound, Archive, RotateCcw, Users } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import UtilisateurForm from './UtilisateurForm.jsx';
import ResetPasswordDialog from './ResetPasswordDialog.jsx';

const ROLE_LABELS = { GERANT: 'Gerant', SUPERVISEUR: 'Superviseur de district' };

export default function UtilisateursPage() {
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [enModification, setEnModification] = useState(null);
  const [aArchiver, setAArchiver] = useState(null);
  const [archivageEnCours, setArchivageEnCours] = useState(false);
  const [resetPourUtilisateur, setResetPourUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      setUtilisateurs(await api.get('/utilisateurs'));
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function handleCreer(payload) {
    try {
      await api.post('/utilisateurs', payload);
      showToast(`Utilisateur "${payload.nom_utilisateur}" cree avec succes.`);
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleModifier(payload) {
    try {
      await api.put(`/utilisateurs/${enModification.id_utilisateur}`, payload);
      showToast(`Utilisateur "${payload.nom_utilisateur}" mis a jour avec succes.`);
      setEnModification(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function confirmerArchivage() {
    setArchivageEnCours(true);
    try {
      await api.put(`/utilisateurs/${aArchiver.id_utilisateur}/archiver`);
      showToast(`Utilisateur "${aArchiver.nom_utilisateur}" archive avec succes.`);
      setAArchiver(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setArchivageEnCours(false);
    }
  }

  async function handleReactiver(u) {
    try {
      await api.put(`/utilisateurs/${u.id_utilisateur}/reactiver`);
      showToast(`Utilisateur "${u.nom_utilisateur}" reactive avec succes.`);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleReset(nouveauMotDePasse) {
    try {
      await api.put(`/utilisateurs/${resetPourUtilisateur.id_utilisateur}/reset-mot-de-passe`, { nouveau_mot_de_passe: nouveauMotDePasse });
      showToast(`Mot de passe reinitialise pour "${resetPourUtilisateur.nom_utilisateur}".`);
      setResetPourUtilisateur(null);
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Utilisateurs &amp; roles</h2>
      <p className="page-subtitle">Gerant (depot) et superviseur de district - pas d'authentification reelle dans cette version</p>

      <div className="toolbar">
        <div />
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => { setEnModification(null); setShowForm(!showForm); }}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Nouvel utilisateur'}
          </button>
        </div>
      </div>

      {(showForm || enModification) && (
        <UtilisateurForm
          initial={enModification}
          onSubmit={enModification ? handleModifier : handleCreer}
          onCancel={() => { setShowForm(false); setEnModification(null); }}
        />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : utilisateurs.length === 0 ? (
          <EmptyState icon={Users} titre="Aucun utilisateur" message="Aucun utilisateur enregistre." />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Nom</th><th>Email</th><th>Role</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {utilisateurs.map((u) => (
                  <tr key={u.id_utilisateur}>
                    <td>{u.nom_utilisateur}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td>{u.actif ? <span className="badge badge-livree">Actif</span> : <span className="badge badge-annulee">Archive</span>}</td>
                    <td>
                      <div className="toolbar-actions">
                        <button className="btn btn-secondary btn-small" onClick={() => { setEnModification(u); setShowForm(false); }}>
                          <Pencil size={13} aria-hidden="true" /> Modifier
                        </button>
                        <button className="btn btn-secondary btn-small" onClick={() => setResetPourUtilisateur(u)}>
                          <KeyRound size={13} aria-hidden="true" /> Reset mot de passe
                        </button>
                        {u.actif ? (
                          <button className="btn btn-danger btn-small" onClick={() => setAArchiver(u)}>
                            <Archive size={13} aria-hidden="true" /> Archiver
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-small" onClick={() => handleReactiver(u)}>
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
        )}
      </div>

      <ConfirmDialog
        open={Boolean(aArchiver)}
        titre="Archiver l'utilisateur"
        message={aArchiver ? `Confirmer l'archivage du compte de "${aArchiver.nom_utilisateur}" ?` : ''}
        confirmLabel="Archiver"
        onConfirm={confirmerArchivage}
        onCancel={() => setAArchiver(null)}
        enCours={archivageEnCours}
      />

      <ResetPasswordDialog
        utilisateur={resetPourUtilisateur}
        onSubmit={handleReset}
        onCancel={() => setResetPourUtilisateur(null)}
      />
    </div>
  );
}
