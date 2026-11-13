/**
 * Scenario de demonstration du pipeline SMA.
 *
 * A lancer APRES seed_base.js et seed_mouvements.js (npm run seed:all).
 *
 * Il choisit les 3 medicaments VITAUX dont le facteur saisonnier du mois courant
 * est le plus eleve (donc ceux pour lesquels un risque ELEVE/CRITIQUE est probable)
 * et prepare :
 *
 *   1. PRE_DECLENCHE : stock deja sous le seuil. Le script appelle l'agent
 *      Monitoring (POST /verifier-stock) : le pipeline reel s'execute
 *      (Monitoring -> Prediction -> Decision) et cree une vraie ALERTE et une
 *      vraie COMMANDE proposee. Les ecrans Alertes/Commandes/Tableau de bord
 *      ne sont donc pas vides au debut de la demo.
 *
 *   2. LIVE_1 et LIVE_2 : stock juste au-dessus du seuil. Une distribution de la
 *      quantite indiquee (a saisir dans l'ecran Mouvements, en direct) fait passer
 *      le stock sous le seuil et declenche tout le pipeline devant le jury.
 *
 * Le calcul reproduit la formule de l'agent Monitoring :
 *   conso_moyenne = moyenne, sur les jours AYANT une distribution durant les 30
 *   derniers jours, de la somme des distributions du jour
 *   jours_de_stock = stock_actuel / conso_moyenne ; seuil = stock_securite_jours
 *
 * Les quantites des lots du medicament sont recalees pour rester egales au stock.
 *
 * Usage : node seed_demo.js [--sans-api]
 *   --sans-api : ne pas appeler l'agent Monitoring (pas de pre-declenchement)
 * Variables d'env : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
 *                   AGENT_MONITORING_URL (defaut http://localhost:8001)
 */
const { getConnection } = require('./db');

const MONITORING_URL = process.env.AGENT_MONITORING_URL || 'http://localhost:8001';
const SANS_API = process.argv.includes('--sans-api');

const FACTEUR_DISTRIBUTION_DEMO = 3; // la distribution "live" vaut 3 jours de consommation moyenne
const MARGE_AVANT = 1.02;            // avant : au moins 2 % au-dessus du seuil
const RATIO_APRES = 0.9;             // apres : au plus 90 % du seuil
const RATIO_PRE_DECLENCHE = 0.8;     // scenario pre-declenche : 80 % du seuil

const PARTS_LOTS = {
  1: [1],
  2: [0.4, 0.6],
  3: [0.2, 0.3, 0.5],
};

// Meme calcul que calculer_conso_moyenne_ecart_type() dans l'agent Monitoring
async function statsConso(conn, idMedicament) {
  const [rows] = await conn.query(
    `SELECT DATE(date_mouvement) AS jour, SUM(quantite_mouvement) AS qte_jour
     FROM MOUVEMENT
     WHERE id_medicament = ?
       AND type_mouvement = 'DISTRIBUTION'
       AND date_mouvement >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(date_mouvement)`,
    [idMedicament]
  );
  const quantites = rows.map((r) => Number(r.qte_jour));
  const n = quantites.length;
  if (n === 0) return { n: 0, somme: 0, moyenne: 0 };
  const somme = quantites.reduce((a, b) => a + b, 0);
  return { n, somme, moyenne: somme / n };
}

async function distributionDejaAujourdhui(conn, idMedicament) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS nb FROM MOUVEMENT
     WHERE id_medicament = ? AND type_mouvement = 'DISTRIBUTION' AND DATE(date_mouvement) = CURDATE()`,
    [idMedicament]
  );
  return Number(rows[0].nb) > 0;
}

// Fixe le stock et recale les lots pour que leur somme == stock
async function fixerStock(conn, idMedicament, stock) {
  await conn.query('UPDATE MEDICAMENT SET stock_actuel = ? WHERE id_medicament = ?', [stock, idMedicament]);
  const [lots] = await conn.query(
    'SELECT id_lot FROM LOT WHERE id_medicament = ? ORDER BY date_peremption ASC',
    [idMedicament]
  );
  if (lots.length === 0) return;
  const parts = PARTS_LOTS[lots.length] || lots.map(() => 1 / lots.length);
  let reste = stock;
  for (let k = 0; k < lots.length; k++) {
    const qte = k === lots.length - 1 ? reste : Math.round(stock * parts[k]);
    reste -= qte;
    await conn.query('UPDATE LOT SET quantite_lot = ? WHERE id_lot = ?', [qte, lots[k].id_lot]);
  }
}

async function declencherPipeline(idMedicament) {
  const res = await fetch(`${MONITORING_URL}/verifier-stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_medicament: idMedicament }),
  });
  if (!res.ok) throw new Error(`Agent Monitoring a repondu ${res.status}`);
  return res.json();
}

