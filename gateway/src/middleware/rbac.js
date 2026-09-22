/**
 * RBAC (controle d'acces par role) applique sur chaque route du gateway,
 * en plus (jamais a la place) du masquage cosmetique cote frontend.
 *
 * Usage : router.post('/', authentifier, autoriser('GERANT'), handler)
 *
 * Doit toujours etre utilise APRES le middleware authentifier (qui peuple
 * req.user). Retourne 403 si le role de l'utilisateur connecte n'est pas
 * dans la liste des roles autorises pour cette route.
 */
function autoriser(...rolesAutorises) {
  return function rbacMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }
    if (!rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ error: "Acces refuse : role insuffisant pour cette action" });
    }
    return next();
  };
}

module.exports = { autoriser };
