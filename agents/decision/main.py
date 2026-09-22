"""
Agent Decision (port 8003)
==========================
Expose l'endpoint HTTP /traiter-prediction que le gateway appelle (en reaction
a l'evenement Redis "prediction:calculee" qu'il ecoute) quand niveau_risque
est ELEVE ou CRITIQUE :
  1. choisit le fournisseur le plus fiable pour ce medicament
     (fiabilite_score le plus haut parmi MEDICAMENT_FOURNISSEUR) ;
  2. calcule une quantite proposee = consommation_moyenne_journaliere * horizon_jours
     - stock_actuel, arrondie, minimum 1 ;
  3. cree une COMMANDE (source_commande=IA, statut_commande=EN_ATTENTE) ;
  4. cree une ALERTE (statut_alerte=OUVERTE).

IMPORTANT : le SMA PROPOSE, il ne decide jamais seul. La commande creee reste
EN_ATTENTE et doit etre ajustee/validee/annulee par un humain (le gerant) via
l'ecran Commandes du frontend - l'ajustement EST la validation.

Cet agent porte aussi la logique metier des modules Fournisseurs, Commandes
et Utilisateurs (CRUD), et possede sa PROPRE connexion MySQL. Il n'appelle
jamais directement les autres agents (uniquement Redis pub, jamais d'appel
HTTP agent->agent).
"""
import os
from datetime import date, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import get_connection
from redis_bus import publier, CANAL_COMMANDE_CREEE
from logging_config import get_logger

logger = get_logger("agent-decision")

app = FastAPI(title="Agent Decision", version="1.0.0")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

HORIZON_JOURS_DEFAUT = 14


# ---------------------------------------------------------------------------
# Coeur de la decision : choix fournisseur + quantite + creation commande/alerte
# ---------------------------------------------------------------------------

def calculer_conso_moyenne(cur, id_medicament: int) -> float:
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
    if not quantites:
        return 0.0
    return sum(quantites) / len(quantites)


def traiter_prediction(id_medicament: int, id_prediction: int, niveau_risque: str) -> Optional[dict]:
    if niveau_risque not in ("ELEVE", "CRITIQUE"):
        return None  # le SMA ne propose une commande que pour risque eleve/critique

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id_medicament, nom_medicament, stock_actuel FROM MEDICAMENT WHERE id_medicament = %s",
                (id_medicament,),
            )
            med = cur.fetchone()
            if not med:
                return None

            # 1. Fournisseur le plus fiable pour ce medicament
            cur.execute(
                """
                SELECT mf.id_fournisseur, mf.delai_livraison_moyen_jours, f.nom_fournisseur, f.fiabilite_score
                FROM MEDICAMENT_FOURNISSEUR mf
                JOIN FOURNISSEUR f ON f.id_fournisseur = mf.id_fournisseur
                WHERE mf.id_medicament = %s AND f.actif = TRUE
                ORDER BY f.fiabilite_score DESC
                LIMIT 1
                """,
                (id_medicament,),
            )
            fournisseur = cur.fetchone()

            # 2. Quantite proposee
            conso_moyenne = calculer_conso_moyenne(cur, id_medicament)
            quantite_proposee = max(1, round(conso_moyenne * HORIZON_JOURS_DEFAUT - med["stock_actuel"]))

            delai_prevu = fournisseur["delai_livraison_moyen_jours"] if fournisseur else 7
            date_livraison_prevue = date.today() + timedelta(days=delai_prevu)

            # 3. Creation de la commande (proposition IA - jamais decidee seule,
            #    reste EN_ATTENTE jusqu'a intervention humaine)
            cur.execute(
                """
                INSERT INTO COMMANDE
                    (id_medicament, id_fournisseur, quantite_commandee, date_livraison_prevue,
                     statut_commande, source_commande)
                VALUES (%s, %s, %s, %s, 'EN_ATTENTE', 'IA')
                """,
                (
                    id_medicament,
                    fournisseur["id_fournisseur"] if fournisseur else None,
                    quantite_proposee,
                    date_livraison_prevue,
                ),
            )
            id_commande = cur.lastrowid

            # 4. Creation de l'alerte associee
            cur.execute(
                """
                INSERT INTO ALERTE (id_medicament, id_prediction, niveau_risque, statut_alerte)
                VALUES (%s, %s, %s, 'OUVERTE')
                """,
                (id_medicament, id_prediction, niveau_risque),
            )
            id_alerte = cur.lastrowid

            resultat = {
                "id_commande": id_commande,
                "id_alerte": id_alerte,
                "id_medicament": id_medicament,
                "nom_medicament": med["nom_medicament"],
                "quantite_proposee": quantite_proposee,
                "id_fournisseur_choisi": fournisseur["id_fournisseur"] if fournisseur else None,
                "nom_fournisseur_choisi": fournisseur["nom_fournisseur"] if fournisseur else None,
                "niveau_risque": niveau_risque,
                "message": "Commande proposee par le SMA (statut EN_ATTENTE) - validation humaine requise",
            }

            logger.info(
                f"commande IA creee pour medicament {id_medicament} : "
                f"commande={id_commande} alerte={id_alerte} niveau_risque={niveau_risque}"
            )
            publier(CANAL_COMMANDE_CREEE, {
                "id_commande": id_commande,
                "id_alerte": id_alerte,
                "id_medicament": id_medicament,
            })

            return resultat
    finally:
        conn.close()


