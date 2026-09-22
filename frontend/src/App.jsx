import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import LoginPage from './modules/auth/LoginPage.jsx';
import RequireAuth from './modules/auth/RequireAuth.jsx';

import DashboardPage from './modules/dashboard/DashboardPage.jsx';
import MedicamentsPage from './modules/medicaments/MedicamentsPage.jsx';
import FournisseursPage from './modules/fournisseurs/FournisseursPage.jsx';
import LotsPage from './modules/lots/LotsPage.jsx';
import RetraitsPage from './modules/retraits/RetraitsPage.jsx';
import CommandesPage from './modules/commandes/CommandesPage.jsx';
import UtilisateursPage from './modules/utilisateurs/UtilisateursPage.jsx';
import MouvementsPage from './modules/mouvements/MouvementsPage.jsx';
import AlertesPage from './modules/alertes/AlertesPage.jsx';
import PrevisionsPage from './modules/previsions/PrevisionsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/medicaments" element={<MedicamentsPage />} />
        <Route path="/fournisseurs" element={<FournisseursPage />} />
        <Route path="/lots" element={<LotsPage />} />
        <Route path="/retraits" element={<RetraitsPage />} />
        <Route path="/commandes" element={<CommandesPage />} />
        <Route path="/utilisateurs" element={<UtilisateursPage />} />
        <Route path="/mouvements" element={<MouvementsPage />} />
        <Route path="/alertes" element={<AlertesPage />} />
        <Route path="/previsions" element={<PrevisionsPage />} />
      </Route>
    </Routes>
  );
}
