import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Pill, Truck, PackageSearch, Trash2, ShoppingCart,
  Users, ArrowLeftRight, BellRing, LineChart, Menu, X, LogOut,
} from 'lucide-react';
import { useAuth } from '../modules/auth/AuthContext.jsx';

// Menu complet, filtre ensuite selon le role de l'utilisateur connecte.
// Purement cosmetique : la verification qui compte reellement est faite
// cote serveur (gateway/src/middleware/rbac.js) sur chaque route.
const MENU = [
  { path: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/medicaments', label: 'Medicaments', icon: Pill, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/fournisseurs', label: 'Fournisseurs', icon: Truck, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/lots', label: 'Lots & peremption', icon: PackageSearch, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/retraits', label: 'Retrait / Destruction', icon: Trash2, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/commandes', label: 'Commandes', icon: ShoppingCart, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/utilisateurs', label: 'Utilisateurs & roles', icon: Users, roles: ['SUPERVISEUR'] },
  { path: '/mouvements', label: 'Mouvements', icon: ArrowLeftRight, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/alertes', label: 'Alertes', icon: BellRing, roles: ['GERANT', 'SUPERVISEUR'] },
  { path: '/previsions', label: 'Previsions', icon: LineChart, roles: ['GERANT', 'SUPERVISEUR'] },
];

function initiales(nom) {
  if (!nom) return '?';
  const parts = nom.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function Layout() {
  const { utilisateur, deconnecter } = useAuth();
  const role = utilisateur?.role;
  const menuVisible = MENU.filter((item) => !role || item.roles.includes(role));
  const [menuOuvert, setMenuOuvert] = useState(false);
  const location = useLocation();
  const sidebarRef = useRef(null);

  // Ferme le tiroir mobile a chaque changement de route.
  useEffect(() => { setMenuOuvert(false); }, [location.pathname]);

  // Ferme le tiroir avec Echap (navigation clavier).
  useEffect(() => {
    if (!menuOuvert) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOuvert(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOuvert]);

  const pageActuelle = menuVisible.find((item) => (item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)));

  return (
    <div className="app-shell">
      <div className="topbar-mobile">
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOuvert}
          aria-controls="sidebar-principale"
          onClick={() => setMenuOuvert((v) => !v)}
        >
          {menuOuvert ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <span className="topbar-title">{pageActuelle?.label || 'Depot de Medicaments'}</span>
      </div>

      <button
        type="button"
        className={`sidebar-scrim${menuOuvert ? ' sidebar-scrim-visible' : ''}`}
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setMenuOuvert(false)}
      />

      <aside
        id="sidebar-principale"
        ref={sidebarRef}
        className={`sidebar${menuOuvert ? ' sidebar-open' : ''}`}
        aria-label="Navigation principale"
      >
        <div className="sidebar-header">
          <span className="sidebar-brand-icon" aria-hidden="true"><Pill size={18} /></span>
          <div>
            <h1>Depot de Medicaments</h1>
            <p className="sidebar-subtitle">Gestion de stock &amp; SMA</p>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Sections de l'application">
          {menuVisible.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link-active' : '')}
              >
                <span className="nav-icon"><Icon size={18} aria-hidden="true" /></span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {utilisateur && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar" aria-hidden="true">{initiales(utilisateur.nom_utilisateur)}</div>
              <div className="sidebar-user-info">
                <p className="sidebar-user-name">{utilisateur.nom_utilisateur}</p>
                <p className="sidebar-footer-small">{utilisateur.role === 'GERANT' ? 'Gerant' : 'Superviseur de district'}</p>
              </div>
            </div>
          )}
          {utilisateur && (
            <button type="button" className="btn btn-secondary btn-small" onClick={deconnecter}>
              <LogOut size={14} aria-hidden="true" /> Deconnexion
            </button>
          )}
          <p className="sidebar-footer-small" style={{ marginTop: 8 }}>Depot communautaire</p>
        </div>
      </aside>
      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}