class TraiterPredictionPayload(BaseModel):
    id_medicament: int
    id_prediction: int
    niveau_risque: str


@app.post("/traiter-prediction")
def endpoint_traiter_prediction(payload: TraiterPredictionPayload):
    resultat = traiter_prediction(payload.id_medicament, payload.id_prediction, payload.niveau_risque)
    if resultat is None:
        return {"message": "Niveau de risque insuffisant pour generer une commande automatique", "commande_creee": False}
    return {**resultat, "commande_creee": True}


# ---------------------------------------------------------------------------
# Module FOURNISSEURS
# ---------------------------------------------------------------------------

class FournisseurPayload(BaseModel):
    nom_fournisseur: str = Field(min_length=2, max_length=150)
    fiabilite_score: float = Field(ge=0, le=1)
    contact: Optional[str] = None


@app.get("/fournisseurs")
def lister_fournisseurs():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM FOURNISSEUR ORDER BY fiabilite_score DESC")
            return cur.fetchall()
    finally:
        conn.close()


@app.post("/fournisseurs")
def creer_fournisseur(payload: FournisseurPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO FOURNISSEUR (nom_fournisseur, fiabilite_score, contact, actif) VALUES (%s, %s, %s, TRUE)",
                (payload.nom_fournisseur, payload.fiabilite_score, payload.contact),
            )
            return {"id_fournisseur": cur.lastrowid, "message": "Fournisseur cree avec succes"}
    finally:
        conn.close()


@app.put("/fournisseurs/{id_fournisseur}")
def modifier_fournisseur(id_fournisseur: int, payload: FournisseurPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_fournisseur FROM FOURNISSEUR WHERE id_fournisseur = %s", (id_fournisseur,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Fournisseur introuvable")
            cur.execute(
                "UPDATE FOURNISSEUR SET nom_fournisseur=%s, fiabilite_score=%s, contact=%s WHERE id_fournisseur=%s",
                (payload.nom_fournisseur, payload.fiabilite_score, payload.contact, id_fournisseur),
            )
            return {"message": "Fournisseur mis a jour avec succes"}
    finally:
        conn.close()


@app.put("/fournisseurs/{id_fournisseur}/archiver")
def archiver_fournisseur(id_fournisseur: int):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE FOURNISSEUR SET actif = FALSE WHERE id_fournisseur = %s", (id_fournisseur,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Fournisseur introuvable")
            return {"message": "Fournisseur archive avec succes"}
    finally:
        conn.close()


