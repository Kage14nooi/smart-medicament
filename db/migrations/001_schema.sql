-- ============================================================================
-- Smart Medicament - Depot de Medicaments Communautaire
-- Schema MySQL 8
-- ============================================================================

CREATE DATABASE IF NOT EXISTS smart_medicament
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smart_medicament;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- PROFIL_SAISONNIER
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS PROFIL_SAISONNIER;
CREATE TABLE PROFIL_SAISONNIER (
  id_profil    INT AUTO_INCREMENT PRIMARY KEY,
  nom_profil   VARCHAR(100) NOT NULL,
  description  VARCHAR(255)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- COEFFICIENT_SAISONNIER
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS COEFFICIENT_SAISONNIER;
CREATE TABLE COEFFICIENT_SAISONNIER (
  id_profil    INT NOT NULL,
  mois         TINYINT NOT NULL CHECK (mois BETWEEN 1 AND 12),
  coefficient  DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  PRIMARY KEY (id_profil, mois),
  CONSTRAINT fk_coef_profil FOREIGN KEY (id_profil) REFERENCES PROFIL_SAISONNIER(id_profil)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- FOURNISSEUR
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS FOURNISSEUR;
CREATE TABLE FOURNISSEUR (
  id_fournisseur   INT AUTO_INCREMENT PRIMARY KEY,
  nom_fournisseur  VARCHAR(150) NOT NULL,
  fiabilite_score  DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  contact          VARCHAR(150),
  actif            BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- MEDICAMENT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS MEDICAMENT;
CREATE TABLE MEDICAMENT (
  id_medicament         INT AUTO_INCREMENT PRIMARY KEY,
  nom_medicament        VARCHAR(150) NOT NULL,
  dci                   VARCHAR(150) NOT NULL,
  code_essentiel        VARCHAR(30) NOT NULL UNIQUE,
  forme_pharmaceutique  VARCHAR(80),
  categorie_ved         ENUM('V','E','D') NOT NULL DEFAULT 'E',
  categorie_abc         ENUM('A','B','C') NOT NULL DEFAULT 'B',
  id_profil_saisonnier  INT,
  stock_actuel          INT NOT NULL DEFAULT 0,
  stock_securite_jours  DECIMAL(6,2) NOT NULL DEFAULT 7.00,
  prix_unitaire         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  actif                 BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_med_profil FOREIGN KEY (id_profil_saisonnier) REFERENCES PROFIL_SAISONNIER(id_profil)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- MEDICAMENT_FOURNISSEUR
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS MEDICAMENT_FOURNISSEUR;
CREATE TABLE MEDICAMENT_FOURNISSEUR (
  id_medicament               INT NOT NULL,
  id_fournisseur              INT NOT NULL,
  delai_livraison_moyen_jours INT NOT NULL DEFAULT 7,
  delai_livraison_max_jours   INT NOT NULL DEFAULT 14,
  prix_achat                  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id_medicament, id_fournisseur),
  CONSTRAINT fk_mf_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  CONSTRAINT fk_mf_four FOREIGN KEY (id_fournisseur) REFERENCES FOURNISSEUR(id_fournisseur) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- LOT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS LOT;
CREATE TABLE LOT (
  id_lot           INT AUTO_INCREMENT PRIMARY KEY,
  id_medicament    INT NOT NULL,
  id_fournisseur   INT,
  numero_lot       VARCHAR(60) NOT NULL,
  date_peremption  DATE NOT NULL,
  quantite_lot     INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_lot_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  CONSTRAINT fk_lot_four FOREIGN KEY (id_fournisseur) REFERENCES FOURNISSEUR(id_fournisseur) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- UTILISATEUR
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS UTILISATEUR;
CREATE TABLE UTILISATEUR (
  id_utilisateur    INT AUTO_INCREMENT PRIMARY KEY,
  nom_utilisateur   VARCHAR(120) NOT NULL,
  email             VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role              ENUM('GERANT','SUPERVISEUR') NOT NULL DEFAULT 'GERANT',
  actif             BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- MOUVEMENT
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS MOUVEMENT;
CREATE TABLE MOUVEMENT (
  id_mouvement        INT AUTO_INCREMENT PRIMARY KEY,
  id_medicament       INT NOT NULL,
  id_lot              INT,
  type_mouvement      ENUM('ENTREE','DISTRIBUTION','AJUSTEMENT','RETRAIT') NOT NULL,
  quantite_mouvement  INT NOT NULL,
  date_mouvement      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_mouvement    VARCHAR(80) NOT NULL DEFAULT 'MANUEL',
  CONSTRAINT fk_mvt_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  CONSTRAINT fk_mvt_lot FOREIGN KEY (id_lot) REFERENCES LOT(id_lot) ON DELETE SET NULL,
  INDEX idx_mvt_med_date (id_medicament, date_mouvement),
  INDEX idx_mvt_type (type_mouvement)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- RETRAIT_DESTRUCTION
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS RETRAIT_DESTRUCTION;
CREATE TABLE RETRAIT_DESTRUCTION (
  id_retrait       INT AUTO_INCREMENT PRIMARY KEY,
  id_lot           INT NOT NULL,
  id_utilisateur   INT NOT NULL,
  id_mouvement     INT NOT NULL,
  motif            ENUM('PEREME','NON_UTILISE','NON_CONFORME') NOT NULL,
  quantite_retiree INT NOT NULL,
  justification    VARCHAR(255) NOT NULL,
  date_retrait     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ret_lot FOREIGN KEY (id_lot) REFERENCES LOT(id_lot) ON DELETE CASCADE,
  CONSTRAINT fk_ret_user FOREIGN KEY (id_utilisateur) REFERENCES UTILISATEUR(id_utilisateur),
  CONSTRAINT fk_ret_mvt FOREIGN KEY (id_mouvement) REFERENCES MOUVEMENT(id_mouvement)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- COMMANDE
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS COMMANDE;
CREATE TABLE COMMANDE (
  id_commande            INT AUTO_INCREMENT PRIMARY KEY,
  id_medicament          INT NOT NULL,
  id_fournisseur         INT,
  quantite_commandee     INT NOT NULL,
  date_commande          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_livraison_prevue  DATE,
  date_livraison_reelle  DATE NULL,
  statut_commande        ENUM('EN_ATTENTE','LIVREE','EN_RETARD','ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  source_commande        ENUM('IA','MANUELLE') NOT NULL DEFAULT 'MANUELLE',
  CONSTRAINT fk_cmd_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  CONSTRAINT fk_cmd_four FOREIGN KEY (id_fournisseur) REFERENCES FOURNISSEUR(id_fournisseur) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- PREDICTION
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS PREDICTION;
CREATE TABLE PREDICTION (
  id_prediction       INT AUTO_INCREMENT PRIMARY KEY,
  id_medicament       INT NOT NULL,
  date_prediction     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  horizon_jours       INT NOT NULL DEFAULT 14,
  score_rop           DECIMAL(4,3) NOT NULL,
  score_ml            DECIMAL(4,3) NOT NULL,
  facteur_saisonnier  DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  score_final         DECIMAL(4,3) NOT NULL,
  niveau_risque       ENUM('FAIBLE','MOYEN','ELEVE','CRITIQUE') NOT NULL,
  modele_version      VARCHAR(40) NOT NULL DEFAULT 'heuristique-v1',
  CONSTRAINT fk_pred_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  INDEX idx_pred_med_date (id_medicament, date_prediction)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- ALERTE
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS ALERTE;
CREATE TABLE ALERTE (
  id_alerte      INT AUTO_INCREMENT PRIMARY KEY,
  id_medicament  INT NOT NULL,
  id_prediction  INT,
  niveau_risque  ENUM('FAIBLE','MOYEN','ELEVE','CRITIQUE') NOT NULL,
  statut_alerte  ENUM('OUVERTE','TRAITEE') NOT NULL DEFAULT 'OUVERTE',
  date_creation  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_med FOREIGN KEY (id_medicament) REFERENCES MEDICAMENT(id_medicament) ON DELETE CASCADE,
  CONSTRAINT fk_al_pred FOREIGN KEY (id_prediction) REFERENCES PREDICTION(id_prediction) ON DELETE SET NULL,
  INDEX idx_alerte_statut (statut_alerte)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
