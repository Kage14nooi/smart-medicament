/**
 * Seed de base : profils saisonniers + coefficients, fournisseurs, medicaments,
 * relations medicament-fournisseur, lots, utilisateurs.
 *
 * Usage : node seed_base.js
 * Variables d'env : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */
const bcrypt = require('bcryptjs');
const { getConnection } = require('./db');

// mot de passe de demo "depot1234" hashe en bcrypt (authentification JWT reelle,
// cf. gateway/src/routes/auth.js). Meme algorithme que celui utilise par
// l'agent Decision (module Utilisateurs) pour rester coherent.
function hashPassword(pwd) {
  return bcrypt.hashSync(pwd, 10);
}

// Coefficients jan..dec
const PROFILS = [
  {
    nom: 'STABLE',
    description: 'Consommation stable toute l\'annee, sans effet saisonnier marque',
    coefficients: [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00],
  },
  {
    nom: 'RHUME_SAISON_FRAICHE',
    description: 'Pic de demande pendant la saison fraiche/hivernale (mai a septembre)',
    coefficients: [0.80, 0.80, 0.90, 1.00, 1.40, 1.50, 1.50, 1.40, 1.20, 1.00, 0.80, 0.80],
  },
  {
    nom: 'PALUDISME_SAISON_PLUIES',
    description: 'Pic de demande pendant la saison des pluies (novembre a avril)',
    coefficients: [1.50, 1.60, 1.40, 1.30, 0.90, 0.70, 0.60, 0.60, 0.70, 0.90, 1.30, 1.50],
  },
  {
    nom: 'DIARRHEE_SAISON_CHAUDE',
    description: 'Pic de demande pendant la saison chaude (octobre a janvier)',
    coefficients: [1.40, 1.20, 0.90, 0.70, 0.60, 0.60, 0.70, 0.80, 1.00, 1.30, 1.50, 1.50],
  },
];

const FOURNISSEURS = [
  { nom: 'CentraMed Distribution', fiabilite: 0.930, contact: 'contact@centramed.example' },
  { nom: 'PharmaGros Regional', fiabilite: 0.870, contact: 'ventes@pharmagros.example' },
  { nom: 'Grossiste Sante Plus', fiabilite: 0.780, contact: 'info@santeplus.example' },
  { nom: 'Depot Central Generiques', fiabilite: 0.910, contact: 'commandes@depotcentral.example' },
  { nom: 'MedSupply Afrique', fiabilite: 0.650, contact: 'orders@medsupply.example' },
  { nom: 'UniPharma Grossiste', fiabilite: 0.720, contact: 'contact@unipharma.example' },
  { nom: 'Fournisseur Essentiels SA', fiabilite: 0.840, contact: 'ventes@essentiels-sa.example' },
  { nom: 'Global Health Supply Co', fiabilite: 0.600, contact: 'sales@ghsupply.example' },
];

