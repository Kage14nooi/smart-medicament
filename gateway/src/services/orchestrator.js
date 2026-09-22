const { subscriber } = require('../redis/client');
const { CANAL_SEUIL_CRITIQUE, CANAL_PREDICTION_CALCULEE, CANAL_COMMANDE_CREEE } = require('../config');
const agentClient = require('./agentClient');

/**
 * Orchestration du pipeline SMA cote gateway :
 *  - etape 3 : sur reception de "stock:seuil_critique", appelle l'agent Prediction.
 *  - etape 5 : sur reception de "prediction:calculee" avec niveau_risque ELEVE/CRITIQUE,
 *              appelle l'agent Decision.
 *
 * Note : les agents Prediction et Decision ecoutent AUSSI directement Redis en
 * parallele (redondance volontaire visible dans leur code), ce qui illustre
 * bien la communication inter-agents par Redis uniquement. Le gateway, lui,
 * declenche activement les agents via HTTP en plus d'observer le bus, comme
 * decrit dans le cahier des charges ("le gateway PEUT appeler les agents via HTTP").
 */
function demarrerOrchestration() {
  subscriber.subscribe(CANAL_SEUIL_CRITIQUE, async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[orchestrateur] stock:seuil_critique recu pour medicament ${data.id_medicament}`);
      await agentClient.predire(data.id_medicament);
    } catch (err) {
      console.error('[orchestrateur] erreur lors du traitement de stock:seuil_critique :', err.message);
    }
  });

  subscriber.subscribe(CANAL_PREDICTION_CALCULEE, async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(
        `[orchestrateur] prediction:calculee recu pour medicament ${data.id_medicament} (risque=${data.niveau_risque})`
      );
      if (data.niveau_risque === 'ELEVE' || data.niveau_risque === 'CRITIQUE') {
        await agentClient.traiterPrediction(data);
      }
    } catch (err) {
      console.error('[orchestrateur] erreur lors du traitement de prediction:calculee :', err.message);
    }
  });

  subscriber.subscribe(CANAL_COMMANDE_CREEE, async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[orchestrateur] commande:creee recue : commande ${data.id_commande}, alerte ${data.id_alerte}`);
    } catch (err) {
      console.error('[orchestrateur] erreur lors du traitement de commande:creee :', err.message);
    }
  });

  console.log('[orchestrateur] abonnements Redis actifs');
}

module.exports = { demarrerOrchestration };
