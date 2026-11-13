const express = require('express');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Utilisateurs & roles : reserve au SUPERVISEUR (CRUD complet) ; le GERANT n'a
// AUCUN acces a ce module (matrice RBAC stricte, y compris en lecture).
const SUPERVISEUR_SEUL = autoriser('SUPERVISEUR');

// Proxy vers l'agent Decision.
// Les demandes d'accès sont visibles et traitées uniquement par le superviseur.
router.get('/demandes-acces', SUPERVISEUR_SEUL, async (req, res) => {
  try { res.json(await agentClient.listerDemandesAcces()); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/demandes-acces/:id/approuver', SUPERVISEUR_SEUL, async (req, res) => {
  try { res.json(await agentClient.approuverDemandeAcces(req.params.id, req.body)); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.post('/demandes-acces/:id/refuser', SUPERVISEUR_SEUL, async (req, res) => {
  try { res.json(await agentClient.refuserDemandeAcces(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});


// Proxy vers l'agent Decision.
router.get('/', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.json(await agentClient.listerUtilisateurs());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.status(201).json(await agentClient.creerUtilisateur(req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.json(await agentClient.modifierUtilisateur(req.params.id, req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id/archiver', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.json(await agentClient.archiverUtilisateur(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id/reactiver', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.json(await agentClient.reactiverUtilisateur(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id/reset-mot-de-passe', SUPERVISEUR_SEUL, async (req, res) => {
  try {
    res.json(await agentClient.resetMotDePasse(req.params.id, req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
