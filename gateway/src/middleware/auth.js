const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

/**
 * Verifie le JWT d'acces (Authorization: Bearer <token>, ou a defaut le
 * cookie httpOnly "access_token"). Attache req.user = { id_utilisateur, role }
 * pour les middlewares suivants (RBAC) et les routes.
 *
 * Retourne 401 si absent/invalide/expire : c'est ce que le frontend utilise
 * pour declencher son intercepteur de refresh/redirection vers /login.
 */
function authentifier(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    req.user = { id_utilisateur: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expire' });
  }
}

module.exports = { authentifier };
