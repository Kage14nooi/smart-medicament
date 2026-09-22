import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAuthHandlers, setAccessToken } from '../../api/client.js';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Contexte d'authentification frontend : garde l'access token en memoire
 * (jamais en localStorage, pour limiter l'exposition en cas de XSS) et
 * l'utilisateur connecte (id, role...). Le refresh token, lui, vit uniquement
 * dans un cookie httpOnly gere par le navigateur (jamais accessible en JS).
 *
 * Au chargement de l'application, on tente un /api/auth/refresh (le cookie
 * httpOnly est envoye automatiquement par le navigateur si present) pour
 * retrouver une session existante sans redemander le mot de passe.
 */
export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  const deconnecter = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // best-effort : meme si l'appel echoue, on nettoie l'etat local
    }
    setAccessToken(null);
    setUtilisateur(null);
  }, []);

  const appliquerSession = useCallback((data) => {
    setAccessToken(data.access_token);
    setUtilisateur(data.utilisateur);
  }, []);

  const connecter = useCallback(
    async (email, mot_de_passe) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, mot_de_passe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Identifiants invalides');
      }
      appliquerSession(data);
      return data.utilisateur;
    },
    [appliquerSession]
  );

  const tenterRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      appliquerSession(data);
      return true;
    } catch {
      return false;
    }
  }, [appliquerSession]);

  useEffect(() => {
    // Enregistre les handlers utilises par api/client.js : intercepteur 401
    // (tentative de refresh puis, en cas d'echec, deconnexion) et fournisseur
    // du token courant pour l'en-tete Authorization.
    setAuthHandlers({ onUnauthorized: deconnecter, onRefresh: tenterRefresh });
  }, [deconnecter, tenterRefresh]);

  useEffect(() => {
    (async () => {
      await tenterRefresh();
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      utilisateur,
      estConnecte: !!utilisateur,
      chargement,
      connecter,
      deconnecter,
    }),
    [utilisateur, chargement, connecter, deconnecter]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise a l'interieur de AuthProvider");
  return ctx;
}
