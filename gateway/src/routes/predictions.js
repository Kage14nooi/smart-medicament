const express = require('express');
const pool = require('../db/pool');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Previsions : lecture pour les deux roles (GERANT et SUPERVISEUR).
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');

// Historique des predictions pour un medicament (lecture directe en base, simple et transparente)
router.get('/:id_medicament', LECTURE, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM PREDICTION WHERE id_medicament = ? ORDER BY date_prediction DESC LIMIT 30`,
      [req.params.id_medicament]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Declenchement manuel du calcul (utile pour l'ecran Previsions - "recalculer maintenant")
router.post('/:id_medicament/calculer', LECTURE, async (req, res) => {
  try {
    const result = await agentClient.predire(req.params.id_medicament);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
