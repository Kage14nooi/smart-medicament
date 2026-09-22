const express = require('express');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Commandes : GERANT en create/read/update, SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

// Proxy vers l'agent Decision. L'ajustement d'une commande EST la validation
// humaine (pas de bouton "valider" separe) ; le passage a LIVREE declenche
// automatiquement un mouvement ENTREE cote agent Decision.
router.get('/', LECTURE, async (req, res) => {
  try {
    res.json(await agentClient.listerCommandes(req.query.statut));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', ECRITURE, async (req, res) => {
  try {
    res.status(201).json(await agentClient.creerCommande(req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.put('/:id', ECRITURE, async (req, res) => {
  try {
    res.json(await agentClient.ajusterCommande(req.params.id, req.body));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
