-- =============================================================================
-- SUIVI DES QR CODES (flyers, bâches BATIMAT, ...)
--
-- Deux choses :
--   1. table `qr_scans` : une ligne par arrivée sur le site via un lien tracké
--   2. colonnes `qr_campaign` / `qr_source` sur `batimat_preinscriptions` pour
--      attribuer les préinscriptions à la campagne d'origine
--
-- Note : au redémarrage du backend, Sequelize (`sync`) crée `qr_scans`
-- automatiquement si elle n'existe pas. Ce script permet de le faire à la main
-- (Plesk / phpMyAdmin) et reste la source de vérité.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `qr_scans` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign`      VARCHAR(60)  NOT NULL,
  `source`        VARCHAR(60)  NULL,
  `medium`        VARCHAR(60)  NULL,
  `landing_path`  VARCHAR(255) NULL,
  `referrer`      VARCHAR(255) NULL,
  `user_agent`    VARCHAR(500) NULL,
  `ip_address`    VARCHAR(45)  NULL,
  `visitor_id`    VARCHAR(40)  NULL,
  `is_bot`        TINYINT(1)   NOT NULL DEFAULT 0,
  `is_heuristic`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    DATETIME     NOT NULL,
  `updated_at`    DATETIME     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `qr_scans_campaign` (`campaign`),
  KEY `qr_scans_created_at` (`created_at`),
  KEY `qr_scans_visitor_id` (`visitor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si la table `qr_scans` existait déjà (créée par un ancien démarrage du
-- backend) et qu'il manque la colonne `is_heuristic`, exécuter uniquement :
--   ALTER TABLE `qr_scans` ADD COLUMN `is_heuristic` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_bot`;

-- Attribution des préinscriptions BATIMAT.
ALTER TABLE `batimat_preinscriptions`
  ADD COLUMN `qr_campaign` VARCHAR(60) NULL AFTER `statut`,
  ADD COLUMN `qr_source`   VARCHAR(60) NULL AFTER `qr_campaign`;
