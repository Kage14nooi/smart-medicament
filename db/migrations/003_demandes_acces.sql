
-- Table de gestion des demandes d'accès
CREATE TABLE IF NOT EXISTS DEMANDE_ACCES (
    id_demande INT AUTO_INCREMENT PRIMARY KEY,

    nom_utilisateur VARCHAR(120) NOT NULL,

    email VARCHAR(150) NOT NULL,

    mot_de_passe_hash VARCHAR(255) NOT NULL,

    statut ENUM(
        'EN_ATTENTE',
        'APPROUVEE',
        'REFUSEE'
    ) NOT NULL DEFAULT 'EN_ATTENTE',

    date_demande TIMESTAMP
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    date_traitement TIMESTAMP NULL DEFAULT NULL,

    traite_par INT NULL,

    INDEX idx_demande_acces_email (email),

    INDEX idx_demande_acces_statut (statut),

    CONSTRAINT fk_demande_acces_superviseur
        FOREIGN KEY (traite_par)
        REFERENCES UTILISATEUR(id_utilisateur)
        ON DELETE SET NULL

) ENGINE=InnoDB;
