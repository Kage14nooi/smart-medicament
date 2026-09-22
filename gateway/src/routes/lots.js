const express = require('express');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Lots & peremption : GERANT en create/read/update, SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

// Proxy vers l'agent Monitoring, qui porte la logique metier des lots.
router.get('/', LECTURE, async (req, res) => {
  try {
    const lots = await agentClient.listerLots(req.query.id_medicament);
    res.json(lots);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/reception', ECRITURE, async (req, res) => {
  try {
    const result = await agentClient.receptionnerLot(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', ECRITURE, async (req, res) => {
  try {
    const result = await agentClient.corrigerLot(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