class ConditionMedicamentFournisseurPayload(BaseModel):
    id_medicament: int
    delai_livraison_moyen_jours: int = Field(gt=0)
    delai_livraison_max_jours: int = Field(gt=0)
    prix_achat: float = Field(ge=0)


@app.get("/fournisseurs/{id_fournisseur}/conditions")
def lister_conditions(id_fournisseur: int):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT mf.*, m.nom_medicament
                FROM MEDICAMENT_FOURNISSEUR mf
                JOIN MEDICAMENT m ON m.id_medicament = mf.id_medicament
                WHERE mf.id_fournisseur = %s
                """,
                (id_fournisseur,),
            )
            return cur.fetchall()
    finally:
        conn.close()


@app.post("/fournisseurs/{id_fournisseur}/conditions")
def upsert_condition(id_fournisseur: int, payload: ConditionMedicamentFournisseurPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO MEDICAMENT_FOURNISSEUR
                    (id_medicament, id_fournisseur, delai_livraison_moyen_jours, delai_livraison_max_jours, prix_achat)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    delai_livraison_moyen_jours = VALUES(delai_livraison_moyen_jours),
                    delai_livraison_max_jours = VALUES(delai_livraison_max_jours),
                    prix_achat = VALUES(prix_achat)
                """,
                (payload.id_medicament, id_fournisseur, payload.delai_livraison_moyen_jours,
                 payload.delai_livraison_max_jours, payload.prix_achat),
            )
            return {"message": "Condition medicament-fournisseur enregistree avec succes"}
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Module COMMANDES
# ---------------------------------------------------------------------------

class CommandePayload(BaseModel):
    id_medicament: int
    id_fournisseur: Optional[int] = None
    quantite_commandee: int = Field(gt=0)
    date_livraison_prevue: Optional[date] = None


