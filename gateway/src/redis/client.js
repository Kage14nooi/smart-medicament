const { createClient } = require('redis');
const logger = require('../services/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Deux connexions distinctes : une pour publier, une dediee a l'abonnement
// (la lib `redis` v4 impose une connexion separee des lors qu'on entre en mode subscriber).
// reconnectStrategy : reconnexion automatique avec backoff exponentiel plafonne,
// pour survivre a une coupure Redis passagere sans intervention manuelle.
function reconnectStrategy(retries) {
  const delay = Math.min(retries * 200, 5000);
  logger.warn(`[redis] tentative de reconnexion #${retries} dans ${delay}ms`);
  return delay;
}

const publisher = createClient({ url: REDIS_URL, socket: { reconnectStrategy } });
const subscriber = createClient({ url: REDIS_URL, socket: { reconnectStrategy } });

publisher.on('error', (err) => logger.error({ err }, '[redis-publisher] erreur'));
subscriber.on('error', (err) => logger.error({ err }, '[redis-subscriber] erreur'));
publisher.on('reconnecting', () => logger.warn('[redis-publisher] reconnexion en cours'));
subscriber.on('reconnecting', () => logger.warn('[redis-subscriber] reconnexion en cours'));
publisher.on('ready', () => logger.info('[redis-publisher] connecte'));
subscriber.on('ready', () => logger.info('[redis-subscriber] connecte'));

async function connectRedis() {
  await publisher.connect();
  await subscriber.connect();
  logger.info('[redis] connecte (publisher + subscriber)');
}

/**
 * Publie de facon defensive : en cas d'echec (Redis indisponible), on logue
 * un warning explicite plutot que de laisser l'exception se propager en
 * silence ou de faire echouer la requete HTTP appelante.
 */
async function publierSansException(canal, message) {
  try {
    await publisher.publish(canal, message);
    return true;
  } catch (err) {
    logger.warn({ err, canal }, '[redis] echec de publication');
    return false;
  }
}

module.exports = { publisher, subscriber, connectRedis, publierSansException };
