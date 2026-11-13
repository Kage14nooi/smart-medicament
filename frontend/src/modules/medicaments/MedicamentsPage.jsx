import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from '../../components/ToastContext.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import MedicamentsTable from './MedicamentsTable.jsx';
import MedicamentForm from './MedicamentForm.jsx';

// Met en minuscules et retire les accents pour une recherche tolerante
// ("paracetamol" trouve "Paracétamol", "AMOX" trouve "Amoxicilline").
 function normaliser(texte) {
  return (texte ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function MedicamentsPage() {
  const [medicaments, setMedicaments] = useState([]);
  const [profils, setProfils] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [enModification, setEnModification] = useState(null);
  const [aArchiver, setAArchiver] = useState(null);
  const [archivageEnCours, setArchivageEnCours] = useState(false);
  const [filtre, setFiltre] = useState('actifs');
  const [recherche, setRecherche] = useState('');
  const [chargement, setChargement] = useState(true);
  const { showToast } = useToast();

  async function charger() {
    try {
      const query = filtre === 'actifs' ? '?actif=true' : filtre === 'archives' ? '?actif=false' : '';
      const [meds, prof] = await Promise.all([
        api.get(`/medicaments${query}`),
        api.get('/medicaments/profils-saisonniers'),
      ]);
      setMedicaments(meds);
      setProfils(prof);
    } catch (err) {
      showToast(`Erreur de chargement : ${err.message}`, 'error');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => { charger(); }, [filtre]);

  // Filtrage cote client sur le nom et la DCI (la liste du catalogue est courte)
  const medicamentsFiltres = useMemo(() => {
    const terme = normaliser(recherche);
    if (!terme) return medicaments;
    return medicaments.filter(
      (m) => normaliser(m.nom_medicament).includes(terme) || normaliser(m.dci).includes(terme)
    );
  }, [medicaments, recherche]);

  async function handleCreer(payload) {
    try {
      await api.post('/medicaments', payload);
      showToast(`Medicament "${payload.nom_medicament}" cree avec succes.`);
      setShowForm(false);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function handleModifier(payload) {
    try {
      await api.put(`/medicaments/${enModification.id_medicament}`, payload);
      showToast(`Medicament "${payload.nom_medicament}" mis a jour avec succes.`);
      setEnModification(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  async function confirmerArchivage() {
    setArchivageEnCours(true);
    try {
      await api.put(`/medicaments/${aArchiver.id_medicament}/archiver`);
      showToast(`Medicament "${aArchiver.nom_medicament}" archive avec succes.`);
      setAArchiver(null);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setArchivageEnCours(false);
    }
  }

  async function handleReactiver(m) {
    try {
      await api.put(`/medicaments/${m.id_medicament}/reactiver`);
      showToast(`Medicament "${m.nom_medicament}" reactive avec succes.`);
      charger();
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  return (
    <div>
      <h2 className="page-title">Medicaments</h2>
      <p className="page-subtitle">Catalogue restreint de medicaments essentiels generiques - archivage plutot que suppression</p>

      <div className="toolbar">
        <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label htmlFor="filtre-medicaments" className="sr-only" style={{ display: 'none' }}>Filtrer les medicaments</label>
          <select id="filtre-medicaments" value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer les medicaments">
            <option value="actifs">Actifs</option>
            <option value="archives">Archives</option>
            <option value="tous">Tous</option>
          </select>

          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.55, pointerEvents: 'none' }}
            />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par nom ou DCI..."
              aria-label="Rechercher un medicament par nom ou DCI"
              style={{ paddingLeft: 32, minWidth: 280 }}
            />
          </div>
          {recherche.trim() && !chargement && (
            <span className="page-subtitle" style={{ margin: 0 }} aria-live="polite">
              {medicamentsFiltres.length} resultat{medicamentsFiltres.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-primary" onClick={() => { setEnModification(null); setShowForm(!showForm); }}>
            {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showForm ? 'Fermer le formulaire' : 'Nouveau medicament'}
          </button>
        </div>
      </div>

      {(showForm || enModification) && (
        <MedicamentForm
          profils={profils}
          initial={enModification}
          onSubmit={enModification ? handleModifier : handleCreer}
          onCancel={() => { setShowForm(false); setEnModification(null); }}
        />
      )}

      <div className="card">
        {chargement ? <SkeletonTable rows={5} /> : (
          <MedicamentsTable
            medicaments={medicamentsFiltres}
            onEdit={(m) => { setEnModification(m); setShowForm(false); }}
            onArchiver={(m) => setAArchiver(m)}
            onReactiver={handleReactiver}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(aArchiver)}
        titre="Archiver le medicament"
        message={aArchiver ? `Confirmer l'archivage de "${aArchiver.nom_medicament}" ? Il ne sera plus utilisable pour de nouveaux mouvements mais restera consultable.` : ''}
        confirmLabel="Archiver"
        onConfirm={confirmerArchivage}
        onCancel={() => setAArchiver(null)}
        enCours={archivageEnCours}
      />
    </div>
  );
}

// import { useEffect, useState } from 'react';
// import { Plus, X } from 'lucide-react';
// import { api } from '../../api/client.js';
// import { useToast } from '../../components/ToastContext.jsx';
// import ConfirmDialog from '../../components/ConfirmDialog.jsx';
// import { SkeletonTable } from '../../components/Skeleton.jsx';
// import MedicamentsTable from './MedicamentsTable.jsx';
// import MedicamentForm from './MedicamentForm.jsx';

// export default function MedicamentsPage() {
//   const [medicaments, setMedicaments] = useState([]);
//   const [profils, setProfils] = useState([]);
//   const [showForm, setShowForm] = useState(false);
//   const [enModification, setEnModification] = useState(null);
//   const [aArchiver, setAArchiver] = useState(null);
//   const [archivageEnCours, setArchivageEnCours] = useState(false);
//   const [filtre, setFiltre] = useState('actifs');
//   const [chargement, setChargement] = useState(true);
//   const { showToast } = useToast();

//   async function charger() {
//     try {
//       const query = filtre === 'actifs' ? '?actif=true' : filtre === 'archives' ? '?actif=false' : '';
//       const [meds, prof] = await Promise.all([
//         api.get(`/medicaments${query}`),
//         api.get('/medicaments/profils-saisonniers'),
//       ]);
//       setMedicaments(meds);
//       setProfils(prof);
//     } catch (err) {
//       showToast(`Erreur de chargement : ${err.message}`, 'error');
//     } finally {
//       setChargement(false);
//     }
//   }

//   useEffect(() => { charger(); }, [filtre]);

//   async function handleCreer(payload) {
//     try {
//       await api.post('/medicaments', payload);
//       showToast(`Medicament "${payload.nom_medicament}" cree avec succes.`);
//       setShowForm(false);
//       charger();
//     } catch (err) {
//       showToast(`Erreur : ${err.message}`, 'error');
//     }
//   }

//   async function handleModifier(payload) {
//     try {
//       await api.put(`/medicaments/${enModification.id_medicament}`, payload);
//       showToast(`Medicament "${payload.nom_medicament}" mis a jour avec succes.`);
//       setEnModification(null);
//       charger();
//     } catch (err) {
//       showToast(`Erreur : ${err.message}`, 'error');
//     }
//   }

//   async function confirmerArchivage() {
//     setArchivageEnCours(true);
//     try {
//       await api.put(`/medicaments/${aArchiver.id_medicament}/archiver`);
//       showToast(`Medicament "${aArchiver.nom_medicament}" archive avec succes.`);
//       setAArchiver(null);
//       charger();
//     } catch (err) {
//       showToast(`Erreur : ${err.message}`, 'error');
//     } finally {
//       setArchivageEnCours(false);
//     }
//   }

//   async function handleReactiver(m) {
//     try {
//       await api.put(`/medicaments/${m.id_medicament}/reactiver`);
//       showToast(`Medicament "${m.nom_medicament}" reactive avec succes.`);
//       charger();
//     } catch (err) {
//       showToast(`Erreur : ${err.message}`, 'error');
//     }
//   }

//   return (
//     <div>
//       <h2 className="page-title">Medicaments</h2>
//       <p className="page-subtitle">Catalogue restreint de medicaments essentiels generiques - archivage plutot que suppression</p>

//       <div className="toolbar">
//         <div className="filter-bar">
//           <label htmlFor="filtre-medicaments" className="sr-only" style={{ display: 'none' }}>Filtrer les medicaments</label>
//           <select id="filtre-medicaments" value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer les medicaments">
//             <option value="actifs">Actifs</option>
//             <option value="archives">Archives</option>
//             <option value="tous">Tous</option>
//           </select>
//         </div>
//         <div className="toolbar-actions">
//           <button className="btn btn-primary" onClick={() => { setEnModification(null); setShowForm(!showForm); }}>
//             {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
//             {showForm ? 'Fermer le formulaire' : 'Nouveau medicament'}
//           </button>
//         </div>
//       </div>

//       {(showForm || enModification) && (
//         <MedicamentForm
//           profils={profils}
//           initial={enModification}
//           onSubmit={enModification ? handleModifier : handleCreer}
//           onCancel={() => { setShowForm(false); setEnModification(null); }}
//         />
//       )}

//       <div className="card">
//         {chargement ? <SkeletonTable rows={5} /> : (
//           <MedicamentsTable
//             medicaments={medicaments}
//             onEdit={(m) => { setEnModification(m); setShowForm(false); }}
//             onArchiver={(m) => setAArchiver(m)}
//             onReactiver={handleReactiver}
//           />
//         )}
//       </div>

//       <ConfirmDialog
//         open={Boolean(aArchiver)}
//         titre="Archiver le medicament"
//         message={aArchiver ? `Confirmer l'archivage de "${aArchiver.nom_medicament}" ? Il ne sera plus utilisable pour de nouveaux mouvements mais restera consultable.` : ''}
//         confirmLabel="Archiver"
//         onConfirm={confirmerArchivage}
//         onCancel={() => setAArchiver(null)}
//         enCours={archivageEnCours}
//       />
//     </div>
//   );
// }
