const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const agentClient = require('../services/agentClient');
const { autoriser } = require('../middleware/rbac');
const { validerCorps } = require('../middleware/validate');

const router = express.Router();

const mouvementSchema = z.object({
  id_medicament: z.coerce.number().int().positive(),
  id_lot: z.coerce.number().int().positive().optional().nullable(),
  type_mouvement: z.enum(['ENTREE', 'DISTRIBUTION', 'AJUSTEMENT', 'RETRAIT']),
  quantite_mouvement: z.coerce.number().int(),
  source_mouvement: z.string().max(80).optional(),
});

// Mouvements : GERANT peut creer (+lire), SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

router.get('/', LECTURE, async (req, res) => {
  try {
    const { id_medicament } = req.query;
    let sql = `
      SELECT mv.*, m.nom_medicament
      FROM MOUVEMENT mv
      JOIN MEDICAMENT m ON m.id_medicament = mv.id_medicament
    `;
    const params = [];
    if (id_medicament) {
      sql += ' WHERE mv.id_medicament = ?';
      params.push(id_medicament);
    }
    sql += ' ORDER BY mv.date_mouvement DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Simulateur de mouvement (etape 1 du pipeline SMA) :
 *  - enregistre le mouvement,
 *  - recalcule stock_actuel du medicament,
 *  - appelle l'agent Monitoring pour verifier ce medicament,
 *  - retourne le resultat de la verification (et donc si une alerte a pu etre declenchee
 *    en aval, de facon asynchrone via Redis).
 */
router.post('/', ECRITURE, validerCorps(mouvementSchema), async (req, res) => {
  const { id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [medRows] = await connection.query('SELECT * FROM MEDICAMENT WHERE id_medicament = ? FOR UPDATE', [id_medicament]);
    if (medRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Medicament introuvable' });
    }

    // Convention de signe (cf. dictionnaire de donnees) : quantite_mouvement est TOUJOURS
    // positive en base ; le sens (augmente/diminue le stock) depend uniquement de type_mouvement.
    // DISTRIBUTION et RETRAIT diminuent le stock, ENTREE l'augmente, AJUSTEMENT est un delta
    // signe fourni par l'utilisateur (lui seul peut etre negatif).
    let quantiteStockee = quantite_mouvement;
    let deltaStock = quantite_mouvement;
    if (type_mouvement === 'DISTRIBUTION' || type_mouvement === 'RETRAIT') {
      quantiteStockee = Math.abs(quantite_mouvement);
      deltaStock = -quantiteStockee;
    } else if (type_mouvement === 'ENTREE') {
      quantiteStockee = Math.abs(quantite_mouvement);
      deltaStock = quantiteStockee;
    }
    // AJUSTEMENT : quantite_mouvement garde le signe fourni tel quel (delta libre)

    const [result] = await connection.query(
      `INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement)
       VALUES (?, ?, ?, ?, ?)`,
      [id_medicament, id_lot || null, type_mouvement, quantiteStockee, source_mouvement || 'SIMULATEUR']
    );

    await connection.query(
      'UPDATE MEDICAMENT SET stock_actuel = GREATEST(0, stock_actuel + ?) WHERE id_medicament = ?',
      [deltaStock, id_medicament]
    );

    await connection.commit();

    const idMouvement = result.insertId;

    // Etape 1 (fin) -> appel HTTP au gateway vers l'agent Monitoring
    let verification = null;
    let erreurAgent = null;
    try {
      verification = await agentClient.verifierStock(id_medicament);
    } catch (err) {
      erreurAgent = err.message;
    }

    res.status(201).json({
      id_mouvement: idMouvement,
      message: 'Mouvement enregistre avec succes',
      verification_stock: verification,
      erreur_agent_monitoring: erreurAgent,
    });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
