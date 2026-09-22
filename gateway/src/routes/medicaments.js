const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { autoriser } = require('../middleware/rbac');
const { validerCorps } = require('../middleware/validate');

const router = express.Router();

// Medicaments : GERANT en CRUD (sans suppression reelle, archivage ok),
// SUPERVISEUR en lecture seule.
const LECTURE = autoriser('GERANT', 'SUPERVISEUR');
const ECRITURE = autoriser('GERANT');

const medicamentSchema = z.object({
  nom_medicament: z.string().min(2).max(150),
  dci: z.string().min(2).max(150),
  code_essentiel: z.string().min(1).max(30),
  forme_pharmaceutique: z.string().max(80).optional().nullable(),
  categorie_ved: z.enum(['V', 'E', 'D']).optional(),
  categorie_abc: z.enum(['A', 'B', 'C']).optional(),
  id_profil_saisonnier: z.coerce.number().int().positive().optional().nullable(),
  stock_actuel: z.coerce.number().int().min(0).optional(),
  stock_securite_jours: z.coerce.number().min(0).optional(),
  prix_unitaire: z.coerce.number().min(0).optional(),
});

const medicamentUpdateSchema = medicamentSchema.partial({
  categorie_ved: true,
  categorie_abc: true,
}).extend({
  categorie_ved: z.enum(['V', 'E', 'D']),
  categorie_abc: z.enum(['A', 'B', 'C']),
});

// Liste des medicaments (avec possibilite de filtrer sur les actifs uniquement)
router.get('/', LECTURE, async (req, res) => {
  try {
    const { actif } = req.query;
    let sql = `
      SELECT m.*, p.nom_profil AS nom_profil_saisonnier
      FROM MEDICAMENT m
      LEFT JOIN PROFIL_SAISONNIER p ON p.id_profil = m.id_profil_saisonnier
    `;
    const params = [];
    if (actif !== undefined) {
      sql += ' WHERE m.actif = ?';
      params.push(actif === 'true' ? 1 : 0);
    }
    sql += ' ORDER BY m.nom_medicament ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profils-saisonniers', LECTURE, async (req, res) => {
  try {
    const [profils] = await pool.query('SELECT * FROM PROFIL_SAISONNIER ORDER BY nom_profil');
    const [coefs] = await pool.query('SELECT * FROM COEFFICIENT_SAISONNIER ORDER BY id_profil, mois');
    const profilsAvecCoefs = profils.map((p) => ({
      ...p,
      coefficients: coefs.filter((c) => c.id_profil === p.id_profil),
    }));
    res.json(profilsAvecCoefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', LECTURE, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, p.nom_profil AS nom_profil_saisonnier
       FROM MEDICAMENT m
       LEFT JOIN PROFIL_SAISONNIER p ON p.id_profil = m.id_profil_saisonnier
       WHERE m.id_medicament = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Medicament introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', ECRITURE, validerCorps(medicamentSchema), async (req, res) => {
  try {
    const {
      nom_medicament, dci, code_essentiel, forme_pharmaceutique,
      categorie_ved, categorie_abc, id_profil_saisonnier,
      stock_actuel, stock_securite_jours, prix_unitaire,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO MEDICAMENT
        (nom_medicament, dci, code_essentiel, forme_pharmaceutique, categorie_ved, categorie_abc,
         id_profil_saisonnier, stock_actuel, stock_securite_jours, prix_unitaire, actif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        nom_medicament, dci, code_essentiel, forme_pharmaceutique || null,
        categorie_ved || 'E', categorie_abc || 'B', id_profil_saisonnier || null,
        stock_actuel || 0, stock_securite_jours || 7, prix_unitaire || 0,
      ]
    );
    res.status(201).json({ id_medicament: result.insertId, message: 'Medicament cree avec succes' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ce code essentiel existe deja' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', ECRITURE, validerCorps(medicamentUpdateSchema), async (req, res) => {
  try {
    const {
      nom_medicament, dci, code_essentiel, forme_pharmaceutique,
      categorie_ved, categorie_abc, id_profil_saisonnier,
      stock_securite_jours, prix_unitaire,
    } = req.body;

    const [result] = await pool.query(
      `UPDATE MEDICAMENT SET
        nom_medicament = ?, dci = ?, code_essentiel = ?, forme_pharmaceutique = ?,
        categorie_ved = ?, categorie_abc = ?, id_profil_saisonnier = ?,
        stock_securite_jours = ?, prix_unitaire = ?
       WHERE id_medicament = ?`,
      [
        nom_medicament, dci, code_essentiel, forme_pharmaceutique || null,
        categorie_ved, categorie_abc, id_profil_saisonnier || null,
        stock_securite_jours, prix_unitaire, req.params.id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Medicament introuvable' });
    res.json({ message: 'Medicament mis a jour avec succes' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archivage (jamais de suppression reelle)
router.put('/:id/archiver', ECRITURE, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE MEDICAMENT SET actif = FALSE WHERE id_medicament = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Medicament introuvable' });
    res.json({ message: 'Medicament archive avec succes' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/reactiver', ECRITURE, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE MEDICAMENT SET actif = TRUE WHERE id_medicament = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Medicament introuvable' });
    res.json({ message: 'Medicament reactive avec succes' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
