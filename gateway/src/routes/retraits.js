const express = require('express');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Retrait/Destruction : GERANT en create/read, SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

// Proxy vers l'agent Monitoring. Create + read seulement (pas d'update/delete),
// conformement au caractere trace/irreversible du retrait de conformite.
router.get('/', LECTURE, async (req, res) => {
  try {
    const retraits = await agentClient.listerRetraits();
    res.json(retraits);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', ECRITURE, async (req, res) => {
  try {
    // L'identite du responsable vient du JWT verifie (req.user), jamais du corps
    // de la requete : toute valeur id_utilisateur envoyee par le client est ecrasee.
    if (!req.user || !req.user.id_utilisateur) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    const payload = { ...req.body, id_utilisateur: Number(req.user.id_utilisateur) };
    const result = await agentClient.creerRetrait(payload);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;


// try {
  //   const result = await agentClient.creerRetrait(req.body);
  //   res.status(201).json(result);
  // } catch (err) {
  //   res.status(err.status || 500).json({ error: err.message });
  // }