@app.get("/commandes")
def lister_commandes(statut: Optional[str] = None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            base_query = """
                SELECT c.*, m.nom_medicament, f.nom_fournisseur
                FROM COMMANDE c
                JOIN MEDICAMENT m ON m.id_medicament = c.id_medicament
                LEFT JOIN FOURNISSEUR f ON f.id_fournisseur = c.id_fournisseur
            """
            if statut:
                cur.execute(base_query + " WHERE c.statut_commande = %s ORDER BY c.date_commande DESC", (statut,))
            else:
                cur.execute(base_query + " ORDER BY c.date_commande DESC")
            return cur.fetchall()
    finally:
        conn.close()


@app.post("/commandes")
def creer_commande_manuelle(payload: CommandePayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_medicament FROM MEDICAMENT WHERE id_medicament = %s", (payload.id_medicament,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Medicament introuvable")

            cur.execute(
                """
                INSERT INTO COMMANDE
                    (id_medicament, id_fournisseur, quantite_commandee, date_livraison_prevue,
                     statut_commande, source_commande)
                VALUES (%s, %s, %s, %s, 'EN_ATTENTE', 'MANUELLE')
                """,
                (payload.id_medicament, payload.id_fournisseur, payload.quantite_commandee,
                 payload.date_livraison_prevue),
            )
            return {"id_commande": cur.lastrowid, "message": "Commande manuelle creee avec succes"}
    finally:
        conn.close()


class AjustementCommandePayload(BaseModel):
    quantite_commandee: Optional[int] = Field(default=None, gt=0)
    statut_commande: Optional[str] = Field(
        default=None, pattern="^(EN_ATTENTE|LIVREE|EN_RETARD|ANNULEE)$"
    )
    id_fournisseur: Optional[int] = None
    date_livraison_prevue: Optional[date] = None
    date_livraison_reelle: Optional[date] = None


@app.put("/commandes/{id_commande}")
def ajuster_commande(id_commande: int, payload: AjustementCommandePayload):
    """L'ajustement d'une commande (quantite, statut, fournisseur...) EST la
    validation humaine - il n'y a pas de bouton 'valider' separe. Si le statut
    passe a LIVREE, cree automatiquement un mouvement ENTREE et augmente le stock."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM COMMANDE WHERE id_commande = %s", (id_commande,))
            commande = cur.fetchone()
            if not commande:
                raise HTTPException(status_code=404, detail="Commande introuvable")

            champs = []
            valeurs = []
            if payload.quantite_commandee is not None:
                champs.append("quantite_commandee = %s")
                valeurs.append(payload.quantite_commandee)
            if payload.id_fournisseur is not None:
                champs.append("id_fournisseur = %s")
                valeurs.append(payload.id_fournisseur)
            if payload.date_livraison_prevue is not None:
                champs.append("date_livraison_prevue = %s")
                valeurs.append(payload.date_livraison_prevue)
            if payload.date_livraison_reelle is not None:
                champs.append("date_livraison_reelle = %s")
                valeurs.append(payload.date_livraison_reelle)
            if payload.statut_commande is not None:
                champs.append("statut_commande = %s")
                valeurs.append(payload.statut_commande)

            if champs:
                valeurs.append(id_commande)
                cur.execute(f"UPDATE COMMANDE SET {', '.join(champs)} WHERE id_commande = %s", valeurs)

            mouvement_cree = False
            # Regle metier : passage a LIVREE => mouvement ENTREE + augmentation du stock
            if payload.statut_commande == "LIVREE" and commande["statut_commande"] != "LIVREE":
                quantite_livree = payload.quantite_commandee or commande["quantite_commandee"]
                cur.execute(
                    """
                    INSERT INTO MOUVEMENT (id_medicament, id_lot, type_mouvement, quantite_mouvement, source_mouvement)
                    VALUES (%s, NULL, 'ENTREE', %s, 'COMMANDE_LIVREE')
                    """,
                    (commande["id_medicament"], quantite_livree),
                )
                cur.execute(
                    "UPDATE MEDICAMENT SET stock_actuel = stock_actuel + %s WHERE id_medicament = %s",
                    (quantite_livree, commande["id_medicament"]),
                )
                if not payload.date_livraison_reelle:
                    cur.execute(
                        "UPDATE COMMANDE SET date_livraison_reelle = CURDATE() WHERE id_commande = %s",
                        (id_commande,),
                    )
                mouvement_cree = True

            return {
                "message": "Commande mise a jour avec succes (ajustement = validation humaine)",
                "mouvement_entree_cree": mouvement_cree,
            }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Module UTILISATEURS
# ---------------------------------------------------------------------------

from passlib.context import CryptContext

# bcrypt (remplace le sha256 demonstratif initial) : hachage sale + facteur de
# cout, resistant au bruteforce hors-ligne. Le agent Decision est seul a
# manipuler des mots de passe en clair (creation/reset), conformement a la
# regle "le SMA porte la logique des modules Utilisateurs".
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(pwd: str) -> str:
    return _pwd_context.hash(pwd)


def verify_password(pwd: str, pwd_hash: str) -> bool:
    try:
        return _pwd_context.verify(pwd, pwd_hash)
    except Exception:
        return False


class UtilisateurPayload(BaseModel):
    nom_utilisateur: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=150)
    role: str = Field(pattern="^(GERANT|SUPERVISEUR)$")
    mot_de_passe: Optional[str] = Field(default="depot1234", min_length=4)


@app.get("/utilisateurs")
def lister_utilisateurs():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id_utilisateur, nom_utilisateur, email, role, actif FROM UTILISATEUR ORDER BY nom_utilisateur"
            )
            return cur.fetchall()
    finally:
        conn.close()


@app.post("/utilisateurs")
def creer_utilisateur(payload: UtilisateurPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO UTILISATEUR (nom_utilisateur, email, mot_de_passe_hash, role, actif)
                VALUES (%s, %s, %s, %s, TRUE)
                """,
                (payload.nom_utilisateur, payload.email, hash_password(payload.mot_de_passe), payload.role),
            )
            return {"id_utilisateur": cur.lastrowid, "message": "Utilisateur cree avec succes"}
    finally:
        conn.close()


