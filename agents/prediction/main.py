"""
Agent Prediction (port 8002)
============================
Expose un endpoint HTTP /predire/{id_medicament} que le gateway appelle
(en reaction a l'evenement Redis "stock:seuil_critique" qu'il ecoute) pour
declencher le calcul du score de risque de penurie. Insere une ligne PREDICTION,
puis publie "prediction:calculee" sur Redis pour la suite du pipeline.

Cet agent possede sa PROPRE connexion MySQL et n'appelle jamais directement
les autres agents (uniquement Redis pub, jamais d'appel HTTP agent->agent).
"""
import os
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from db import get_connection
from redis_bus import publier, CANAL_PREDICTION_CALCULEE
from scoring import calculer_score_risque, HORIZON_JOURS_DEFAUT
from logging_config import get_logger

logger = get_logger("agent-prediction")

app = FastAPI(title="Agent Prediction", version="1.0.0")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


def recuperer_facteur_saisonnier(cur, id_profil_saisonnier, mois_courant: int) -> float:
    if not id_profil_saisonnier:
        return 1.0
    cur.execute(
        "SELECT coefficient FROM COEFFICIENT_SAISONNIER WHERE id_profil = %s AND mois = %s",
        (id_profil_saisonnier, mois_courant),
    )
    row = cur.fetchone()
    return float(row["coefficient"]) if row else 1.0


def calculer_conso_moyenne_ecart_type(cur, id_medicament: int):
    cur.execute(
        """
        SELECT DATE(date_mouvement) AS jour, SUM(quantite_mouvement) AS qte_jour
        FROM MOUVEMENT
        WHERE id_medicament = %s
          AND type_mouvement = 'DISTRIBUTION'
          AND date_mouvement >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(date_mouvement)
        """,
        (id_medicament,),
    )
    rows = cur.fetchall()
    quantites = [float(r["qte_jour"]) for r in rows]
    n = len(quantites)
    if n == 0:
        return 0.0, 0.0, 0
    moyenne = sum(quantites) / n
    if n > 1:
        variance = sum((q - moyenne) ** 2 for q in quantites) / n
        ecart_type = variance ** 0.5
    else:
        ecart_type = 0.0
    return moyenne, ecart_type, n


def executer_prediction(id_medicament: int) -> dict:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id_medicament, nom_medicament, stock_actuel, stock_securite_jours,
                       categorie_ved, id_profil_saisonnier
                FROM MEDICAMENT WHERE id_medicament = %s
                """,
                (id_medicament,),
            )
            med = cur.fetchone()
            if not med:
                raise HTTPException(status_code=404, detail="Medicament introuvable")

            moyenne, ecart_type, nb_jours_historique = calculer_conso_moyenne_ecart_type(cur, id_medicament)
            mois_courant = datetime.now().month
            facteur_saisonnier = recuperer_facteur_saisonnier(cur, med["id_profil_saisonnier"], mois_courant)

            composantes = calculer_score_risque(
                stock_actuel=float(med["stock_actuel"]),
                consommation_moyenne_journaliere=moyenne,
                ecart_type_consommation=ecart_type,
                stock_securite_jours=float(med["stock_securite_jours"]),
                facteur_saisonnier=facteur_saisonnier,
                categorie_ved=med["categorie_ved"],
                horizon_jours=HORIZON_JOURS_DEFAUT,
                nb_jours_historique=nb_jours_historique,
            )

            cur.execute(
                """
                INSERT INTO PREDICTION
                    (id_medicament, horizon_jours, score_rop, score_ml, facteur_saisonnier,
                     score_final, niveau_risque, modele_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    id_medicament,
                    composantes["horizon_jours"],
                    composantes["score_rop"],
                    composantes["score_ml"],
                    composantes["facteur_saisonnier"],
                    composantes["score_final"],
                    composantes["niveau_risque"],
                    composantes["modele_version"],
                ),
            )
            id_prediction = cur.lastrowid

            resultat = {
                "id_prediction": id_prediction,
                "id_medicament": id_medicament,
                "nom_medicament": med["nom_medicament"],
                "consommation_moyenne_journaliere": round(moyenne, 3),
                "ecart_type_consommation": round(ecart_type, 3),
                "categorie_ved": med["categorie_ved"],
                **composantes,
            }

            logger.info(
                f"prediction calculee pour medicament {id_medicament} : "
                f"niveau_risque={composantes['niveau_risque']} score_final={composantes['score_final']}"
            )
            publier(CANAL_PREDICTION_CALCULEE, {
                "id_medicament": id_medicament,
                "id_prediction": id_prediction,
                "niveau_risque": composantes["niveau_risque"],
            })

            return resultat
    finally:
        conn.close()


@app.post("/predire/{id_medicament}")
def predire(id_medicament: int):
    return executer_prediction(id_medicament)


@app.get("/predictions/{id_medicament}")
def historique_predictions(id_medicament: int, limite: int = 20):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM PREDICTION
                WHERE id_medicament = %s
                ORDER BY date_prediction DESC
                LIMIT %s
                """,
                (id_medicament, limite),
            )
            return cur.fetchall()
    finally:
        conn.close()


@app.get("/health")
def health():
    return {"status": "ok", "agent": "prediction"}


@app.on_event("startup")
def on_startup():
    logger.info("agent prediction demarre")


# ---------------------------------------------------------------------------
# Note d'architecture : cet agent NE s'auto-declenche PAS sur "stock:seuil_critique".
# Seul le gateway (coordinateur) ecoute ce canal et appelle POST /predire/{id} en HTTP
# (cf. diagramme de sequence, section 14 du cahier des charges) - sinon l'evenement
# serait traite deux fois (une fois ici, une fois via l'appel HTTP du gateway).
# Cet agent se contente de publier "prediction:calculee" une fois son calcul termine.
# ---------------------------------------------------------------------------
