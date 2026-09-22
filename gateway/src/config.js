require('dotenv').config();

function requireSecret(name, fallbackDev) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Variable d'environnement obligatoire manquante en production : ${name}`);
  }
  // Uniquement en dev/demo : valeur de repli non secrete, jamais utilisee en production.
  return fallbackDev;
}

module.exports = {
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  AGENT_MONITORING_URL: process.env.AGENT_MONITORING_URL || 'http://localhost:8001',
  AGENT_PREDICTION_URL: process.env.AGENT_PREDICTION_URL || 'http://localhost:8002',
  AGENT_DECISION_URL: process.env.AGENT_DECISION_URL || 'http://localhost:8003',

  CANAL_SEUIL_CRITIQUE: 'stock:seuil_critique',
  CANAL_PREDICTION_CALCULEE: 'prediction:calculee',
  CANAL_COMMANDE_CREEE: 'commande:creee',

  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',

  JWT_SECRET: requireSecret('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN_DAYS: Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || 7),
};