// index de profil : 0=STABLE 1=RHUME 2=PALUDISME 3=DIARRHEE (assigne apres insertion)
const MEDICAMENTS = [
  { nom: 'Paracetamol 500mg comprime', dci: 'Paracetamol', code: 'ESS-001', forme: 'Comprime', ved: 'V', abc: 'A', profil: 0, stock: 4000, secu: 10, prix: 15 },
  { nom: 'Paracetamol sirop pediatrique', dci: 'Paracetamol', code: 'ESS-002', forme: 'Sirop', ved: 'V', abc: 'A', profil: 1, stock: 800, secu: 12, prix: 350 },
  { nom: 'Amoxicilline 500mg gelule', dci: 'Amoxicilline', code: 'ESS-003', forme: 'Gelule', ved: 'V', abc: 'A', profil: 1, stock: 2500, secu: 10, prix: 45 },
  { nom: 'Ibuprofene 400mg comprime', dci: 'Ibuprofene', code: 'ESS-004', forme: 'Comprime', ved: 'E', abc: 'B', profil: 0, stock: 1800, secu: 8, prix: 20 },
  { nom: 'Artemether-Lumefantrine 20/120mg', dci: 'Artemether-Lumefantrine', code: 'ESS-005', forme: 'Comprime', ved: 'V', abc: 'A', profil: 2, stock: 1200, secu: 14, prix: 600 },
  { nom: 'Chloroquine 100mg comprime', dci: 'Chloroquine', code: 'ESS-006', forme: 'Comprime', ved: 'V', abc: 'B', profil: 2, stock: 900, secu: 12, prix: 80 },
  { nom: 'Sels de rehydratation orale (SRO)', dci: 'SRO', code: 'ESS-007', forme: 'Sachet', ved: 'V', abc: 'A', profil: 3, stock: 3000, secu: 10, prix: 100 },
  { nom: 'Zinc sulfate 20mg comprime', dci: 'Zinc sulfate', code: 'ESS-008', forme: 'Comprime', ved: 'E', abc: 'B', profil: 3, stock: 1500, secu: 10, prix: 40 },
  { nom: 'Metronidazole 500mg comprime', dci: 'Metronidazole', code: 'ESS-009', forme: 'Comprime', ved: 'E', abc: 'B', profil: 3, stock: 1300, secu: 9, prix: 35 },
  { nom: 'Cotrimoxazole 480mg comprime', dci: 'Cotrimoxazole', code: 'ESS-010', forme: 'Comprime', ved: 'E', abc: 'B', profil: 1, stock: 1100, secu: 10, prix: 30 },
  { nom: 'Vitamine A 100000 UI capsule', dci: 'Retinol', code: 'ESS-011', forme: 'Capsule', ved: 'D', abc: 'C', profil: 0, stock: 700, secu: 15, prix: 25 },
  { nom: 'Fer + Acide folique comprime', dci: 'Fer/Acide folique', code: 'ESS-012', forme: 'Comprime', ved: 'E', abc: 'B', profil: 0, stock: 1600, secu: 12, prix: 18 },
  { nom: 'Albendazole 400mg comprime', dci: 'Albendazole', code: 'ESS-013', forme: 'Comprime', ved: 'D', abc: 'C', profil: 3, stock: 600, secu: 20, prix: 22 },
  { nom: 'Diazepam 5mg comprime', dci: 'Diazepam', code: 'ESS-014', forme: 'Comprime', ved: 'D', abc: 'C', profil: 0, stock: 400, secu: 20, prix: 60 },
  { nom: 'Omeprazole 20mg gelule', dci: 'Omeprazole', code: 'ESS-015', forme: 'Gelule', ved: 'E', abc: 'B', profil: 0, stock: 950, secu: 10, prix: 55 },
];

