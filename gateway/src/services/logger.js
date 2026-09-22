const pino = require('pino');
const { LOG_LEVEL } = require('../config');

// Logs structures JSON (niveau configurable via LOG_LEVEL : debug, info, warn, error...).
// En production, un JSON par ligne est directement exploitable par un collecteur
// de logs (ex: docker logs -> stack ELK/Loki) sans parsing fragile.
const logger = pino({ level: LOG_LEVEL });

module.exports = logger;
