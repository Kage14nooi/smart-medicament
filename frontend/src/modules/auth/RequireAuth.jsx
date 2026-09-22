import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/**
 * Protege les routes de l'application : redirige vers /login si non connecte.
 * Ceci est purement cosmetique/UX cote frontend - la verification qui compte
 * reellement est celle du gateway (JWT + RBAC), qui refuse de toute facon
 * les appels sans token valide.
 */
export default function RequireAuth({ children }) {
  const { estConnecte, chargement } = useAuth();
  const location = useLocation();

  if (chargement) {
    return <div className="auth-loading">Chargement...</div>;
  }
  if (!estConnecte) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