const UTILISATEURS = [
  { nom: 'Rakoto Andriamampianina', email: 'gerant.depot@smart-medicament.example', role: 'GERANT' },
  { nom: 'Hanta Razafindrakoto', email: 'superviseur.district@smart-medicament.example', role: 'SUPERVISEUR' },
  { nom: 'Tolotra Rakotondravelo', email: 'tolotra.rakotondravelo@tetika.eu', role: 'GERANT' },
];

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const conn = await getConnection();
  try {
    console.log('Nettoyage des tables (ordre respectant les FK)...');
    await conn.query(`
      SET FOREIGN_KEY_CHECKS = 0;
      TRUNCATE TABLE REFRESH_TOKEN;
      TRUNCATE TABLE ALERTE;
      TRUNCATE TABLE PREDICTION;
      TRUNCATE TABLE COMMANDE;
      TRUNCATE TABLE RETRAIT_DESTRUCTION;
      TRUNCATE TABLE MOUVEMENT;
      TRUNCATE TABLE LOT;
      TRUNCATE TABLE MEDICAMENT_FOURNISSEUR;
      TRUNCATE TABLE MEDICAMENT;
      TRUNCATE TABLE FOURNISSEUR;
      TRUNCATE TABLE COEFFICIENT_SAISONNIER;
      TRUNCATE TABLE PROFIL_SAISONNIER;
      TRUNCATE TABLE UTILISATEUR;
      SET FOREIGN_KEY_CHECKS = 1;
    `);

    console.log('Insertion des profils saisonniers + coefficients...');
    const profilIds = [];
    for (const p of PROFILS) {
      const [res] = await conn.query(
        'INSERT INTO PROFIL_SAISONNIER (nom_profil, description) VALUES (?, ?)',
        [p.nom, p.description]
      );
      profilIds.push(res.insertId);
      const rows = p.coefficients.map((c, idx) => [res.insertId, idx + 1, c]);
      await conn.query(
        'INSERT INTO COEFFICIENT_SAISONNIER (id_profil, mois, coefficient) VALUES ?',
        [rows]
      );
    }

    console.log('Insertion des fournisseurs...');
    const fournisseurIds = [];
    for (const f of FOURNISSEURS) {
      const [res] = await conn.query(
        'INSERT INTO FOURNISSEUR (nom_fournisseur, fiabilite_score, contact, actif) VALUES (?, ?, ?, TRUE)',
        [f.nom, f.fiabilite, f.contact]
      );
      fournisseurIds.push(res.insertId);
    }

    console.log('Insertion des medicaments...');
    const medicamentIds = [];
    for (const m of MEDICAMENTS) {
      const [res] = await conn.query(
        `INSERT INTO MEDICAMENT
          (nom_medicament, dci, code_essentiel, forme_pharmaceutique, categorie_ved, categorie_abc,
           id_profil_saisonnier, stock_actuel, stock_securite_jours, prix_unitaire, actif)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [m.nom, m.dci, m.code, m.forme, m.ved, m.abc, profilIds[m.profil], m.stock, m.secu, m.prix]
      );
      medicamentIds.push(res.insertId);
    }

    console.log('Insertion des relations medicament-fournisseur...');
    // Chaque medicament est relie a 2-3 fournisseurs distincts choisis de facon deterministe
    for (let i = 0; i < medicamentIds.length; i++) {
      const nbFournisseurs = 2 + (i % 2); // 2 ou 3
      const startIdx = i % fournisseurIds.length;
      const chosen = new Set();
      for (let k = 0; k < nbFournisseurs; k++) {
        chosen.add(fournisseurIds[(startIdx + k) % fournisseurIds.length]);
      }
      for (const idFournisseur of chosen) {
        const delaiMoyen = 5 + ((idFournisseur + i) % 10); // 5-14 jours
        const delaiMax = delaiMoyen + 5 + (i % 5);
        const prixAchat = (MEDICAMENTS[i].prix * (0.55 + ((idFournisseur % 5) * 0.05))).toFixed(2);
        await conn.query(
          `INSERT INTO MEDICAMENT_FOURNISSEUR
            (id_medicament, id_fournisseur, delai_livraison_moyen_jours, delai_livraison_max_jours, prix_achat)
           VALUES (?, ?, ?, ?, ?)`,
          [medicamentIds[i], idFournisseur, delaiMoyen, delaiMax, prixAchat]
        );
      }
    }

    console.log('Insertion des lots (avec dates de peremption variees)...');
    const today = new Date();
    // Pour chaque medicament, 2 a 3 lots : un proche peremption, un moyen terme, un lointain
    const peremptionOffsets = [20, 75, 400]; // jours -> rouge (<30), orange (<90), vert
    for (let i = 0; i < medicamentIds.length; i++) {
      const nbLots = 2 + (i % 2);
      for (let k = 0; k < nbLots; k++) {
        const offset = peremptionOffsets[k % peremptionOffsets.length];
        const fournisseurChoisi = fournisseurIds[(i + k) % fournisseurIds.length];
        const numeroLot = `LOT-${MEDICAMENTS[i].code}-${String(k + 1).padStart(2, '0')}`;
        const qte = 100 + ((i * 37 + k * 53) % 400);
        await conn.query(
          `INSERT INTO LOT (id_medicament, id_fournisseur, numero_lot, date_peremption, quantite_lot)
           VALUES (?, ?, ?, ?, ?)`,
          [medicamentIds[i], fournisseurChoisi, numeroLot, addDays(today, offset), qte]
        );
      }
    }

    console.log('Insertion des utilisateurs...');
    for (const u of UTILISATEURS) {
      await conn.query(
        `INSERT INTO UTILISATEUR (nom_utilisateur, email, mot_de_passe_hash, role, actif)
         VALUES (?, ?, ?, ?, TRUE)`,
        [u.nom, u.email, hashPassword('depot1234'), u.role]
      );
    }

    console.log('Seed de base termine avec succes.');
    console.log(`  - ${profilIds.length} profils saisonniers`);
    console.log(`  - ${fournisseurIds.length} fournisseurs`);
    console.log(`  - ${medicamentIds.length} medicaments`);
    console.log(`  - ${UTILISATEURS.length} utilisateurs`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Erreur lors du seed de base :', err);
  process.exit(1);
});
