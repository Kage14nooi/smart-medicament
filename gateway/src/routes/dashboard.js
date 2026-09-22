const express = require('express');
const pool = require('../db/pool');
const { autoriser } = require('../middleware/rbac');

const router = express.Router();

// Tableau de bord : lecture pour les deux roles.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');

// Indicateurs cles agreges pour le Tableau de bord.
router.get('/indicateurs', LECTURE, async (req, res) => {
  try {
    const [[{ nb_medicaments_actifs }]] = await pool.query(
      'SELECT COUNT(*) AS nb_medicaments_actifs FROM MEDICAMENT WHERE actif = TRUE'
    );

    const [[{ nb_sous_seuil }]] = await pool.query(`
      SELECT COUNT(*) AS nb_sous_seuil
      FROM MEDICAMENT m
      WHERE m.actif = TRUE
        AND EXISTS (
          SELECT 1 FROM MOUVEMENT mv
          WHERE mv.id_medicament = m.id_medicament
            AND mv.type_mouvement = 'DISTRIBUTION'
            AND mv.date_mouvement >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        )
        AND (
          m.stock_actuel / NULLIF((
            SELECT AVG(qte_jour) FROM (
              SELECT SUM(mv2.quantite_mouvement) AS qte_jour
              FROM MOUVEMENT mv2
              WHERE mv2.id_medicament = m.id_medicament
                AND mv2.type_mouvement = 'DISTRIBUTION'
                AND mv2.date_mouvement >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              GROUP BY DATE(mv2.date_mouvement)
            ) t
          ), 0)
        ) < m.stock_securite_jours
    `);

    const [[{ nb_alertes_ouvertes }]] = await pool.query(
      "SELECT COUNT(*) AS nb_alertes_ouvertes FROM ALERTE WHERE statut_alerte = 'OUVERTE'"
    );

    const [[{ nb_commandes_en_attente }]] = await pool.query(
      "SELECT COUNT(*) AS nb_commandes_en_attente FROM COMMANDE WHERE statut_commande = 'EN_ATTENTE'"
    );

    const [repartitionRisque] = await pool.query(`
      SELECT niveau_risque, COUNT(*) AS total
      FROM ALERTE
      WHERE statut_alerte = 'OUVERTE'
      GROUP BY niveau_risque
    `);

    const [lotsCritiques] = await pool.query(`
      SELECT COUNT(*) AS total FROM LOT WHERE DATEDIFF(date_peremption, CURDATE()) < 30
    `);

    const [dernieresAlertes] = await pool.query(`
      SELECT a.id_alerte, a.niveau_risque, a.date_creation, m.nom_medicament
      FROM ALERTE a
      JOIN MEDICAMENT m ON m.id_medicament = a.id_medicament
      WHERE a.statut_alerte = 'OUVERTE'
      ORDER BY a.date_creation DESC
      LIMIT 5
    `);

    res.json({
      nb_medicaments_actifs,
      nb_sous_seuil,
      nb_alertes_ouvertes,
      nb_commandes_en_attente,
      nb_lots_peremption_proche: lotsCritiques[0].total,
      repartition_risque: repartitionRisque,
      dernieres_alertes: dernieresAlertes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
