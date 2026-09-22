"""
Agent Monitoring (port 8001)
============================
Responsabilites :
  - Verification continue du stock (appelee par le gateway apres tout mouvement) :
    compare stock_actuel / consommation_moyenne_journaliere (jours de stock restant)
    au seuil stock_securite_jours du medicament ; si sous le seuil, publie
    l'evenement Redis "stock:seuil_critique".
  - Logique metier du module Lots : reception (creation), liste, correction,
    calcul de l'urgence de peremption (code couleur).
  - Logique metier du module Retrait/Destruction : creation d'un retrait de
    conformite (motif, justification, utilisateur responsable) qui genere
    TOUJOURS un mouvement RETRAIT lie et decremente le stock.

Cet agent possede sa PROPRE connexion MySQL et n'appelle jamais directement
les autres agents (uniquement Redis pub, et il est appele en HTTP par le gateway).
"""
import os
from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import get_connection
from redis_bus import publier, CANAL_SEUIL_CRITIQUE
from logging_config import get_logger

logger = get_logger("agent-monitoring")

app = FastAPI(title="Agent Monitoring", version="1.0.0")

# Origine autorisee configurable (jamais "*" en production) : le seul appelant
# legitime en navigateur est le frontend, tout le reste passe par le gateway
# en cote-serveur (pas de CORS applicable dans ce cas).
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Utilitaires metier
# ---------------------------------------------------------------------------

def calculer_conso_moyenne_ecart_type(cur, id_medicament: int):
    """Calcule la consommation moyenne journaliere et l'ecart-type a partir des
    mouvements DISTRIBUTION des 30 derniers jours pour ce medicament."""
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
        return 0.0, 0.0
    moyenne = sum(quantites) / n
    if n > 1:
        variance = sum((q - moyenne) ** 2 for q in quantites) / n
        ecart_type = variance ** 0.5
    else:
        ecart_type = 0.0
    return moyenne, ecart_type


def urgence_peremption(date_peremption: date) -> str:
    """Code couleur d'urgence : rouge <30j, orange <90j, vert sinon."""
    jours_restants = (date_peremption - date.today()).days
    if jours_restants < 30:
        return "ROUGE"
    if jours_restants < 90:
        return "ORANGE"
    return "VERT"


# ---------------------------------------------------------------------------
# Endpoint principal : verification de stock (appele par le gateway)
# ---------------------------------------------------------------------------

class VerifierStockPayload(BaseModel):
    id_medicament: int


@app.post("/verifier-stock")
def verifier_stock(payload: VerifierStockPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id_medicament, nom_medicament, stock_actuel, stock_securite_jours "
                "FROM MEDICAMENT WHERE id_medicament = %s",
                (payload.id_medicament,),
            )
            med = cur.fetchone()
            if not med:
                raise HTTPException(status_code=404, detail="Medicament introuvable")

            moyenne, ecart_type = calculer_conso_moyenne_ecart_type(cur, med["id_medicament"])

            if moyenne <= 0:
                jours_de_stock = None
                sous_seuil = False
            else:
                jours_de_stock = med["stock_actuel"] / moyenne
                sous_seuil = jours_de_stock < float(med["stock_securite_jours"])

            resultat = {
                "id_medicament": med["id_medicament"],
                "nom_medicament": med["nom_medicament"],
                "stock_actuel": med["stock_actuel"],
                "stock_securite_jours": float(med["stock_securite_jours"]),
                "consommation_moyenne_journaliere": round(moyenne, 3),
                "ecart_type_consommation": round(ecart_type, 3),
                "jours_de_stock_restant": round(jours_de_stock, 2) if jours_de_stock is not None else None,
                "sous_seuil_critique": sous_seuil,
            }

            if sous_seuil:
                logger.info(f"seuil critique atteint pour medicament {med['id_medicament']} ({med['nom_medicament']})")
                publier(CANAL_SEUIL_CRITIQUE, {
                    "id_medicament": med["id_medicament"],
                    "nom_medicament": med["nom_medicament"],
                })
                resultat["evenement_publie"] = CANAL_SEUIL_CRITIQUE

            return resultat
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Module LOTS
# ---------------------------------------------------------------------------

