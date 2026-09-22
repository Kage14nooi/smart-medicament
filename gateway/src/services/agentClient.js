const fetch = require('node-fetch');
const { AGENT_MONITORING_URL, AGENT_PREDICTION_URL, AGENT_DECISION_URL } = require('../config');

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Erreur agent (${res.status}) sur ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function getJson(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Erreur agent (${res.status}) sur ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function putJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Erreur agent (${res.status}) sur ${path}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = {
  // Agent Monitoring
  verifierStock: (idMedicament) =>
    postJson(AGENT_MONITORING_URL, '/verifier-stock', { id_medicament: idMedicament }),
  listerLots: (idMedicament) =>
    getJson(AGENT_MONITORING_URL, idMedicament ? `/lots?id_medicament=${idMedicament}` : '/lots'),
  receptionnerLot: (payload) => postJson(AGENT_MONITORING_URL, '/lots/reception', payload),
  corrigerLot: (idLot, payload) => putJson(AGENT_MONITORING_URL, `/lots/${idLot}`, payload),
  listerRetraits: () => getJson(AGENT_MONITORING_URL, '/retraits'),
  creerRetrait: (payload) => postJson(AGENT_MONITORING_URL, '/retraits', payload),

  // Agent Prediction
  predire: (idMedicament) => postJson(AGENT_PREDICTION_URL, `/predire/${idMedicament}`, {}),
  historiquePredictions: (idMedicament) =>
    getJson(AGENT_PREDICTION_URL, `/predictions/${idMedicament}`),

  // Agent Decision
  traiterPrediction: (payload) => postJson(AGENT_DECISION_URL, '/traiter-prediction', payload),
  verifierMotDePasse: (payload) => postJson(AGENT_DECISION_URL, '/utilisateurs/verifier-mot-de-passe', payload),
  listerFournisseurs: () => getJson(AGENT_DECISION_URL, '/fournisseurs'),
  creerFournisseur: (payload) => postJson(AGENT_DECISION_URL, '/fournisseurs', payload),
  modifierFournisseur: (id, payload) => putJson(AGENT_DECISION_URL, `/fournisseurs/${id}`, payload),
  archiverFournisseur: (id) => putJson(AGENT_DECISION_URL, `/fournisseurs/${id}/archiver`, {}),
  listerConditions: (idFournisseur) => getJson(AGENT_DECISION_URL, `/fournisseurs/${idFournisseur}/conditions`),
  upsertCondition: (idFournisseur, payload) =>
    postJson(AGENT_DECISION_URL, `/fournisseurs/${idFournisseur}/conditions`, payload),
  listerCommandes: (statut) =>
    getJson(AGENT_DECISION_URL, statut ? `/commandes?statut=${statut}` : '/commandes'),
  creerCommande: (payload) => postJson(AGENT_DECISION_URL, '/commandes', payload),
  ajusterCommande: (id, payload) => putJson(AGENT_DECISION_URL, `/commandes/${id}`, payload),
  listerUtilisateurs: () => getJson(AGENT_DECISION_URL, '/utilisateurs'),
  creerUtilisateur: (payload) => postJson(AGENT_DECISION_URL, '/utilisateurs', payload),
  modifierUtilisateur: (id, payload) => putJson(AGENT_DECISION_URL, `/utilisateurs/${id}`, payload),
  archiverUtilisateur: (id) => putJson(AGENT_DECISION_URL, `/utilisateurs/${id}/archiver`, {}),
  reactiverUtilisateur: (id) => putJson(AGENT_DECISION_URL, `/utilisateurs/${id}/reactiver`, {}),
  resetMotDePasse: (id, payload) => putJson(AGENT_DECISION_URL, `/utilisateurs/${id}/reset-mot-de-passe`, payload),
};
