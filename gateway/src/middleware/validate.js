/**
 * Middleware generique de validation du corps de requete via un schema Zod.
 * Retourne 400 avec le detail des erreurs si la validation echoue, et
 * remplace req.body par la version validee/normalisee (coercions Zod incluses)
 * pour que les routes puissent lui faire confiance en aval.
 */
function validerCorps(schema) {
  return function validationMiddleware(req, res, next) {
    const resultat = schema.safeParse(req.body);
    if (!resultat.success) {
      return res.status(400).json({
        error: 'Corps de requete invalide',
        details: resultat.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      });
    }
    req.body = resultat.data;
    return next();
  };
}

module.exports = { validerCorps };