@app.put("/utilisateurs/{id_utilisateur}")
def modifier_utilisateur(id_utilisateur: int, payload: UtilisateurPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id_utilisateur FROM UTILISATEUR WHERE id_utilisateur = %s", (id_utilisateur,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")
            cur.execute(
                "UPDATE UTILISATEUR SET nom_utilisateur=%s, email=%s, role=%s WHERE id_utilisateur=%s",
                (payload.nom_utilisateur, payload.email, payload.role, id_utilisateur),
            )
            return {"message": "Utilisateur mis a jour avec succes"}
    finally:
        conn.close()


@app.put("/utilisateurs/{id_utilisateur}/archiver")
def archiver_utilisateur(id_utilisateur: int):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE UTILISATEUR SET actif = FALSE WHERE id_utilisateur = %s", (id_utilisateur,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")
            return {"message": "Utilisateur archive avec succes"}
    finally:
        conn.close()


@app.put("/utilisateurs/{id_utilisateur}/reactiver")
def reactiver_utilisateur(id_utilisateur: int):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE UTILISATEUR SET actif = TRUE WHERE id_utilisateur = %s", (id_utilisateur,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")
            return {"message": "Utilisateur reactive avec succes"}
    finally:
        conn.close()


class VerifierMotDePassePayload(BaseModel):
    email: str = Field(min_length=5, max_length=150)
    mot_de_passe: str = Field(min_length=1)


@app.post("/utilisateurs/verifier-mot-de-passe")
def verifier_mot_de_passe(payload: VerifierMotDePassePayload):
    """Utilise par le gateway lors du login (POST /api/auth/login) : le hachage
    bcrypt et sa verification restent circonscrits a cet agent, qui est seul
    proprietaire de la logique metier Utilisateurs. Le gateway ne voit jamais
    le hash ni la logique de verification."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id_utilisateur, nom_utilisateur, email, mot_de_passe_hash, role, actif "
                "FROM UTILISATEUR WHERE email = %s",
                (payload.email,),
            )
            utilisateur = cur.fetchone()
            if not utilisateur or not utilisateur["actif"]:
                return {"valide": False}
            if not verify_password(payload.mot_de_passe, utilisateur["mot_de_passe_hash"]):
                return {"valide": False}
            return {
                "valide": True,
                "id_utilisateur": utilisateur["id_utilisateur"],
                "nom_utilisateur": utilisateur["nom_utilisateur"],
                "email": utilisateur["email"],
                "role": utilisateur["role"],
            }
    finally:
        conn.close()


class ResetPasswordPayload(BaseModel):
    nouveau_mot_de_passe: str = Field(min_length=4)


@app.put("/utilisateurs/{id_utilisateur}/reset-mot-de-passe")
def reset_mot_de_passe(id_utilisateur: int, payload: ResetPasswordPayload):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE UTILISATEUR SET mot_de_passe_hash = %s WHERE id_utilisateur = %s",
                (hash_password(payload.nouveau_mot_de_passe), id_utilisateur),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Utilisateur introuvable")
            return {"message": "Mot de passe reinitialise avec succes"}
    finally:
        conn.close()


@app.get("/health")
def health():
    return {"status": "ok", "agent": "decision"}


@app.on_event("startup")
def on_startup():
    logger.info("agent decision demarre")


# ---------------------------------------------------------------------------
# Note d'architecture : cet agent NE s'auto-declenche PAS sur "prediction:calculee".
# Seul le gateway (coordinateur) ecoute ce canal et appelle l'endpoint HTTP de
# traitement en consequence (cf. diagramme de sequence, section 14 du cahier des
# charges) - sinon l'evenement serait traite deux fois. Cet agent se contente de
# publier "decision:proposition_generee" une fois la commande/alerte creees.
# ---------------------------------------------------------------------------
