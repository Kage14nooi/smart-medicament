const express = require('express');
const pool = require('../db/pool');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Alertes : GERANT en lecture + traitement, SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const TRAITEMENT = autoriser('GERANT');

// Liste des alertes triees par niveau de risque puis date (utilisee par le
// polling toutes les ~5s du Tableau de bord et de l'ecran Alertes).
router.get('/', LECTURE, async (req, res) => {
  try {
    const { statut } = req.query;
    let sql = `
      SELECT a.*, m.nom_medicament, p.score_final, p.score_rop, p.score_ml, p.facteur_saisonnier
      FROM ALERTE a
      JOIN MEDICAMENT m ON m.id_medicament = a.id_medicament
      LEFT JOIN PREDICTION p ON p.id_prediction = a.id_prediction
    `;
    const params = [];
    if (statut) {
      sql += ' WHERE a.statut_alerte = ?';
      params.push(statut);
    }
    sql += `
      ORDER BY
        FIELD(a.niveau_risque, 'CRITIQUE', 'ELEVE', 'MOYEN', 'FAIBLE'),
        a.date_creation DESC
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Traitement d'une alerte (le gerant confirme avoir pris connaissance / agi)
router.put('/:id/traiter', TRAITEMENT, async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE ALERTE SET statut_alerte = 'TRAITEE' WHERE id_alerte = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Alerte introuvable' });
    res.json({ message: 'Alerte marquee comme traitee avec succes' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
