"""
Coeur du calcul du score de risque de penurie.
==============================================

Formule (chaque composante est stockee en base ET retournee par l'API pour
etre affichable separement dans l'UI Previsions) :

    marge_jours     = (stock_actuel / consommation_moyenne_journaliere) - stock_securite_jours
    score_rop       = clamp(0,1, (horizon - marge_jours) / horizon)
    variabilite     = ecart_type_consommation / consommation_moyenne
    score_ml        = score_rop * 0.7 + variabilite * 0.3
    score_ml_ajuste = min(1, score_ml * facteur_saisonnier[mois_courant])
    poids_ved       = {V: 1.3, E: 1.1, D: 0.9}
    score_final     = min(1, score_ml_ajuste * poids_ved[categorie_ved])

Seuils de niveau_risque sur score_final : configurables via variables d'environnement.
"""
import os

HORIZON_JOURS_DEFAUT = int(os.getenv("HORIZON_JOURS", "14"))

SEUIL_FAIBLE = float(os.getenv("SEUIL_FAIBLE", "0.4"))
SEUIL_MOYEN = float(os.getenv("SEUIL_MOYEN", "0.6"))
SEUIL_ELEVE = float(os.getenv("SEUIL_ELEVE", "0.85"))

POIDS_VED = {"V": 1.3, "E": 1.1, "D": 0.9}

MODELE_VERSION = "heuristique-v1"

# Nombre minimal de jours d'historique de DISTRIBUTION requis pour faire confiance
# au calcul (sinon repli automatique, cf. calculer_score_ml).
HISTORIQUE_MINIMUM_JOURS = 5


def clamp(valeur: float, mini: float = 0.0, maxi: float = 1.0) -> float:
    return max(mini, min(maxi, valeur))


def niveau_risque_depuis_score(score_final: float) -> str:
    if score_final < SEUIL_FAIBLE:
        return "FAIBLE"
    if score_final < SEUIL_MOYEN:
        return "MOYEN"
    if score_final < SEUIL_ELEVE:
        return "ELEVE"
    return "CRITIQUE"


def calculer_score_ml(score_rop: float, variabilite: float, nb_jours_historique: int) -> float:
    """Point d'extension : calcul du score ML brut (avant ajustement saisonnier
    et ponderation VED).

    Aujourd'hui : combinaison lineaire heuristique score_rop*0.7 + variabilite*0.3.

    Extension future : un modele XGBoost entraine sur l'historique des mouvements
    pourra remplacer ce calcul (features : score_rop, variabilite, categorie_abc,
    delai_livraison_fournisseur, saison, etc.). Ce n'est PAS implemente ici -
    uniquement la structure permettant de le brancher plus tard (ex: charger un
    modele serialise et appeler modele.predict(features) a la place du calcul
    heuristique ci-dessous).

    Repli automatique : si l'historique de consommation est insuffisant
    (nb_jours_historique < HISTORIQUE_MINIMUM_JOURS), on utilise systematiquement
    le calcul heuristique actuel, meme si un modele ML etait branche, car un
    modele entraine sur peu de donnees ne serait pas fiable.
    """
    historique_suffisant = nb_jours_historique >= HISTORIQUE_MINIMUM_JOURS

    # --- Emplacement reserve pour un futur modele XGBoost ---
    # if historique_suffisant and _modele_xgboost_disponible():
    #     features = _construire_features(score_rop, variabilite, ...)
    #     return clamp(_modele_xgboost.predict(features))
    # ---------------------------------------------------------

    # Calcul heuristique actuel (utilise dans tous les cas pour cette version) :
    return clamp(score_rop * 0.7 + variabilite * 0.3)


def calculer_score_risque(
    stock_actuel: float,
    consommation_moyenne_journaliere: float,
    ecart_type_consommation: float,
    stock_securite_jours: float,
    facteur_saisonnier: float,
    categorie_ved: str,
    horizon_jours: int = HORIZON_JOURS_DEFAUT,
    nb_jours_historique: int = 30,
) -> dict:
    """Calcule l'integralite des composantes du score de risque de penurie.
    Retourne un dict avec toutes les composantes intermediaires afin qu'elles
    soient stockables en base et affichables separement dans l'UI Previsions.
    """
    conso = max(consommation_moyenne_journaliere, 0.0001)  # evite division par zero

    marge_jours = (stock_actuel / conso) - stock_securite_jours
    score_rop = clamp((horizon_jours - marge_jours) / horizon_jours)

    variabilite = ecart_type_consommation / conso if conso > 0 else 0.0
    variabilite = clamp(variabilite, 0.0, 5.0)  # borne large pour eviter les valeurs aberrantes

    score_ml = calculer_score_ml(score_rop, variabilite, nb_jours_historique)

    score_ml_ajuste = min(1.0, score_ml * facteur_saisonnier)

    poids = POIDS_VED.get(categorie_ved, 1.0)
    score_final = min(1.0, score_ml_ajuste * poids)

    niveau_risque = niveau_risque_depuis_score(score_final)

    return {
        "marge_jours": round(marge_jours, 3),
        "score_rop": round(score_rop, 3),
        "variabilite": round(variabilite, 3),
        "score_ml": round(score_ml, 3),
        "facteur_saisonnier": round(facteur_saisonnier, 2),
        "score_ml_ajuste": round(score_ml_ajuste, 3),
        "poids_ved": poids,
        "score_final": round(score_final, 3),
        "niveau_risque": niveau_risque,
        "horizon_jours": horizon_jours,
        "modele_version": MODELE_VERSION,
    }
