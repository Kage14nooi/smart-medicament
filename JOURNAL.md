# Journal du projet — Depot de Medicaments (SMA)

Ce document raconte, dans l'ordre, tout ce qui a ete fait sur ce projet : ce
qui a ete construit, ce qui a ete reellement teste, les bugs trouves et
corriges, et ce qui a ete ajoute ensuite pour passer en conditions de
deploiement reel. Il complete le `README.md` (qui decrit l'architecture et
comment lancer le projet) en expliquant le *comment on y est arrive*.

---

## 1. Phase 1 — Version academique (cahier des charges PFE)

Objectif : construire de zero l'application "Depot de Medicaments" telle que
decrite dans le cahier des charges du Master 2 Systemes Intelligents — un
systeme multi-agents (SMA) de gestion de stock avec prediction saisonniere de
penurie, pour un depot de medicaments communautaire (pas une pharmacie
commerciale).

### Ce qui a ete construit

- **Base de donnees MySQL** (`db/migrations/001_schema.sql`) : les 13 tables
  exactes du cahier des charges (MEDICAMENT, PROFIL_SAISONNIER,
  COEFFICIENT_SAISONNIER, FOURNISSEUR, MEDICAMENT_FOURNISSEUR, LOT,
  UTILISATEUR, MOUVEMENT, RETRAIT_DESTRUCTION, COMMANDE, PREDICTION, ALERTE),
  avec les ENUM, cles etrangeres et index tels que specifies.
- **Seed de demonstration** (`db/seed/`) : 4 profils saisonniers (STABLE,
  RHUME_SAISON_FRAICHE, PALUDISME_SAISON_PLUIES, DIARRHEE_SAISON_CHAUDE) avec
  12 coefficients mensuels chacun, 8 fournisseurs, 15 medicaments essentiels
  repartis sur les profils et categories VED/ABC, des lots a echeances
  variees, 3 utilisateurs, et ~24 mois d'historique de mouvements (3810
  mouvements) avec une vraie saisonnalite dans les quantites distribuees.
- **3 agents Python/FastAPI**, chacun avec sa propre connexion MySQL :
  - **Agent Monitoring** (port 8001) : verification de stock, module Lots
    (reception, correction, code couleur peremption), module
    Retrait/Destruction (conformite tracee).
  - **Agent Prediction** (port 8002) : calcul du score de risque
    (ROP -> variabilite -> ajustement saisonnier -> ponderation VED), chaque
    composante stockee et exposee separement pour l'ecran Previsions.
  - **Agent Decision** (port 8003) : proposition de commande (fournisseur le
    plus fiable, quantite calculee), creation d'alerte. Porte aussi
    Fournisseurs, Commandes, Utilisateurs.
- **Gateway Node/Express** : point d'entree API unique, orchestrateur du
  pipeline via abonnement Redis + appels HTTP aux agents.
- **Frontend React + Vite** : les 10 ecrans du cahier des charges (Tableau de
  bord, Medicaments, Fournisseurs, Lots & peremption, Retrait/Destruction,
  Commandes, Utilisateurs & roles, Mouvements, Alertes, Previsions), organises
  par module metier.
- **Docker Compose** (dev) : mysql, redis, 3 agents, gateway, frontend.
- **README.md** : architecture, pipeline, formule du score, instructions de
  lancement.

### Validation reelle du pipeline (pas seulement une relecture)

Une fois le scaffold termine, le stack a ete reellement construit et lance
(`docker compose build` puis `up`), le seed execute, et le pipeline SMA
declenche via de vrais appels HTTP (`curl`) plutot que d'etre simplement relu.
Cette validation a mis en evidence **deux bugs reels**, corriges avant de
passer a la phase 2 :

#### Bug 1 — Convention de signe incoherente sur `quantite_mouvement`

Le dictionnaire de donnees du cahier des charges precise que
`quantite_mouvement` est **toujours positive**, le sens (augmente/diminue le
stock) dependant uniquement de `type_mouvement`. Le seed respectait cette
convention, mais :

- la route `POST /api/mouvements` du gateway stockait les mouvements
  `DISTRIBUTION`/`RETRAIT` avec une valeur **negative** ;
- l'endpoint de retrait de l'agent Monitoring faisait de meme.

Consequence concrete observee : `SUM(quantite_mouvement)` (utilise par les 3
agents et par le tableau de bord pour calculer la consommation moyenne
journaliere) melangeait des valeurs positives (historique du seed) et
negatives (nouveaux mouvements), produisant une moyenne **negative** — ce qui
desactivait silencieusement la detection de seuil critique
(`sous_seuil_critique: false` alors que le stock etait objectivement bas).