class ReceptionLotPayload(BaseModel):
    id_medicament: int
    id_fournisseur: Optional[int] = None
    numero_lot: str = Field(min_length=1, max_length=60)
    date_peremption: date
    quantite_lot: int = Field(gt=0)


@app.get("/lots")
def lister_lots(id_medicament: Optional[int] = None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            if id_medicament:
                cur.execute(
                    """
                    SELECT l.*, m.nom_medicament, f.nom_fournisseur
                    FROM LOT l
                    JOIN MEDICAMENT m ON m.id_medicament = l.id_medicament
                    LEFT JOIN FOURNISSEUR f ON f.id_fournisseur = l.id_fournisseur
                    WHERE l.id_medicament = %s
                    ORDER BY l.date_peremption ASC
                    """,
                    (id_medicament,),
                )
            else:
                cur.execute(
                    """
                    SELECT l.*, m.nom_medicament, f.nom_fournisseur
                    FROM LOT l
                    JOIN MEDICAMENT m ON m.id_medicament = l.id_medicament
                    LEFT JOIN FOURNISSEUR f ON f.id_fournisseur = l.id_fournisseur
                    ORDER BY l.date_peremption ASC
                    """
                )
            lots = cur.fetchall()
            for lot in lots:
                lot["urgence_peremption"] = urgence_peremption(lot["date_peremption"])
            return lots
    finally:
        conn.close()


@app.post("/lots/reception")
def receptionner_lot(payload: ReceptionLotPayload):
    """Reception d'un nouveau lot : cree le LOT, un MOUVEMENT ENTREE lie, et
    augmente stock_actuel du medicament."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_medicament FROM MEDICAMENT WHERE id_medicament = %s", (payload.id_medicament,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Medicament introuvable")

            cur.execute(
                """
                INSERT INTO LOT (id_medicament, id_fournisseur, numero_lot, date_peremption, quantite_lot)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (payload.id_medicament, payload.id_fournisseur, payload.numero_lot,
                 payload.date_peremption, payload.quantite_lot),
            )
            id_lot = cur.lastrowid

            cur.execute(
                """
                INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement)
                VALUES (%s, %s, 'ENTREE', %s, 'RECEPTION_LOT')
                """,
                (payload.id_medicament, id_lot, payload.quantite_lot),
            )
            id_mouvement = cur.lastrowid

            cur.execute(
                "UPDATE MEDICAMENT SET stock_actuel = stock_actuel + %s WHERE id_medicament = %s",
                (payload.quantite_lot, payload.id_medicament),
            )

            return {"id_lot": id_lot, "id_mouvement": id_mouvement, "message": "Lot receptionne avec succes"}
    finally:
        conn.close()


class CorrectionLotPayload(BaseModel):
    quantite_lot: int = Field(ge=0)
    date_peremption: Optional[date] = None
    numero_lot: Optional[str] = None


