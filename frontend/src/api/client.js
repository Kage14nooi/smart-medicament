const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Access token courant, garde en memoire (jamais en localStorage) et injecte
// par AuthContext a la connexion / apres refresh.
let accessToken = null;
let handlers = { onUnauthorized: async () => {}, onRefresh: async () => false };

export function setAccessToken(token) {
  accessToken = token;
}

export function setAuthHandlers(h) {
  handlers = h;
}

let refreshEnCours = null;

async function request(path, options = {}, dejaRetente = false) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Intercepteur 401 : le token a expire (ou est invalide). On tente un
  // refresh unique (le cookie httpOnly refresh_token est envoye automatiquement),
  // et on rejoue la requete une seule fois pour eviter une boucle infinie.
  // Les routes /auth/* ne doivent jamais declencher ce mecanisme.
  if (res.status === 401 && !dejaRetente && !path.startsWith('/auth/')) {
    if (!refreshEnCours) {
      refreshEnCours = handlers.onRefresh().finally(() => {
        refreshEnCours = null;
      });
    }
    const refreshReussi = await refreshEnCours;
    if (refreshReussi) {
      return request(path, options, true);
    }
    await handlers.onUnauthorized();
    throw new Error('Session expiree, veuillez vous reconnecter');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = (data && data.error) || `Erreur ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data && data.details;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path) => request(path, { method: 'DELETE' }),
};