**Correction** : `gateway/src/routes/mouvements.js` et
`agents/monitoring/main.py` stockent maintenant toujours une quantite
positive ; le sens est applique separement lors de la mise a jour de
`stock_actuel` (delta signe calcule a part, jamais persiste tel quel sauf pour
`AJUSTEMENT` qui reste un delta libre).

#### Bug 2 — Double declenchement des agents Prediction et Decision

Le code initial faisait ecouter Redis **a la fois** par le gateway
(orchestrateur) et par les agents Prediction/Decision eux-memes (chacun avait
un thread d'arriere-plan abonne au canal correspondant). Resultat : un seul
evenement `stock:seuil_critique` declenchait le calcul de score **deux fois**
(une fois via l'auto-declenchement de l'agent, une fois via l'appel HTTP du
gateway), et de meme pour `prediction:calculee` -> creation de commande/alerte.
Un test reel (une distribution faisant passer un medicament sous son seuil)
a produit **4 alertes et 4 commandes identiques** au lieu d'une seule.

**Correction** : les agents Prediction et Decision n'ecoutent plus Redis pour
s'auto-declencher ; ils exposent uniquement leurs endpoints HTTP
(`POST /predire/{id}`, `POST /traiter-prediction`) que le gateway appelle en
reaction aux evenements qu'il observe. Les agents continuent de **publier**
sur Redis a la fin de leur traitement (pour respecter le decouplage decrit
dans le cahier des charges), mais ne s'y abonnent plus. Reteste : un
declenchement produit exactement une alerte et une commande.

Ces deux corrections sont documentees aussi en commentaire dans le code
(`agents/prediction/main.py`, `agents/decision/main.py`,
`gateway/src/routes/mouvements.js`) pour eviter qu'elles soient reintroduites
par erreur plus tard.

---

## 2. Phase 2 — Passage en conditions de production reelle

Objectif : rendre l'application utilisable dans un vrai depot, sans rien
casser du pipeline SMA valide en phase 1. Cinq etapes, chacune testee
reellement (rebuild Docker + curl) avant de passer a la suivante.

### Etape 1 — Authentification JWT

- Le hash de mot de passe SHA-256 (demonstratif, explicitement hors perimetre
  de la version academique) a ete remplace par **bcrypt**, gere uniquement par
  l'agent Decision (seul agent a manipuler la table UTILISATEUR).
- Nouvelle table `REFRESH_TOKEN` (migration `db/migrations/002_auth.sql`) pour
  permettre la revocation reelle des sessions.
- Gateway : `POST /api/auth/login`, `POST /api/auth/refresh` (rotation du
  refresh token + verification de revocation), `POST /api/auth/logout`.
  Access token JWT courte duree (15 min), refresh token en cookie httpOnly
  longue duree (7 jours).
- Frontend : ecran de connexion, contexte d'authentification, deconnexion
  automatique a l'expiration (intercepteur sur les reponses 401 qui tente un
  refresh puis deconnecte si echec).

### Etape 2 — Controle d'acces par role (RBAC)

Middleware `gateway/src/middleware/rbac.js` applique route par route selon la
matrice exacte du cahier des charges (ex. Utilisateurs & roles : acces refuse
au Gerant meme en lecture ; Mouvements : creation reservee au Gerant,
Superviseur en lecture seule). La verification serveur est la seule qui
compte ; le frontend masque en plus les entrees de menu non autorisees pour
l'ergonomie.

Verifie reellement : 403 confirme pour un Gerant sur `/api/utilisateurs`, 403
pour un Superviseur sur `POST /api/mouvements`, 401 sans jeton.

### Etape 3 — Securite de base

- Secrets (mot de passe DB, `JWT_SECRET`, Redis) en variables d'environnement
  via `.env` (non committe) + `.env.example` fourni.
- CORS restreint a l'origine du frontend (`FRONTEND_ORIGIN`), plus de `*`.
- Validation stricte des entrees (`zod` cote gateway sur les routes
  sensibles ; `Pydantic` deja present cote agents).
- Verification qu'aucune valeur utilisateur n'est concatenee directement dans
  une requete SQL (uniquement des requetes preparees).
- Limitation de debit sur `/api/auth/login` (5 tentatives / 15 min par IP) —
  verifie reellement (429 obtenu apres 5 essais rapproches).

### Etape 4 — Fiabilite operationnelle

- Logs structures JSON (gateway et les 3 agents), niveau configurable via
  `LOG_LEVEL`.