async function run() {
  const conn = await getConnection();
  try {
    const mois = new Date().getMonth() + 1;
    const [candidats] = await conn.query(
      `SELECT m.id_medicament, m.nom_medicament, m.code_essentiel, m.stock_securite_jours, c.coefficient
       FROM MEDICAMENT m
       JOIN COEFFICIENT_SAISONNIER c ON c.id_profil = m.id_profil_saisonnier AND c.mois = ?
       WHERE m.actif = TRUE AND m.categorie_ved = 'V'
       ORDER BY c.coefficient DESC, m.id_medicament ASC
       LIMIT 3`,
      [mois]
    );
    if (candidats.length < 3) {
      console.error('Moins de 3 medicaments vitaux trouves. Lancez d\'abord npm run seed:all.');
      process.exit(1);
    }

    const roles = ['PRE_DECLENCHE', 'LIVE_1', 'LIVE_2'];
    const consignes = [];
    let idPreDeclenche = null;

    for (let i = 0; i < candidats.length; i++) {
      const med = candidats[i];
      const role = roles[i];
      const secu = Number(med.stock_securite_jours);
      const { n, somme, moyenne } = await statsConso(conn, med.id_medicament);
      if (moyenne <= 0) {
        console.warn(`[${med.code_essentiel}] aucune distribution sur 30 jours : scenario ignore.`);
        console.warn('  Relancez npm run seed:all (l\'historique du seed se decale avec le temps).');
        continue;
      }

      if (role === 'PRE_DECLENCHE') {
        const stock = Math.max(1, Math.floor(RATIO_PRE_DECLENCHE * secu * moyenne));
        await fixerStock(conn, med.id_medicament, stock);
        idPreDeclenche = med.id_medicament;
        consignes.push({
          role,
          medicament: `${med.code_essentiel} ${med.nom_medicament}`,
          facteur_saisonnier: Number(med.coefficient),
          stock,
          jours_de_stock: (stock / moyenne).toFixed(1),
          seuil_jours: secu,
          action: SANS_API
            ? 'Rien a saisir : appelez POST /verifier-stock ou faites un mouvement pour declencher'
            : 'Pipeline declenche par ce script (alerte + commande a verifier dans l\'interface)',
        });
        continue;
      }

      // Scenario LIVE : stock juste au-dessus du seuil, une distribution le fait passer dessous
      const deja = await distributionDejaAujourdhui(conn, med.id_medicament);
      const q = Math.max(1, Math.round(moyenne * FACTEUR_DISTRIBUTION_DEMO));
      const n2 = deja ? n : n + 1;
      const moyenne2 = (somme + q) / n2;
      const borneBasse = MARGE_AVANT * secu * moyenne;           // stock minimal pour etre "au-dessus"
      const borneHaute = q + RATIO_APRES * secu * moyenne2;       // stock maximal pour passer "sous" apres q
      if (borneBasse > borneHaute) {
        console.warn(`[${med.code_essentiel}] scenario LIVE impossible avec ces donnees, ignore.`);
        continue;
      }
      const stock = Math.floor((borneBasse + borneHaute) / 2);
      if (stock <= q) {
        console.warn(`[${med.code_essentiel}] stock calcule (${stock}) <= quantite de la demo (${q}), ignore.`);
        continue;
      }
      await fixerStock(conn, med.id_medicament, stock);
      consignes.push({
        role,
        medicament: `${med.code_essentiel} ${med.nom_medicament}`,
        facteur_saisonnier: Number(med.coefficient),
        stock,
        jours_avant: (stock / moyenne).toFixed(1),
        jours_apres_attendus: ((stock - q) / moyenne2).toFixed(1),
        seuil_jours: secu,
        action: `Ecran Mouvements -> Distribution de ${q} unites`,
      });
    }

    if (idPreDeclenche && !SANS_API) {
      console.log(`\nAppel de l'agent Monitoring (${MONITORING_URL}) pour pre-declencher le pipeline...`);
      try {
        const r = await declencherPipeline(idPreDeclenche);
        console.log('Reponse Monitoring :', JSON.stringify(r));
        console.log('Attendez 5 a 10 secondes : alerte et commande doivent apparaitre.');
      } catch (err) {
        console.warn(`Impossible de joindre l'agent Monitoring : ${err.message}`);
        console.warn('Verifiez que les services tournent, ou relancez avec AGENT_MONITORING_URL.');
      }
    }

    console.log('\n=== SCENARIO DE DEMO ===');
    for (const c of consignes) {
      console.log(`\n[${c.role}] ${c.medicament} (facteur saisonnier ${c.facteur_saisonnier})`);
      for (const [k, v] of Object.entries(c)) {
        if (!['role', 'medicament', 'facteur_saisonnier'].includes(k)) console.log(`  ${k} : ${v}`);
      }
    }
    console.log('\nNote : lancez ce script peu de temps avant la demonstration. L\'historique du seed');
    console.log('est calcule par rapport a la date du jour et sort de la fenetre de 30 jours ensuite.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Erreur lors du scenario de demo :', err);
  process.exit(1);
});