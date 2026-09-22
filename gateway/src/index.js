const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { PORT, FRONTEND_ORIGIN } = require('./config');
const { connectRedis } = require('./redis/client');
const { demarrerOrchestration } = require('./services/orchestrator');
const logger = require('./services/logger');
const { authentifier } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const medicamentsRouter = require('./routes/medicaments');
const mouvementsRouter = require('./routes/mouvements');
const lotsRouter = require('./routes/lots');
const retraitsRouter = require('./routes/retraits');
const fournisseursRouter = require('./routes/fournisseurs');
const commandesRouter = require('./routes/commandes');
const utilisateursRouter = require('./routes/utilisateurs');
const predictionsRouter = require('./routes/predictions');
const alertesRouter = require('./routes/alertes');
const dashboardRouter = require('./routes/dashboard');

const app = express();

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(require('pino-http')({ logger }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));

// Routes d'authentification (non protegees : c'est le point d'entree pour obtenir un token).
app.use('/api/auth', authRouter);

// Toutes les routes metier exigent un JWT valide ; le controle fin par role
// (RBAC) est applique route par route a l'interieur de chaque routeur.
app.use('/api/medicaments', authentifier, medicamentsRouter);
app.use('/api/mouvements', authentifier, mouvementsRouter);
app.use('/api/lots', authentifier, lotsRouter);
app.use('/api/retraits', authentifier, retraitsRouter);
app.use('/api/fournisseurs', authentifier, fournisseursRouter);
app.use('/api/commandes', authentifier, commandesRouter);
app.use('/api/utilisateurs', authentifier, utilisateursRouter);
app.use('/api/predictions', authentifier, predictionsRouter);
app.use('/api/alertes', authentifier, alertesRouter);
app.use('/api/dashboard', authentifier, dashboardRouter);

// Gestion d'erreur generique
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'erreur non geree');
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

async function demarrer() {
  try {
    await connectRedis();
    demarrerOrchestration();
  } catch (err) {
    logger.error({ err }, 'impossible de se connecter a Redis, le pipeline SMA sera indisponible');
  }

  app.listen(PORT, () => {
    logger.info(`gateway demarre sur le port ${PORT}`);
  });
}

demarrer();