- Healthchecks Docker Compose ajoutes pour le gateway, les 3 agents et le
  frontend (en plus de ceux deja presents sur MySQL/Redis).
- Reconnexion automatique du bus Redis (cote gateway et cote agents), testee
  reellement en redemarrant le conteneur Redis pendant que le stack tournait :
  aucun crash, reconnexion automatique, pipeline refonctionnel immediatement
  apres.
- Script de sauvegarde MySQL quotidienne avec rotation (`db/backup/`), branche
  comme service optionnel dans `docker-compose.prod.yml`.

### Etape 5 — Deploiement

- `docker-compose.prod.yml` : build uniquement (pas de bind-mount du code
  source), MySQL et Redis non exposes a l'hote, variables sensibles via
  fichier `.env` charge par `env_file`, politiques de redemarrage renforcees.
- README complete avec une section deploiement (prerequis, variables
  d'environnement, commande de lancement, restauration de sauvegarde).

### Verification finale du stack complet

Apres la phase 2, tous les services (`mysql`, `redis`, `agent-monitoring`,
`agent-prediction`, `agent-decision`, `gateway`, `frontend`) sont `healthy`
sans boucle de redemarrage. Le pipeline SMA a ete reteste de bout en bout avec
authentification reelle :

```
POST /api/auth/login (GERANT)        -> jeton recu
POST /api/mouvements (Bearer <jeton>) -> DISTRIBUTION qui fait passer un
                                          medicament sous son seuil
                                       -> alerte CRITIQUE + commande IA
                                          EN_ATTENTE creees en quelques secondes
GET  /api/utilisateurs (role GERANT)  -> 403 (attendu, reserve au Superviseur)
```

Comptes de demonstration (mot de passe `depot1234` pour tous, apres seed) :

| Role | Email |
|---|---|
| Gerant | `gerant.depot@smart-medicament.example` |
| Superviseur | `superviseur.district@smart-medicament.example` |
| Gerant (compte additionnel) | `tolotra.rakotondravelo@tetika.eu` |

---

## 3. Choix techniques faits en cours de route (non explicitement dictes)

- **Seed en Node.js** (plutot que Python ou SQL statique) pour reutiliser
  `mysql2` et rester dans l'ecosysteme du gateway.
- **Volume d'historique reduit** (~3800 mouvements vs les ~28 500 mentionnes
  a titre indicatif dans le cahier des charges) — suffisant pour demontrer la
  saisonnalite, documente comme un choix assume.
- **Frontend en production** : build Vite statique servi par Nginx (proxy
  `/api` vers le gateway), plutot qu'un serveur Node en plus.
- **Verification du mot de passe centralisee dans l'agent Decision** (le
  gateway l'appelle en HTTP interne) plutot que dupliquer la logique bcrypt
  cote Node, pour garder toute la logique metier Utilisateurs a un seul
  endroit.
- **Refresh token hache en base** (jamais stocke en clair), pour permettre une
  revocation reelle a la deconnexion et une rotation a chaque refresh.
- **Sauvegarde MySQL en service Docker Compose dedie** plutot qu'un cron
  externe au systeme hote, avec l'alternative cron documentee en commentaire
  dans le script pour un environnement qui le prefererait.
- **Healthcheck du frontend corrige en cours de test** : l'image `nginx:alpine`
  resolvait `localhost` en IPv6 sans qu'un listener y reponde, faisant echouer
  le healthcheck malgre un service fonctionnel — corrige en ciblant
  `127.0.0.1` explicitement.

## 4. Limites connues et hors perimetre (assume, pas oublie)

- Pas de calibration des coefficients saisonniers avec de vraies donnees
  epidemiologiques (les coefficients restent illustratifs, comme prevu par le
  cahier des charges).
- Pas de modele XGBoost entraine : le score reste un indicateur statistique
  fait main, mais la fonction de calcul est isolee pour permettre un
  remplacement futur avec repli automatique si l'historique est insuffisant.
- Pas de support multi-depot.
- Pas de suite de tests automatises (unitaires/integration) : la validation
  s'est faite par des tests manuels reels (rebuild Docker + `curl`) a chaque
  etape sensible, ce qui a permis de trouver les deux bugs decrits en
  section 1 plutot que de les laisser passer sur une simple relecture de code.
- Le rate limiting de connexion est en memoire par instance du gateway :
  suffisant pour un seul conteneur (situation actuelle), mais ne serait pas
  partage si le gateway etait execute en plusieurs instances (hors perimetre
  demande).
