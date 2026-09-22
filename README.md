# Depot de Medicaments - Systeme Multi-Agents (SMA)

Projet de fin d'etudes (Master 2 Systemes Intelligents) : application de gestion
de stock pour un **depot de medicaments communautaire**, avec prediction
saisonniere de penurie assuree par un systeme multi-agents (SMA).

Vocabulaire metier respecte dans tout le code : un **gerant** gere le depot,
supervise par un **superviseur de district** ; on **distribue** des medicaments
(pas de vente) ; un medicament est **archive**, jamais supprime ; un retrait de
stock est un **processus de conformite trace** (motif, justification,
utilisateur responsable). Le SMA **propose** toujours, il ne decide jamais seul
: la validation finale (ajustement/annulation d'une commande) reste humaine.

---

## 1. Architecture

```
frontend (React + Vite)  --->  gateway (Node/Express)  <--->  Redis (pub/sub)
                                     |                              ^  ^  ^
                                     | REST (CRUD direct medicaments|  |  |
                                     | mouvements, dashboard, alertes) |  |
                                     v                                |  |
                          MySQL <--- agent-monitoring (FastAPI, 8001) -+  |
                          MySQL <--- agent-prediction (FastAPI, 8002) ----+
                          MySQL <--- agent-decision   (FastAPI, 8003) ----+
```

- **Gateway (Node/Express)** : point d'entree API unique. Expose les routes
  REST CRUD (medicaments, mouvements, dashboard, alertes en acces direct base ;
  lots/retraits/fournisseurs/commandes/utilisateurs en proxy vers les agents
  qui portent leur logique metier). Ecoute Redis et orchestre le pipeline.
- **Agent Monitoring (8001)** : surveille les stocks, publie
  `stock:seuil_critique`. Porte la logique des modules **Lots** et
  **Retrait/Destruction**.
- **Agent Prediction (8002)** : expose `POST /predire/{id}`, appele par le
  gateway en reaction a l'evenement Redis `stock:seuil_critique` qu'il ecoute.
  Calcule le score de risque, insere une `PREDICTION`, publie
  `prediction:calculee`.
- **Agent Decision (8003)** : expose `POST /traiter-prediction`, appele par le
  gateway quand `niveau_risque` est `ELEVE` ou `CRITIQUE`. Choisit le
  fournisseur le plus fiable, calcule une quantite proposee, cree une
  `COMMANDE` (statut `EN_ATTENTE`, source `IA`) et une `ALERTE` (`OUVERTE`).
  Porte aussi la logique des modules **Fournisseurs**, **Commandes**,
  **Utilisateurs**.

**Regle stricte** : les agents ne s'appellent JAMAIS directement entre eux, ni
en HTTP ni en Redis. Seul le **gateway** ecoute le bus Redis et decide de
declencher l'etape suivante via un appel HTTP a l'agent concerne ; chaque
agent se contente de publier son resultat sur Redis a la fin de son
traitement, sans s'y abonner lui-meme. Ce choix evite qu'un evenement soit
traite deux fois (une fois par l'agent qui s'auto-declencherait, une fois par
l'appel HTTP du gateway) — c'est un bug reel qui a ete trouve et corrige
pendant la validation de ce projet (voir `JOURNAL.md`). Chaque agent possede
sa propre connexion MySQL independante.

### Pipeline SMA (bout en bout)

1. Un mouvement est enregistre via `POST /api/mouvements` (gateway) : le
   gateway ecrit le mouvement, recalcule `stock_actuel`, puis appelle l'agent
   Monitoring (`POST /verifier-stock`).
2. L'agent Monitoring compare les jours de stock restant
   (`stock_actuel / consommation_moyenne_journaliere`) au seuil
   `stock_securite_jours`. Si en dessous, il publie `stock:seuil_critique` sur
   Redis.
3. Le gateway (abonne a Redis) recoit l'evenement et appelle l'agent
   Prediction (`POST /predire/{id}`). *(L'agent Prediction ecoute aussi
   directement ce canal Redis en parallele, pour illustrer une communication
   inter-agents purement event-driven.)*
4. L'agent Prediction calcule le score de risque (formule ci-dessous), insere
   une ligne `PREDICTION`, publie `prediction:calculee`.
5. Le gateway recoit l'evenement ; si `niveau_risque` est `ELEVE` ou
   `CRITIQUE`, il appelle l'agent Decision (`POST /traiter-prediction`).
   *(L'agent Decision ecoute aussi directement ce canal Redis.)*
6. L'agent Decision cree la `COMMANDE` (source `IA`, statut `EN_ATTENTE`) et
   l'`ALERTE` (`OUVERTE`).
7. Le frontend fait du polling toutes les 5 secondes sur `GET /api/alertes`
   (Tableau de bord + ecran Alertes) pour un affichage quasi temps reel.
8. Le gerant **ajuste** la commande proposee (quantite/statut/fournisseur)
   depuis l'ecran Commandes : cet ajustement **est** la validation, il n'y a
   pas de bouton "valider" separe. Passer le statut a `LIVREE` cree
   automatiquement un mouvement `ENTREE` et augmente `stock_actuel` (regle
   implementee dans l'agent Decision, `PUT /commandes/{id}`).

### Formule du score de risque (agent Prediction)

```
marge_jours     = (stock_actuel / consommation_moyenne_journaliere) - stock_securite_jours
score_rop       = clamp(0,1, (horizon - marge_jours) / horizon)      # horizon = 14 jours par defaut
variabilite     = ecart_type_consommation / consommation_moyenne
score_ml        = score_rop * 0.7 + variabilite * 0.3
score_ml_ajuste = min(1, score_ml * facteur_saisonnier[mois_courant])
poids_ved       = {V: 1.3, E: 1.1, D: 0.9}
score_final     = min(1, score_ml_ajuste * poids_ved[categorie_ved])
```

`consommation_moyenne_journaliere` et `ecart_type_consommation` sont calcules
a partir des mouvements `DISTRIBUTION` des 30 derniers jours. Seuils de
`niveau_risque` (configurables via variables d'environnement de l'agent
Prediction : `SEUIL_FAIBLE`, `SEUIL_MOYEN`, `SEUIL_ELEVE`) :
`<0.4` FAIBLE, `<0.6` MOYEN, `<0.85` ELEVE, sinon CRITIQUE.

Chaque composante (`score_rop`, `score_ml`, `facteur_saisonnier`,
`score_final`, poids VED) est stockee en base (table `PREDICTION`) et
retournee par l'API, affichable separement dans l'ecran **Previsions**.

**Point d'extension ML** : la fonction `calculer_score_ml(...)` dans
`agents/prediction/scoring.py` est isolee pour qu'un futur modele XGBoost
puisse la remplacer (l'emplacement est commente dans le code). Ce n'est PAS
implemente dans cette version : seul le calcul heuristique actuel est utilise,
avec repli automatique si l'historique de consommation est insuffisant.

---

## 2. Lancer avec Docker Compose (recommande pour la demo)

Pre-requis : Docker Desktop.

```bash
cd "smart-medicament"
docker compose up --build
```

Cela demarre : `mysql` (avec les schemas `db/migrations/001_schema.sql` puis
`002_auth.sql` appliques automatiquement au premier demarrage via
`/docker-entrypoint-initdb.d`, dans l'ordre alphabetique), `redis`,
`agent-monitoring` (8001), `agent-prediction` (8002), `agent-decision` (8003),
`gateway` (4000), `frontend` (5173, servi par nginx qui proxy `/api` vers le
gateway).

**Si vous avez deja un volume MySQL existant** (installation anterieure a
l'ajout de l'authentification), les scripts `/docker-entrypoint-initdb.d` ne
se rejouent pas automatiquement (MySQL ne les execute qu'a la creation du
volume). Appliquez alors `002_auth.sql` manuellement :

```bash
docker compose exec -T mysql mysql -uroot -proot smart_medicament < db/migrations/002_auth.sql
```

**Une fois les conteneurs demarres**, peuplez la base (le seed s'execute
depuis votre machine, en pointant sur le MySQL expose sur `localhost:3306`) :

```bash
cd db/seed
npm install
DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=smart_medicament npm run seed:all
```

(Sous PowerShell, remplacez le prefixe de variables d'environnement par :
`$env:DB_HOST="localhost"; $env:DB_PORT="3306"; $env:DB_USER="root"; $env:DB_PASSWORD="root"; $env:DB_NAME="smart_medicament"; npm run seed:all`)

Puis ouvrez **http://localhost:5173** : vous serez redirige vers **/login**.
Connectez-vous avec l'un des comptes de demonstration (section 7) - toutes les
routes de l'API exigent desormais un token JWT valide.

---

## 3. Mode dev hybride (mysql + redis en conteneurs, gateway + frontend en local avec hot-reload)

Utile pour developper avec rechargement instantane.

```bash
# 1. Demarrer uniquement l'infrastructure
docker compose up -d mysql redis

# 2. Demarrer les 3 agents Python en local (dans 3 terminaux, avec un venv par agent ou un venv partage)
cd agents/monitoring && pip install -r requirements.txt && uvicorn main:app --reload --port 8001
cd agents/prediction && pip install -r requirements.txt && uvicorn main:app --reload --port 8002
cd agents/decision   && pip install -r requirements.txt && uvicorn main:app --reload --port 8003
# variables d'env pour chaque agent (ou fichier .env / export prealable) :
#   DB_HOST=localhost DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=smart_medicament
#   REDIS_HOST=localhost REDIS_PORT=6379

# 3. Demarrer le gateway en local
cd gateway
npm install
cp .env.example .env   # ajuster si besoin (par defaut : localhost partout)
npm run dev

# 4. Demarrer le frontend en local (hot-reload Vite)
cd frontend
npm install
npm run dev
# Le proxy Vite (vite.config.js) redirige /api vers http://localhost:4000 (le gateway local)

# 5. Peupler la base (une seule fois)
cd db/seed
npm install
npm run seed:all   # variables d'env par defaut : localhost:3306 / root / root / smart_medicament
```

Ouvrez ensuite **http://localhost:5173** (frontend Vite dev server).

---

## 4. Tester le pipeline SMA de bout en bout

0. Se connecter (section 7) avec le compte **Gerant** (seul role autorise a
   creer un mouvement). Via `curl`, recuperer d'abord un token :
   ```bash
   curl -s -X POST http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"gerant.depot@smart-medicament.example","mot_de_passe":"depot1234"}'
   # -> recuperer le champ "access_token" et l'utiliser en
   #    -H "Authorization: Bearer <token>" sur les appels suivants.
   ```
1. Aller sur l'ecran **Mouvements**.
2. Choisir un medicament (idealement un avec un stock deja proche du seuil -
   le seed genere des stocks et un historique de consommation realistes ;
   sinon, enregistrer plusieurs `DISTRIBUTION` successives pour faire baisser
   le stock).
3. Creer un mouvement `DISTRIBUTION` avec une quantite suffisante pour passer
   sous le seuil de securite (le formulaire affiche le stock actuel pour
   estimer la quantite).
4. Le resultat affiche immediatement si le stock est passe sous le seuil
   critique (`sous_seuil_critique: true`) - dans ce cas le pipeline Redis est
   declenche en arriere-plan.
5. Attendre quelques secondes, puis aller sur l'ecran **Alertes** (ou
   **Tableau de bord**, qui poll toutes les 5s) : une nouvelle alerte doit
   apparaitre si le niveau de risque calcule est `ELEVE` ou `CRITIQUE`.
6. Aller sur l'ecran **Commandes** : une commande avec le badge **IA** et le
   statut `EN_ATTENTE` doit etre visible pour ce medicament.
7. Cliquer sur **Ajuster** pour modifier la quantite ou passer le statut a
   `LIVREE` (verifier que le stock du medicament augmente automatiquement et
   qu'un mouvement `ENTREE` apparait dans l'historique des Mouvements).
8. Sur l'ecran **Previsions**, selectionner ce medicament pour voir le detail
   de chaque composante du score (`score_rop`, `variabilite`, `score_ml`,
   `facteur_saisonnier`, `poids_ved`, `score_final`) et la courbe des 12
   coefficients du profil saisonnier, avec le mois courant surligne.

---

## 5. Structure du depot

```
smart-medicament/
  docker-compose.yml
  db/
    migrations/001_schema.sql        schema MySQL complet
    seed/
      seed_base.js                   profils, coefficients, fournisseurs, medicaments, lots, utilisateurs
      seed_mouvements.js              genere l'historique de mouvements avec saisonnalite
  gateway/                           Express - API unique + orchestration Redis
  agents/
    monitoring/                      FastAPI (8001) - stock, lots, retraits
    prediction/                      FastAPI (8002) - scoring.py = coeur du calcul de risque
    decision/                        FastAPI (8003) - fournisseurs, commandes, utilisateurs
  frontend/
    src/modules/<10 ecrans>/         chaque module = page + tableau + formulaire
```

---

## 6. Choix techniques et decisions documentees

- **Seed en Node.js** (et non SQL statique ou Python) pour rester dans le
  meme langage que le gateway et simplifier l'installation (une seule
  dependance `mysql2`).
- **Volume de mouvements historiques** : ~10 jours actifs par mois sur 24
  mois et 15 medicaments (soit un ordre de grandeur de quelques milliers de
  mouvements), documente comme volume raisonnable pour demontrer la
  saisonnalite sans generer les ~28 500 lignes theoriques du cahier des
  charges complet (temps de generation maitrise).
- **Authentification JWT** : `POST /api/auth/login` verifie l'email et le mot
  de passe en appelant l'agent Decision (seul detenteur du hachage bcrypt,
  module Utilisateurs), puis emet un access token JWT courte duree (15 min par
  defaut, header `Authorization: Bearer`) et un refresh token longue duree
  (7 jours par defaut) stocke en cookie httpOnly **et** en base
  (`REFRESH_TOKEN`, sous forme de hash) pour permettre la revocation
  (`POST /api/auth/logout`, rotation a chaque `POST /api/auth/refresh`).
  Toutes les routes metier du gateway exigent un token valide.
- **RBAC (controle d'acces par role)** : chaque route du gateway est protegee
  par `gateway/src/middleware/rbac.js` (`autoriser(...roles)`), qui retourne
  403 si le role du token ne correspond pas a la matrice documentee dans le
  code (GERANT vs SUPERVISEUR). Le frontend masque aussi les entrees de menu
  non autorisees, mais ce n'est que cosmetique : la verification qui compte
  est toujours celle du serveur.
- **Hachage des mots de passe** : bcrypt (`passlib[bcrypt]`), remplace le
  sha256 demonstratif initial. Le hachage/verification restent circonscrits a
  l'agent Decision (`hash_password`/`verify_password`, endpoint
  `POST /utilisateurs/verifier-mot-de-passe` utilise par le gateway au login) ;
  le gateway ne manipule jamais de mot de passe en clair ni de hash.
- **Frontend en Docker** : build Vite statique servi par nginx (plus proche
  d'un deploiement reel), avec `/api` proxy vers le service `gateway` du
  reseau docker-compose. En dev hybride, c'est le serveur de dev Vite qui
  proxy `/api` vers `http://localhost:4000`.
- **Redondance d'ecoute Redis (corrigee)** : dans une version anterieure, le
  gateway ET les agents Prediction/Decision etaient tous les deux abonnes aux
  memes canaux Redis, ce qui produisait des predictions/commandes en double.
  Desormais, **seul le gateway ecoute Redis** et declenche les agents en HTTP
  (`POST /predire/{id}` sur l'agent Prediction, `POST /traiter-prediction` sur
  l'agent Decision) ; les agents publient toujours sur Redis en fin de
  traitement mais ne s'abonnent plus a aucun canal.
- **Convention de signe des mouvements (corrigee)** : `quantite_mouvement` est
  **toujours stockee positive** en base ; le sens (augmente/diminue le stock)
  depend uniquement de `type_mouvement` (`DISTRIBUTION`/`RETRAIT` diminuent,
  `ENTREE` augmente). Seul `AJUSTEMENT` conserve un delta signe libre fourni
  par l'utilisateur. Ce choix evite toute ambiguite d'affichage (une quantite
  negative pour une distribution serait trompeuse) tout en gardant le calcul
  de `stock_actuel` explicite a chaque etape (colonne dediee, pas une simple
  somme des mouvements).
- **Reset de mot de passe et roles** : geres cote agent Decision (module
  Utilisateurs), avec archivage/reactivation plutot que suppression, par
  coherence avec la regle de reversibilite du cahier des charges.
- **Logs structures JSON** : `pino` cote gateway (via `pino-http` pour chaque
  requete), module `logging` avec formatter JSON custom cote agents Python.
  Niveau configurable via `LOG_LEVEL` (`debug`/`info`/`warn`/`error`).
- **Resilience Redis** : reconnexion automatique (backoff) cote gateway
  (client `redis` v4, `reconnectStrategy`) et cote agents (parametres
  `socket_keepalive`/`retry_on_timeout` + retry explicite a la publication).
  Un echec de publication ne fait jamais planter le service ni echouer la
  requete HTTP appelante : il est journalise en `warning`.
- **Validation des entrees** : `zod` cote gateway sur les routes qui
  construisent des requetes SQL a partir d'entrees utilisateur (ex:
  `POST /api/mouvements`, `POST/PUT /api/medicaments`), en plus des requetes
  deja parametrees (`mysql2`/`pymysql`, aucune concatenation SQL directe cote
  gateway ou agents).
- **Rate limiting** : `express-rate-limit` sur `POST /api/auth/login`
  (5 tentatives / 15 min par IP) pour limiter le bruteforce de mots de passe.

## 7. Identifiants de demonstration (seed)

- Gerant : `gerant.depot@smart-medicament.example`
- Superviseur : `superviseur.district@smart-medicament.example`
- Mot de passe (identique pour les deux, hache en bcrypt en base) : `depot1234`

---

## 8. Deploiement production

### Prerequis serveur

- Docker Engine + plugin Docker Compose (v2) sur le serveur cible.
- Un nom de domaine / IP joignable si le frontend doit etre expose au public
  (ce compose expose directement le port 80 ; en pratique, placer un reverse
  proxy TLS - Caddy, Traefik, nginx - devant si le trafic est public).
- Acces en ecriture a un volume/disque pour les donnees MySQL et les
  sauvegardes (`mysql_data`, `mysql_backups`).

### Variables d'environnement a configurer

Copier `.env.example` vers `.env` a la racine du projet (jamais commite,
deja dans `.gitignore`) et renseigner au minimum :

| Variable | Description |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL (fort, propre a l'environnement) |
| `MYSQL_DATABASE` | Nom de la base (`smart_medicament` par defaut) |
| `FRONTEND_ORIGIN` | Origine exacte du frontend servi (pour CORS gateway + agents) |
| `JWT_SECRET` | Secret de signature JWT, long et aleatoire (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_ACCESS_EXPIRES_IN` | Duree de vie de l'access token (defaut `15m`) |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | Duree de vie du refresh token en jours (defaut `7`) |
| `LOG_LEVEL` | Niveau de log (`info` en production, `debug` pour investiguer) |
| `BACKUP_RETENTION_DAYS` | Nombre de jours de dumps MySQL conserves (defaut `7`) |

### Lancement

```bash
cp .env.example .env
# editer .env avec les vraies valeurs (secrets forts, jamais ceux de l'exemple)

docker compose -f docker-compose.prod.yml up -d --build
```

Differences cle avec le compose de dev :
- Aucun bind-mount de code source (build-only, images figees).
- MySQL et Redis ne sont **pas** exposes a l'hote (uniquement joignables entre
  conteneurs du reseau compose `smart_medicament_prod`).
- Le frontend est servi en statique par nginx sur le port `80`.
- `restart: always` sur tous les services (au lieu de `unless-stopped`).
- Toutes les variables sensibles proviennent de `.env` via `env_file`, jamais
  en dur dans le compose.
- Un service `backup` optionnel execute `db/backup/backup.sh` toutes les 24h
  (dump compresse dans le volume `mysql_backups`, purge automatique au-dela
  de `BACKUP_RETENTION_DAYS` jours).

Peupler la base (premiere installation uniquement) :

```bash
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" smart_medicament < db/migrations/002_auth.sql
# puis lancer le seed comme en dev (db/seed), en pointant DB_HOST/DB_PORT
# vers l'hote MySQL de production - ou l'omettre pour un depot deja peuple.
```

### Sauvegarde et restauration MySQL

Sauvegarde manuelle (le service `backup` le fait deja automatiquement) :

```bash
docker compose -f docker-compose.prod.yml exec -T backup /app/backup.sh
```

Les dumps compresses sont dans le volume `mysql_backups` (voir
`docker volume inspect smart-medicament_mysql_backups` pour le chemin sur
l'hote).

Restauration d'une sauvegarde :

```bash
gunzip -c /chemin/vers/smart_medicament_20260101_020000.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" smart_medicament
```

**Attention** : la restauration ecrase les donnees actuelles de la base cible.
Arreter le gateway et les agents (ou au moins couper le trafic) avant de
restaurer, pour eviter des ecritures concurrentes pendant l'import.
