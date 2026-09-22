const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const pool = require('../db/pool');
const agentClient = require('../services/agentClient');
const {
  JWT_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN_DAYS,
  NODE_ENV,
} = require('../config');

const router = express.Router();

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

const cookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'lax',
  path: REFRESH_COOKIE_PATH,
  maxAge: JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
};

// Limite le bruteforce sur le login : 5 tentatives / 15 min par IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, reessayez plus tard' },
});

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function genererAccessToken(utilisateur) {
  return jwt.sign(
    { sub: utilisateur.id_utilisateur, role: utilisateur.role, email: utilisateur.email, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRES_IN }
  );
}

function genererRefreshToken(utilisateur) {
  return jwt.sign(
    { sub: utilisateur.id_utilisateur, type: 'refresh', jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: `${JWT_REFRESH_EXPIRES_IN_DAYS}d` }
  );
}

async function stockerRefreshToken(idUtilisateur, refreshToken) {
  const expiration = new Date(Date.now() + JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO REFRESH_TOKEN (id_utilisateur, token_hash, date_expiration) VALUES (?, ?, ?)',
    [idUtilisateur, hashToken(refreshToken), expiration]
  );
}

/**
 * POST /api/auth/login
 * Verifie email + mot de passe en appelant l'agent Decision (seul detenteur
 * de la logique de hachage bcrypt / module Utilisateurs), puis emet :
 *  - un access token JWT courte duree (Authorization Bearer, renvoye dans le corps),
 *  - un refresh token longue duree, stocke en httpOnly cookie ET en base (hash)
 *    pour permettre la revocation (logout / reset de mot de passe).
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body || {};
    if (!email || !mot_de_passe) {
      return res.status(400).json({ error: 'email et mot_de_passe sont requis' });
    }

    let verification;
    try {
      verification = await agentClient.verifierMotDePasse({ email, mot_de_passe });
    } catch (err) {
      req.log?.error({ err }, 'echec appel agent decision pour verification mot de passe');
      return res.status(502).json({ error: "Service d'authentification indisponible" });
    }

    if (!verification || !verification.valide) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const utilisateur = {
      id_utilisateur: verification.id_utilisateur,
      nom_utilisateur: verification.nom_utilisateur,
      email: verification.email,
      role: verification.role,
    };

    const accessToken = genererAccessToken(utilisateur);
    const refreshToken = genererRefreshToken(utilisateur);
    await stockerRefreshToken(utilisateur.id_utilisateur, refreshToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
    res.json({
      access_token: accessToken,
      expires_in: JWT_ACCESS_EXPIRES_IN,
      utilisateur: {
        id_utilisateur: utilisateur.id_utilisateur,
        nom_utilisateur: utilisateur.nom_utilisateur,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    req.log?.error({ err }, 'erreur login');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/refresh
 * Lit le refresh token depuis le cookie httpOnly, verifie sa signature ET
 * sa presence non revoquee en base, puis emet un nouveau couple de tokens
 * (rotation du refresh token : l'ancien est marque revoque).
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token absent' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Refresh token invalide ou expire' });
    }
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Refresh token invalide' });
    }

    const tokenHash = hashToken(refreshToken);
    const [rows] = await pool.query(
      'SELECT * FROM REFRESH_TOKEN WHERE token_hash = ? AND id_utilisateur = ?',
      [tokenHash, payload.sub]
    );
    const stocke = rows[0];
    if (!stocke || stocke.revoque || new Date(stocke.date_expiration) < new Date()) {
      return res.status(401).json({ error: 'Refresh token revoque ou expire' });
    }

    const [userRows] = await pool.query(
      'SELECT id_utilisateur, nom_utilisateur, email, role, actif FROM UTILISATEUR WHERE id_utilisateur = ?',
      [payload.sub]
    );
    const utilisateur = userRows[0];
    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ error: 'Utilisateur introuvable ou desactive' });
    }

    // Rotation : on revoque l'ancien refresh token et on en emet un nouveau.
    await pool.query('UPDATE REFRESH_TOKEN SET revoque = TRUE WHERE id_refresh_token = ?', [stocke.id_refresh_token]);

    const accessToken = genererAccessToken(utilisateur);
    const nouveauRefreshToken = genererRefreshToken(utilisateur);
    await stockerRefreshToken(utilisateur.id_utilisateur, nouveauRefreshToken);

    res.cookie(REFRESH_COOKIE_NAME, nouveauRefreshToken, cookieOptions);
    res.json({
      access_token: accessToken,
      expires_in: JWT_ACCESS_EXPIRES_IN,
      utilisateur: {
        id_utilisateur: utilisateur.id_utilisateur,
        nom_utilisateur: utilisateur.nom_utilisateur,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    req.log?.error({ err }, 'erreur refresh');
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Revoque le refresh token courant en base et efface le cookie.
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies && req.cookies[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await pool.query('UPDATE REFRESH_TOKEN SET revoque = TRUE WHERE token_hash = ?', [tokenHash]);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    res.json({ message: 'Deconnexion reussie' });
  } catch (err) {
    req.log?.error({ err }, 'erreur logout');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
