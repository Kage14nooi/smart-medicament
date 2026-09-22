const express = require('express');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Fournisseurs : GERANT en CRUD complet, SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

// Proxy vers l'agent Decision, qui porte la logique metier des fournisseurs.
router.get('/', LECTURE, async (req, res) => {
  try {
    res.json(await agentClient.listerFournisseurs());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', ECRITURE, async (req, res) => {
  try {
    res.status(201).json(await agentClient.creerFournisseur(req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', ECRITURE, async (req, res) => {
  try {
    res.json(await agentClient.modifierFournisseur(req.params.id, req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id/archiver', ECRITURE, async (req, res) => {
  try {
    res.json(await agentClient.archiverFournisseur(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id/conditions', LECTURE, async (req, res) => {
  try {
    res.json(await agentClient.listerConditions(req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/conditions', ECRITURE, async (req, res) => {
  try {
    res.status(201).json(await agentClient.upsertCondition(req.params.id, req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