@app.put("/lots/{id_lot}")
def corriger_lot(id_lot: int, payload: CorrectionLotPayload):
    """Correction d'un lot existant (ex : erreur de saisie sur la quantite ou la date).
    Ajuste stock_actuel du medicament par la difference et trace un mouvement AJUSTEMENT."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM LOT WHERE id_lot = %s", (id_lot,))
            lot = cur.fetchone()
            if not lot:
                raise HTTPException(status_code=404, detail="Lot introuvable")

            delta = payload.quantite_lot - lot["quantite_lot"]

            champs = ["quantite_lot = %s"]
            valeurs = [payload.quantite_lot]
            if payload.date_peremption:
                champs.append("date_peremption = %s")
                valeurs.append(payload.date_peremption)
            if payload.numero_lot:
                champs.append("numero_lot = %s")
                valeurs.append(payload.numero_lot)
            valeurs.append(id_lot)

            cur.execute(f"UPDATE LOT SET {', '.join(champs)} WHERE id_lot = %s", valeurs)

            if delta != 0:
                cur.execute(
                    """
                    INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement)
                    VALUES (%s, %s, 'AJUSTEMENT', %s, 'CORRECTION_LOT')
                    """,
                    (lot["id_medicament"], id_lot, delta),
                )
                cur.execute(
                    "UPDATE MEDICAMENT SET stock_actuel = stock_actuel + %s WHERE id_medicament = %s",
                    (delta, lot["id_medicament"]),
                )

            return {"message": "Lot corrige avec succes", "delta_stock": delta}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Module RETRAIT / DESTRUCTION
# ---------------------------------------------------------------------------

class RetraitPayload(BaseModel):
    id_lot: int
    id_utilisateur: int
    motif: str = Field(pattern="^(PEREME|NON_UTILISE|NON_CONFORME)$")
    quantite_retiree: int = Field(gt=0)
    justification: str = Field(min_length=3, max_length=255)


@app.get("/retraits")
def lister_retraits():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.*, l.numero_lot, m.nom_medicament, u.nom_utilisateur
                FROM RETRAIT_DESTRUCTION r
                JOIN LOT l ON l.id_lot = r.id_lot
                JOIN MEDICAMENT m ON m.id_medicament = l.id_medicament
                JOIN UTILISATEUR u ON u.id_utilisateur = r.id_utilisateur
                ORDER BY r.date_retrait DESC
                """
            )
            return cur.fetchall()
    finally:
        conn.close()


@app.post("/retraits")
def creer_retrait(payload: RetraitPayload):
    """Cree un retrait/destruction de conformite : verifie le lot, cree le
    MOUVEMENT RETRAIT lie, decremente stock_actuel, puis trace le retrait
    (motif, justification, utilisateur responsable) - jamais une simple
    correction de stock."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM LOT WHERE id_lot = %s", (payload.id_lot,))
            lot = cur.fetchone()
            if not lot:
                raise HTTPException(status_code=404, detail="Lot introuvable")
            if payload.quantite_retiree > lot["quantite_lot"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Quantite a retirer ({payload.quantite_retiree}) superieure a la quantite du lot ({lot['quantite_lot']})",
                )

            cur.execute("SELECT id_utilisateur FROM UTILISATEUR WHERE id_utilisateur = %s", (payload.id_utilisateur,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")

            cur.execute(
                """
                INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement)
                VALUES (%s, %s, 'RETRAIT', %s, 'RETRAIT_DESTRUCTION')
                """,
                (lot["id_medicament"], lot["id_lot"], abs(payload.quantite_retiree)),
            )
            id_mouvement = cur.lastrowid

            cur.execute(
                "UPDATE MEDICAMENT SET stock_actuel = GREATEST(0, stock_actuel - %s) WHERE id_medicament = %s",
                (payload.quantite_retiree, lot["id_medicament"]),
            )

            cur.execute(
                "UPDATE LOT SET quantite_lot = GREATEST(0, quantite_lot - %s) WHERE id_lot = %s",
                (payload.quantite_retiree, lot["id_lot"]),
            )

            cur.execute(
                """
                INSERT INTO RETRAIT_DESTRUCTION
                    (id_lot, id_utilisateur, id_mouvement, motif, quantite_retiree, justification)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (payload.id_lot, payload.id_utilisateur, id_mouvement, payload.motif,
                 payload.quantite_retiree, payload.justification),
            )
            id_retrait = cur.lastrowid

            return {
                "id_retrait": id_retrait,
                "id_mouvement": id_mouvement,
                "id_medicament": lot["id_medicament"],
                "message": "Retrait/destruction enregistre avec succes",
            }
    finally:
        conn.close()


@app.get("/health")
def health():
    return {"status": "ok", "agent": "monitoring"}


@app.on_event("startup")
def on_startup():
    logger.info("agent monitoring demarre")
