-- ============================================================================
-- Smart Medicament - Authentification JWT
-- Migration 002 : table de revocation des refresh tokens
-- ============================================================================

USE smart_medicament;

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------------
-- REFRESH_TOKEN
-- Un refresh token est stocke sous forme de hash (jamais en clair) pour
-- permettre la revocation (logout, reset de mot de passe, etc.) sans exposer
-- le secret si la base est compromise.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS REFRESH_TOKEN (
  id_refresh_token  INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur    INT NOT NULL,
  token_hash        VARCHAR(255) NOT NULL,
  date_creation     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_expiration   TIMESTAMP NOT NULL,
  revoque           BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_reftok_user FOREIGN KEY (id_utilisateur) REFERENCES UTILISATEUR(id_utilisateur)
    ON DELETE CASCADE,
  INDEX idx_reftok_user (id_utilisateur),
  INDEX idx_reftok_hash (token_hash),
  INDEX idx_reftok_expiration (date_expiration)
) ENGINE=InnoDB;
