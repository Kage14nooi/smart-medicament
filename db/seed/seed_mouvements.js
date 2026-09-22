/**
 * Genere un historique de MOUVEMENT sur ~24 mois avec une vraie saisonnalite
 * dans les quantites DISTRIBUTION, pilotee par le profil saisonnier de chaque medicament.
 *
 * Objectif documente : quelques milliers de mouvements (ordre de grandeur raisonnable
 * pour demontrer la saisonnalite sans exploser le temps de generation), au lieu des
 * ~28500 mouvements theoriques du cahier des charges complet.
 *
 * Usage : node seed_mouvements.js
 */
const { getConnection } = require('./db');

const MOIS_HISTORIQUE = 24;
const JOURS_PAR_MOIS_SIMULES = 10; // on echantillonne ~10 jours actifs par mois (pas tous les jours) -> volume raisonnable

// petite PRNG deterministe (seedable) pour reproductibilite du seed
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240115);

function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function run() {
  const conn = await getConnection();
  try {
    const [medicaments] = await conn.query(
      `SELECT m.id_medicament, m.stock_actuel, m.id_profil_saisonnier
       FROM MEDICAMENT m`
    );
    if (medicaments.length === 0) {
      console.error('Aucun medicament trouve. Lancez d\'abord seed_base.js.');
      process.exit(1);
    }

    const [coefRows] = await conn.query(
      'SELECT id_profil, mois, coefficient FROM COEFFICIENT_SAISONNIER'
    );
    const coefMap = {}; // id_profil -> { mois: coefficient }
    for (const row of coefRows) {
      if (!coefMap[row.id_profil]) coefMap[row.id_profil] = {};
      coefMap[row.id_profil][row.mois] = Number(row.coefficient);
    }

    const [lotRows] = await conn.query('SELECT id_lot, id_medicament, quantite_lot FROM LOT');
    const lotsByMed = {};
    for (const l of lotRows) {
      if (!lotsByMed[l.id_medicament]) lotsByMed[l.id_medicament] = [];
      lotsByMed[l.id_medicament].push(l.id_lot);
    }

    const startDate = addDays(new Date(), -MOIS_HISTORIQUE * 30);

    console.log(`Generation de l'historique sur ${MOIS_HISTORIQUE} mois pour ${medicaments.length} medicaments...`);

    const batch = [];
    const BATCH_SIZE = 1000;
    let totalInserted = 0;

    async function flush() {
      if (batch.length === 0) return;
      await conn.query(
        `INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, date_mouvement, source_mouvement)
         VALUES ?`,
        [batch]
      );
      totalInserted += batch.length;
      batch.length = 0;
    }

    for (const med of medicaments) {
      const baseConsoJournaliere = Math.max(3, Math.round(med.stock_actuel / 90)); // ordre de grandeur plausible
      const lots = lotsByMed[med.id_medicament] || [null];
      const profilCoefs = coefMap[med.id_profil_saisonnier] || {};

      for (let moisOffset = 0; moisOffset < MOIS_HISTORIQUE; moisOffset++) {
        const moisDate = addDays(startDate, moisOffset * 30);
        const moisCourant = moisDate.getMonth() + 1; // 1-12
        const coefficient = profilCoefs[moisCourant] !== undefined ? profilCoefs[moisCourant] : 1.0;

        // jours actifs distribues aleatoirement dans le mois (echantillonnage)
        const joursActifs = new Set();
        while (joursActifs.size < JOURS_PAR_MOIS_SIMULES) {
          joursActifs.add(randInt(0, 29));
        }

        for (const jourOffset of joursActifs) {
          const date = addDays(moisDate, jourOffset);
          date.setHours(randInt(8, 17), randInt(0, 59), 0, 0);

          // DISTRIBUTION : quantite journaliere avec variabilite + saisonnalite
          const variabilite = randInt(-30, 30) / 100; // +/-30%
          const qteDistribution = Math.max(
            1,
            Math.round(baseConsoJournaliere * coefficient * (1 + variabilite))
          );
          const lotChoisi = lots[randInt(0, lots.length - 1)];
          batch.push([
            med.id_medicament,
            lotChoisi,
            'DISTRIBUTION',
            qteDistribution,
            toMysqlDatetime(date),
            'SEED_HISTORIQUE',
          ]);

          // De temps en temps, une ENTREE de reapprovisionnement (environ 1 fois / 20 jours actifs)
          if (rand() < 0.05) {
            const dateEntree = new Date(date);
            dateEntree.setHours(randInt(8, 12), randInt(0, 59), 0, 0);
            batch.push([
              med.id_medicament,
              lotChoisi,
              'ENTREE',
              randInt(50, 300),
              toMysqlDatetime(dateEntree),
              'SEED_HISTORIQUE',
            ]);
          }

          // Rarement, un AJUSTEMENT (inventaire physique)
          if (rand() < 0.01) {
            const dateAdj = new Date(date);
            dateAdj.setHours(randInt(8, 12), randInt(0, 59), 0, 0);
            const delta = randInt(-15, 15);
            if (delta !== 0) {
              batch.push([
                med.id_medicament,
                lotChoisi,
                'AJUSTEMENT',
                delta,
                toMysqlDatetime(dateAdj),
                'SEED_HISTORIQUE',
              ]);
            }
          }

          if (batch.length >= BATCH_SIZE) {
            await flush();
          }
        }
      }
    }
    await flush();

    console.log(`Historique genere : ${totalInserted} mouvements inseres.`);
    console.log('Note : ceci ne modifie pas stock_actuel (c\'est un historique retrospectif servant');
    console.log('a calculer la consommation moyenne/ecart-type ; le stock_actuel du seed de base reste');
    console.log('la valeur courante de reference pour les tests du pipeline SMA).');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Erreur lors de la generation des mouvements :', err);
  process.exit(1);
});
